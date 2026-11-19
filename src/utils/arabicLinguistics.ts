export interface IrabToken {
  id: string;
  text: string;
  isWord: boolean;
  sentence: string;
}

export interface CommonMistakeDetection {
  patternId: string;
  title: string;
  matchedText: string;
  suggestion: string;
  reason: string;
}

const WORD_REGEX = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+)|([^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+)/g;

/**
 * Splits Arabic text into clean sentence strings for sentence-level I'rab selection.
 */
export function splitArabicSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/(?<=[.!؟?\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Tokenizes Arabic text into interactive words and non-word separators while tracking
 * the containing sentence for each word.
 */
export function tokenizeForIrab(text: string): IrabToken[] {
  if (!text) return [];
  const sentences = splitArabicSentences(text);
  const tokens: IrabToken[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  // Track character offset per sentence for fast containment lookup
  const sentenceBounds: Array<{ start: number; end: number; text: string }> = [];
  let cursor = 0;
  for (const s of sentences) {
    const pos = text.indexOf(s, cursor);
    if (pos !== -1) {
      sentenceBounds.push({ start: pos, end: pos + s.length, text: s });
      cursor = pos + s.length;
    }
  }

  WORD_REGEX.lastIndex = 0;
  while ((match = WORD_REGEX.exec(text)) !== null) {
    const tokenText = match[0];
    const isWord = Boolean(match[1]);
    const tokenStart = match.index;

    let containingSentence = text;
    for (const bound of sentenceBounds) {
      if (tokenStart >= bound.start && tokenStart < bound.end) {
        containingSentence = bound.text;
        break;
      }
    }

    tokens.push({
      id: `tok-${idx++}`,
      text: tokenText,
      isWord,
      sentence: containingSentence,
    });
  }

  return tokens;
}

/**
 * Replaces the first occurrence of a rhetorical phrase cleanly.
 */
export function replacePhraseInText(
  text: string,
  originalPhrase: string,
  replacementPhrase: string,
): { updatedText: string; replaced: boolean } {
  if (!originalPhrase || !replacementPhrase) {
    return { updatedText: text, replaced: false };
  }
  const index = text.indexOf(originalPhrase);
  if (index === -1) {
    return { updatedText: text, replaced: false };
  }
  return {
    updatedText:
      text.slice(0, index) + replacementPhrase + text.slice(index + originalPhrase.length),
    replaced: true,
  };
}

interface PatternRule {
  id: string;
  title: string;
  regex: RegExp;
  getSuggestion: (match: string) => string;
  reason: string;
}

const COMMON_MISTAKE_RULES: PatternRule[] = [
  {
    id: 'dad-zaa-confusion',
    title: 'الخلط بين الضاد والظاء',
    regex: /(^|[^\u0600-\u06FF])(محفوض|محفوضة|حضاً|حضك|نضير|ضننت|الضلم|العضيم|مضهر|حفض|نضام|نضرة)(?=$|[^\u0600-\u06FF])/g,
    getSuggestion: (m) => {
      const map: Record<string, string> = {
        محفوض: 'محفوظ',
        محفوضة: 'محفوظة',
        حضاً: 'حظاً',
        حضك: 'حظك',
        نضير: 'نظير (بمعنى مثيل)',
        ضننت: 'ظننت',
        الضلم: 'الظلم',
        العضيم: 'العظيم',
        مضهر: 'مظهر',
        حفض: 'حفظ',
        نضام: 'نظام',
        نضرة: 'نظرة (إذا قُصد الرؤية)',
      };
      return map[m] || m.replace(/ض/g, 'ظ');
    },
    reason: 'تُكتب هذه الكلمات بالظاء المشالة لا بالضاد؛ لأن معناها العربي الأصيل يرتبط بالحفظ أو الظهور أو الحظ أو العظمة.',
  },
  {
    id: 'hamza-wasl-masdar',
    title: 'همزة الوصل في المصادر الخماسية والسداسية',
    regex: /(^|[^\u0600-\u06FF])((?:ال)?(?:أستقبال|إستقبال|إجتماع|أجتماع|إقتصاد|أقتصاد|إنتهاء|أنتهاء|إستخدام|أستخدام|إلتزام|إحترام|إعتبار))(?=$|[^\u0600-\u06FF])/g,
    getSuggestion: (m) => m.replace(/^ال[أإ]/, 'الا').replace(/^[أإ]/, 'ا'),
    reason: 'مصادر الأفعال الخماسية والسداسية همزتها همزة وصل، فلا تُرسم فوق ألفها أو تحتها همزة.',
  },
  {
    id: 'alif-maqsura-yaa-prep',
    title: 'إهمال نقطتي الياء (ى / ي)',
    regex: /(^|[^\u0600-\u06FF])(فى|التى|الذى|السنوى)(?=$|[^\u0600-\u06FF])/g,
    getSuggestion: (m) => m.trim().replace(/ى$/, 'ي'),
    reason: 'كلمات مثل (في، التي، الذي، السنوي) تنتهي بياء ممدودة تُكتب بنقطتين، لا بألف مقصورة.',
  },
  {
    id: 'alif-fariqa-missing',
    title: 'الألف الفارقة بعد واو الجماعة',
    regex: /(^|[^\u0600-\u06FF])(كتبو|ذهبو|قالو|ساهمو|عملو|درسو)(?=$|[^\u0600-\u06FF])/g,
    getSuggestion: (m) => `${m}ا`,
    reason: 'تُزاد الألف الفارقة بعد واو الجماعة المتصلة بالفعل الماضي أو المضارع المنصوب والمجزوم للتفريق بينها وبين الواو الأصلية.',
  },
  {
    id: 'hamza-final-mistake',
    title: 'رسم الهمزة المتطرفة بعد الساكن',
    regex: /(^|[^\u0600-\u06FF])(شئ|خطئ|بطئ|دفئ|ملئ|جزئ)(?=$|[^\u0600-\u06FF])/g,
    getSuggestion: (m) => {
      const map: Record<string, string> = {
        شئ: 'شيء',
        خطئ: 'خطأ',
        بطئ: 'بطء',
        دفئ: 'دفء',
        ملئ: 'ملء',
        جزئ: 'جزء',
      };
      return map[m] || m;
    },
    reason: 'تُكتب الهمزة المتطرفة على السطر إذا سُبقت بحرف ساكن أو حرف مد، وعلى الألف إذا سُبقت بفتحة مثل (خطأ).',
  },
];

/**
 * Scans Arabic text locally to detect high-frequency common orthographic pitfalls
 * (e.g., الضاد والظاء، همزة الوصل، الياء المنقوطة، الألف الفارقة).
 */
export function detectCommonMistakePatterns(text: string): CommonMistakeDetection[] {
  if (!text.trim()) return [];
  const detections: CommonMistakeDetection[] = [];
  const seen = new Set<string>();

  for (const rule of COMMON_MISTAKE_RULES) {
    rule.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(text)) !== null) {
      const rawMatch = (match[2] ?? match[0]).trim();
      const dedupeKey = `${rule.id}:${rawMatch}`;
      if (!rawMatch || seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      detections.push({
        patternId: rule.id,
        title: rule.title,
        matchedText: rawMatch,
        suggestion: rule.getSuggestion(rawMatch),
        reason: rule.reason,
      });
    }
  }

  return detections;
}
