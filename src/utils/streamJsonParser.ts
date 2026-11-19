import { detectTextNature } from './textNatureDetector';

export type ThinkingTier = 'fast' | 'deep';

export function resolveAutoThinkingTier(text: string): ThinkingTier {
  return detectTextNature(text).requiresDeepThinking ? 'deep' : 'fast';
}

function findJsonStringFieldStart(jsonBuffer: string, fieldName: string): number {
  const escapedKey = `"${fieldName}"`;
  let searchFrom = 0;
  while (searchFrom < jsonBuffer.length) {
    const keyIdx = jsonBuffer.indexOf(escapedKey, searchFrom);
    if (keyIdx === -1) return -1;

    // Ensure key is at an object property position (start, '{', or ',')
    let prev = keyIdx - 1;
    while (prev >= 0 && /\s/.test(jsonBuffer[prev])) prev--;
    if (prev >= 0 && jsonBuffer[prev] !== '{' && jsonBuffer[prev] !== ',') {
      searchFrom = keyIdx + escapedKey.length;
      continue;
    }

    let afterKey = keyIdx + escapedKey.length;
    while (afterKey < jsonBuffer.length && /\s/.test(jsonBuffer[afterKey])) afterKey++;
    if (jsonBuffer[afterKey] !== ':') {
      searchFrom = keyIdx + escapedKey.length;
      continue;
    }

    let valStart = afterKey + 1;
    while (valStart < jsonBuffer.length && /\s/.test(jsonBuffer[valStart])) valStart++;
    if (jsonBuffer[valStart] !== '"') {
      return -1;
    }

    return valStart + 1;
  }
  return -1;
}

/**
 * Extracts a boolean JSON property value (`true`/`false`) from a partially streamed JSON buffer.
 */
export function extractPartialJsonBooleanField(
  jsonBuffer: string,
  fieldName: string,
): boolean | null {
  const escapedKey = `"${fieldName}"`;
  const keyIdx = jsonBuffer.indexOf(escapedKey);
  if (keyIdx === -1) return null;

  let i = keyIdx + escapedKey.length;
  while (i < jsonBuffer.length && /\s/.test(jsonBuffer[i])) i++;
  if (jsonBuffer[i] !== ':') return null;
  i++;
  while (i < jsonBuffer.length && /\s/.test(jsonBuffer[i])) i++;

  if (jsonBuffer.startsWith('true', i)) return true;
  if (jsonBuffer.startsWith('false', i)) return false;
  return null;
}

/**
 * Extracts and decodes the current string value of a JSON string property from a
 * partially streamed JSON buffer. Returns `null` if the field hasn't started yet.
 */
export function extractPartialJsonStringField(
  jsonBuffer: string,
  fieldName: string,
): string | null {
  const start = findJsonStringFieldStart(jsonBuffer, fieldName);
  if (start === -1) return null;

  let out = '';
  let i = start;
  while (i < jsonBuffer.length) {
    const ch = jsonBuffer[i];
    if (ch === '"') {
      return out;
    }
    if (ch === '\\') {
      if (i + 1 >= jsonBuffer.length) {
        // Incomplete escape sequence at chunk boundary; stop cleanly before it.
        break;
      }
      const esc = jsonBuffer[i + 1];
      switch (esc) {
        case '"':
          out += '"';
          i += 2;
          break;
        case '\\':
          out += '\\';
          i += 2;
          break;
        case '/':
          out += '/';
          i += 2;
          break;
        case 'b':
          out += '\b';
          i += 2;
          break;
        case 'f':
          out += '\f';
          i += 2;
          break;
        case 'n':
          out += '\n';
          i += 2;
          break;
        case 'r':
          out += '\r';
          i += 2;
          break;
        case 't':
          out += '\t';
          i += 2;
          break;
        case 'u': {
          if (i + 6 > jsonBuffer.length) {
            return out;
          }
          const hex = jsonBuffer.slice(i + 2, i + 6);
          const code = Number.parseInt(hex, 16);
          if (!Number.isNaN(code)) {
            out += String.fromCharCode(code);
            i += 6;
          } else {
            out += esc;
            i += 2;
          }
          break;
        }
        default:
          out += esc;
          i += 2;
          break;
      }
    } else {
      out += ch;
      i += 1;
    }
  }

  return out;
}

/**
 * Incrementally extracts newly completed JSON objects from a top-level array field
 * (e.g. `"corrections": [ {...}, {...} ]`) inside a partially streamed JSON buffer.
 */
export function extractCompletedArrayObjects<T>(
  jsonBuffer: string,
  arrayFieldName: string,
  alreadyParsedCount: number,
): T[] {
  const escapedKey = `"${arrayFieldName}"`;
  const keyIdx = jsonBuffer.indexOf(escapedKey);
  if (keyIdx === -1) return [];

  let i = keyIdx + escapedKey.length;
  while (i < jsonBuffer.length && /\s/.test(jsonBuffer[i])) i++;
  if (jsonBuffer[i] !== ':') return [];
  i++;
  while (i < jsonBuffer.length && /\s/.test(jsonBuffer[i])) i++;
  if (jsonBuffer[i] !== '[') return [];
  i++;

  const completed: T[] = [];
  let objectIndex = 0;
  let inString = false;
  let escaped = false;
  let braceDepth = 0;
  let currentObjStart = -1;

  for (; i < jsonBuffer.length; i++) {
    const ch = jsonBuffer[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (braceDepth === 0) {
        currentObjStart = i;
      }
      braceDepth++;
      continue;
    }

    if (ch === '}') {
      if (braceDepth > 0) {
        braceDepth--;
        if (braceDepth === 0 && currentObjStart !== -1) {
          if (objectIndex >= alreadyParsedCount) {
            const rawObj = jsonBuffer.slice(currentObjStart, i + 1);
            try {
              completed.push(JSON.parse(rawObj) as T);
            } catch {
              // Ignore malformed partial object
            }
          }
          objectIndex++;
          currentObjStart = -1;
        }
      }
      continue;
    }

    if (ch === ']' && braceDepth === 0) {
      break;
    }
  }

  return completed;
}

export interface ParsedSseEvent {
  event: string;
  data: unknown;
}

/**
 * Parses SSE frames (`event: ...\ndata: ...\n\n`) from a streaming text chunk plus carry buffer.
 */
export function parseSseChunk(
  chunk: string,
  carry: string,
): { events: ParsedSseEvent[]; nextCarry: string } {
  const combined = carry + chunk;
  const normalized = combined.replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');
  const nextCarry = frames.pop() ?? '';

  const events: ParsedSseEvent[] = [];
  for (const frame of frames) {
    if (!frame.trim()) continue;
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of frame.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message';
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) continue;
    const rawData = dataLines.join('\n');
    try {
      events.push({ event: eventName, data: JSON.parse(rawData) });
    } catch {
      events.push({ event: eventName, data: rawData });
    }
  }

  return { events, nextCarry };
}
