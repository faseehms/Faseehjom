import type { AdvisorMessage } from '../types/proofread';

export const ADVISOR_QUICK_PROMPTS: string[] = [
  'لماذا نُصبت أو رُفعت الكلمات الرئيسة في هذا النص؟',
  'ما الشاهد الشعري أو اللغوي على القاعدة النحوية هنا؟',
  'اشرح لي الصورة البلاغية والجمالية في النص',
  'ما أبرز الأخطاء الشائعة التي يجب تجنبها في هذا الأسلوب؟',
];

export interface AdvisorContextPreview {
  hasContext: boolean;
  previewText: string;
  wordCount: number;
}

/**
 * Produces a concise preview of the active editor/corrected text for the Advisor context bar.
 */
export function buildAdvisorContextPreview(
  editorText: string,
  correctedText?: string,
): AdvisorContextPreview {
  const source = (editorText || correctedText || '').trim();
  if (!source) {
    return {
      hasContext: false,
      previewText: 'المحرر فارغ حالياً — يمكنك طرح أسئلة لغوية عامة أو كتابة نص في المحرر لربطه بالمحادثة.',
      wordCount: 0,
    };
  }

  const words = source.split(/\s+/).filter(Boolean);
  const previewText =
    source.length > 140 ? `${source.slice(0, 140).trim()}…` : source;

  return {
    hasContext: true,
    previewText,
    wordCount: words.length,
  };
}

/**
 * Sanitizes and bounds prior chat turns into clean alternating history entries for the API.
 */
export function normalizeAdvisorHistory(
  messages: AdvisorMessage[],
  maxTurns = 16,
): Array<{ role: 'user' | 'model'; text: string }> {
  const cleaned = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && m.text.trim().length > 0)
    .map((m) => ({ role: m.role, text: m.text.trim() }));

  if (cleaned.length <= maxTurns) {
    return cleaned;
  }
  return cleaned.slice(cleaned.length - maxTurns);
}
