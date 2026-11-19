import type {
  CategoryFilter,
  CorrectionCategory,
  CorrectionItem,
  HighlightSegment,
  TextStats,
} from '../types/proofread';

const ARABIC_WORDS_PER_MINUTE = 180;

export function formatReadingTimeLabel(words: number): {
  readingTimeSeconds: number;
  readingTimeLabel: string;
} {
  if (words <= 0) {
    return { readingTimeSeconds: 0, readingTimeLabel: '0 ثانية' };
  }
  const seconds = Math.max(5, Math.round((words / ARABIC_WORDS_PER_MINUTE) * 60));
  if (seconds < 45) {
    return { readingTimeSeconds: seconds, readingTimeLabel: 'أقل من دقيقة' };
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes === 1) {
    return { readingTimeSeconds: seconds, readingTimeLabel: 'دقيقة واحدة' };
  }
  if (minutes === 2) {
    return { readingTimeSeconds: seconds, readingTimeLabel: 'دقيقتان' };
  }
  if (minutes <= 10) {
    return { readingTimeSeconds: seconds, readingTimeLabel: `${minutes} دقائق` };
  }
  return { readingTimeSeconds: seconds, readingTimeLabel: `${minutes} دقيقة` };
}

/**
 * Computes accurate word, character, sentence, paragraph, and reading time stats for Arabic text.
 */
export function computeTextStats(text: string): TextStats {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      words: 0,
      characters: text.length,
      charactersWithoutSpaces: text.replace(/\s+/g, '').length,
      sentences: 0,
      paragraphs: 0,
      readingTimeSeconds: 0,
      readingTimeLabel: '0 ثانية',
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const sentences = trimmed
    .split(/[.!؟?؛]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  const paragraphs = trimmed
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean).length;
  const { readingTimeSeconds, readingTimeLabel } = formatReadingTimeLabel(words);

  return {
    words,
    characters: text.length,
    charactersWithoutSpaces: text.replace(/\s+/g, '').length,
    sentences: Math.max(sentences, 1),
    paragraphs,
    readingTimeSeconds,
    readingTimeLabel,
  };
}

/**
 * Maps each correction's `original` substring to non-overlapping positions in `sourceText`,
 * returning ordered segments suitable for interactive inline error highlighting.
 */
export function buildHighlightedSegments(
  sourceText: string,
  corrections: CorrectionItem[],
): HighlightSegment[] {
  if (!sourceText) {
    return [];
  }
  if (!corrections || corrections.length === 0) {
    return [{ type: 'text', text: sourceText }];
  }

  interface MatchSpan {
    start: number;
    end: number;
    correctionIndex: number;
    correction: CorrectionItem;
  }

  const spans: MatchSpan[] = [];
  let searchCursor = 0;

  corrections.forEach((correction, correctionIndex) => {
    const target = correction.original?.trim();
    if (!target) {
      return;
    }

    let foundAt = sourceText.indexOf(target, searchCursor);
    if (foundAt === -1) {
      foundAt = sourceText.indexOf(target);
    }

    while (foundAt !== -1) {
      const end = foundAt + target.length;
      const overlaps = spans.some((s) => foundAt < s.end && end > s.start);
      if (!overlaps) {
        spans.push({
          start: foundAt,
          end,
          correctionIndex,
          correction,
        });
        if (end > searchCursor) {
          searchCursor = end;
        }
        break;
      }
      foundAt = sourceText.indexOf(target, foundAt + 1);
    }
  });

  if (spans.length === 0) {
    return [{ type: 'text', text: sourceText }];
  }

  spans.sort((a, b) => a.start - b.start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({
        type: 'text',
        text: sourceText.slice(cursor, span.start),
      });
    }
    segments.push({
      type: 'error',
      text: sourceText.slice(span.start, span.end),
      correctionIndex: span.correctionIndex,
      correction: span.correction,
    });
    cursor = span.end;
  }

  if (cursor < sourceText.length) {
    segments.push({
      type: 'text',
      text: sourceText.slice(cursor),
    });
  }

  return segments;
}

/**
 * Filters corrections by category and optional Arabic search query.
 */
export function filterCorrections(
  corrections: CorrectionItem[],
  category: CategoryFilter,
  query = '',
): CorrectionItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return corrections.filter((item) => {
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      item.original.toLowerCase().includes(normalizedQuery) ||
      item.corrected.toLowerCase().includes(normalizedQuery) ||
      item.ruleTitle.toLowerCase().includes(normalizedQuery) ||
      item.explanation.toLowerCase().includes(normalizedQuery)
    );
  });
}

/**
 * Counts corrections per category in a single pass.
 */
export function countByCategory(
  corrections: CorrectionItem[],
): Record<CategoryFilter, number> {
  const counts: Record<CategoryFilter, number> = {
    all: corrections.length,
    spelling: 0,
    grammar: 0,
    punctuation: 0,
    style: 0,
  };

  for (const item of corrections) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }

  return counts;
}

/**
 * Applies a single correction to the provided text (first matching occurrence).
 */
export function applySingleCorrection(
  text: string,
  correction: CorrectionItem,
): { updatedText: string; applied: boolean } {
  const target = correction.original;
  if (!target) {
    return { updatedText: text, applied: false };
  }
  const index = text.indexOf(target);
  if (index === -1) {
    return { updatedText: text, applied: false };
  }
  const updatedText =
    text.slice(0, index) + correction.corrected + text.slice(index + target.length);
  return { updatedText, applied: true };
}

export interface CategoryMeta {
  label: string;
  shortLabel: string;
  badgeClass: string;
  underlineClass: string;
}

export function getCategoryMeta(category: CorrectionCategory): CategoryMeta {
  switch (category) {
    case 'spelling':
      return {
        label: 'خطأ إملائي',
        shortLabel: 'إملائي',
        badgeClass: 'text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/70',
        underlineClass: 'decoration-rose-600 dark:decoration-rose-400 bg-rose-50/90 dark:bg-rose-950/60 text-rose-950 dark:text-rose-100 hover:bg-rose-100 dark:hover:bg-rose-900/60',
      };
    case 'grammar':
      return {
        label: 'خطأ نحوي',
        shortLabel: 'نحوي',
        badgeClass: 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/70',
        underlineClass: 'decoration-amber-600 dark:decoration-amber-400 bg-amber-50/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/60',
      };
    case 'punctuation':
      return {
        label: 'علامات الترقيم',
        shortLabel: 'ترقيم',
        badgeClass: 'text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800/70',
        underlineClass: 'decoration-sky-600 dark:decoration-sky-400 bg-sky-50/90 dark:bg-sky-950/60 text-sky-950 dark:text-sky-100 hover:bg-sky-100 dark:hover:bg-sky-900/60',
      };
    case 'style':
      return {
        label: 'تحسين أسلوبي',
        shortLabel: 'أسلوبي',
        badgeClass: 'text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/70',
        underlineClass: 'decoration-emerald-600 dark:decoration-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
      };
  }
}

export function formatCorrectionsCountLabel(count: number): string {
  if (count === 0) return 'لا توجد أخطاء';
  if (count === 1) return 'تصحيح واحد';
  if (count === 2) return 'تصحيحان';
  if (count >= 3 && count <= 10) return `${count} تصحيحات`;
  return `${count} تصحيحًا`;
}
