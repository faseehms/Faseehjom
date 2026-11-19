export type DetectedTextNature =
  | 'standard_prose'
  | 'quranic'
  | 'classical_poetry'
  | 'rhetorical_prose'
  | 'quranic_and_rhetorical';

export interface TextNatureDetection {
  nature: DetectedTextNature;
  containsQuranicText: boolean;
  requiresDeepThinking: boolean;
  isPoetry: boolean;
  isComplexRhetoric: boolean;
  reasons: string[];
}

// Uthmani script Unicode markers: dagger alif (U+0670), alif wasla (U+0671),
// Quranic annotation signs (U+06D6..U+06ED), ornate parentheses (U+FD3E/F)
const UTHMANI_UNICODE_REGEX = /[\u0670\u0671\u06D6-\u06ED\uFD3E\uFD3F]/;

const QURANIC_PHRASES_NORMALIZED = [
  'بسم الله الرحمن الرحيم',
  'الحمد لله رب العالمين',
  'اياك نعبد واياك نستعين',
  'اهدنا الصراط المستقيم',
  'قل هو الله احد',
  'الله الصمد لم يلد ولم يولد',
  'ذلك الكتاب لا ريب فيه',
  'الله لا اله الا هو الحي القيوم',
  'يا ايها الذين امنوا',
  'ان الله لا يغير ما بقوم',
  'وما اوتيتم من العلم الا قليلا',
  'وقل رب زدني علما',
  'فان مع العسر يسرا',
  'انا انزلناه في ليله القدر',
  'اقرا باسم ربك الذي خلق',
  'ان الانسان لفي خسر',
  'تبارك الذي بيده الملك',
  'واعتصموا بحبل الله جميعا',
  'يرفع الله الذين امنوا منكم',
  'ولقد كرمنا بني ادم',
  'انا نحن نزلنا الذكر',
  'ولا تقف ما ليس لك به علم',
  'وكلوا واشربوا ولا تسرفوا',
  'ادع الي سبيل ربك بالحكمه',
  'وما خلقت الجن والانس الا ليعبدون',
  'انما يخشى الله من عباده العلماء',
  'وتعاونوا علي البر والتقوي',
  'يا ايتها النفس المطمئنه',
  'سبحان الذي اسري بعبده',
  'وننزل من القران ما هو شفاء',
];

const QURANIC_ATTRIBUTION_REGEX =
  /(?:قال\s+(?:الله\s+)?تعالى|قوله\s+تعالى|في\s+القرآن\s+الكريم|في\s+كتابه\s+العزيز|صدق\s+الله\s+العظيم)/;

const CLASSICAL_POETRY_CUES = [
  'قفا نبك',
  'سقط اللوي',
  'بين الدخول فحومل',
  'الا ايها الليل',
  'الا هبي بصحنك',
  'لخوله اطلال',
  'بان الخليط',
  'عفت الديار',
  'على قدر اهل العزم',
  'الخيل والليل والبيداء',
  'اذا غامرت في شرف مروم',
  'وما نيل المطالب بالتمني',
  'وليل كموج البحر',
  'لا يسلم الشرف الرفيع',
  'انا الذي نظر الاعمي الي ادبي',
  'خليلي',
  'قف بالديار',
  'سلوا قلبي',
  'اراك عصي الدمع',
  'على قلق كان الريح تحتي',
];

const CLASSICAL_RHETORIC_LEXIS = [
  'لعمري',
  'وايم الله',
  'تالله',
  'يا ويح',
  'لهفي',
  'هيهات',
  'شتان',
  'ويحك',
  'ثكلتك',
  'اللوى',
  'حومل',
  'سدوله',
  'الاصباح',
  'بامثل',
  'اطلال',
  'الوغي',
  'الهيجاء',
  'الصمصام',
  'المنايا',
  'الظعائن',
  'الخدور',
  'اليعملات',
  'السمهري',
  'الصوارم',
  'البيداء',
  'جلمود صخر',
  'مكر مفر',
];

export function normalizeArabicForMatching(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0671\u0622\u0623\u0625]/g, 'ا')
    .replace(/\u0649/g, 'ي')
    .replace(/\u0629/g, 'ه')
    .replace(/[^\u0600-\u06FF0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countArabicWords(line: string): number {
  const matches = line.match(/[\u0600-\u06FF]+/g);
  return matches ? matches.length : 0;
}

function getLastArabicChar(line: string): string {
  const cleaned = normalizeArabicForMatching(line).replace(/\s+/g, '');
  if (!cleaned) return '';
  return cleaned[cleaned.length - 1];
}

function detectPoeticLineStructure(text: string): { isPoetry: boolean; reason?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Case 1: Classical two-hemistich formatting (separated by 3+ spaces, tab, ***, or ...)
  for (const line of lines) {
    const parts = line
      .split(/\t|\s{3,}|\s*\*{2,}\s*|\s*\.\.\.\s*|\s*\/\/\s*/)
      .map((p) => p.trim())
      .filter((p) => countArabicWords(p) >= 2);
    if (parts.length === 2 && countArabicWords(parts[0]) >= 3 && countArabicWords(parts[1]) >= 3) {
      return { isPoetry: true, reason: 'بنية شطرين شعريين متوازنين' };
    }
  }

  // Case 2: Vertical / Taf'ila lines (3+ short poetic lines, optionally sharing rhyme)
  const arabicLines = lines.filter((l) => {
    const wc = countArabicWords(l);
    return wc >= 2 && wc <= 12;
  });

  if (arabicLines.length >= 3 && arabicLines.length === lines.length) {
    const endings = arabicLines.map(getLastArabicChar).filter(Boolean);
    const freq = new Map<string, number>();
    for (const ch of endings) {
      freq.set(ch, (freq.get(ch) ?? 0) + 1);
    }
    const maxSameEnding = Math.max(0, ...freq.values());
    if (maxSameEnding >= 2) {
      return { isPoetry: true, reason: 'أبيات شعرية مقفّاة أو شعر تفعيلة' };
    }
  }

  return { isPoetry: false };
}

export function detectTextNature(text: string): TextNatureDetection {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      nature: 'standard_prose',
      containsQuranicText: false,
      requiresDeepThinking: false,
      isPoetry: false,
      isComplexRhetoric: false,
      reasons: [],
    };
  }

  const reasons: string[] = [];
  const normalized = normalizeArabicForMatching(trimmed);

  // 1. Quranic & Uthmani Script Detection
  let containsQuranicText = false;
  if (UTHMANI_UNICODE_REGEX.test(trimmed)) {
    containsQuranicText = true;
    reasons.push('رصد محارف الرسم العثماني القرآني');
  } else if (
    QURANIC_ATTRIBUTION_REGEX.test(trimmed) &&
    (/[«"﴿]/.test(trimmed) || trimmed.includes(':'))
  ) {
    containsQuranicText = true;
    reasons.push('رصد استشهاد قرآني صريح');
  } else {
    for (const phrase of QURANIC_PHRASES_NORMALIZED) {
      const normalizedPhrase = normalizeArabicForMatching(phrase);
      if (normalized.includes(normalizedPhrase)) {
        containsQuranicText = true;
        reasons.push('رصد نص آية قرآنية كريمة');
        break;
      }
    }
  }

  // 2. Classical Poetry & Complex Rhetoric Detection
  let isPoetry = false;
  let isComplexRhetoric = false;

  const lineStructure = detectPoeticLineStructure(trimmed);
  if (lineStructure.isPoetry) {
    isPoetry = true;
    if (lineStructure.reason) reasons.push(lineStructure.reason);
  }

  for (const cue of CLASSICAL_POETRY_CUES) {
    if (normalized.includes(normalizeArabicForMatching(cue))) {
      isPoetry = true;
      reasons.push('رصد شواهد أو تراكيب شعرية فصيحة');
      break;
    }
  }

  let classicalCueHits = 0;
  for (const lex of CLASSICAL_RHETORIC_LEXIS) {
    if (normalized.includes(normalizeArabicForMatching(lex))) {
      classicalCueHits++;
    }
  }
  if (classicalCueHits >= 2) {
    isComplexRhetoric = true;
    reasons.push('رصد تراكيب بلاغية تراثية أو ألفاظ غريبة');
  }

  // Also check explicit classical prose saj' (3+ rhythmic comma-separated clauses sharing rhyme)
  const sajClauses = trimmed
    .split(/[،؛]/)
    .map((c) => c.trim())
    .filter((c) => {
      const wc = countArabicWords(c);
      return wc >= 2 && wc <= 9;
    });
  if (!isPoetry && sajClauses.length >= 3) {
    const sajEndings = sajClauses.map(getLastArabicChar).filter((c) => c && c !== 'ه');
    const freq = new Map<string, number>();
    for (const ch of sajEndings) {
      freq.set(ch, (freq.get(ch) ?? 0) + 1);
    }
    if (Math.max(0, ...freq.values()) >= 3) {
      isComplexRhetoric = true;
      reasons.push('رصد سجع بلاغي متوازن');
    }
  }

  const requiresDeepThinking = isPoetry || isComplexRhetoric;

  let nature: DetectedTextNature = 'standard_prose';
  if (containsQuranicText && requiresDeepThinking) {
    nature = 'quranic_and_rhetorical';
  } else if (containsQuranicText) {
    nature = 'quranic';
  } else if (isPoetry) {
    nature = 'classical_poetry';
  } else if (isComplexRhetoric) {
    nature = 'rhetorical_prose';
  }

  return {
    nature,
    containsQuranicText,
    requiresDeepThinking,
    isPoetry,
    isComplexRhetoric,
    reasons,
  };
}
