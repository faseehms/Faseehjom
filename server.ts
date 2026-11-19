import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  extractCompletedArrayObjects,
  extractPartialJsonBooleanField,
  extractPartialJsonStringField,
  resolveAutoThinkingTier,
} from './src/utils/streamJsonParser';
import {
  detectTextNature,
  type TextNatureDetection,
} from './src/utils/textNatureDetector';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';
const GEMINI_FLASH_MODEL = 'gemini-4-hydrogen';

type ProofreadMode = 'comprehensive' | 'orthography_grammar';

interface ProofreadRequestBody {
  text?: string;
  mode?: ProofreadMode;
  preserveStyle?: boolean;
}

interface TashkeelRequestBody {
  text?: string;
  level?: 'full' | 'endings';
}

interface IrabRequestBody {
  targetText?: string;
  contextSentence?: string;
  mode?: 'word' | 'sentence';
}

interface EloquenceRequestBody {
  text?: string;
}

interface AdvisorRequestBody {
  message?: string;
  editorText?: string;
  correctedText?: string;
  history?: Array<{ role?: string; text?: string }>;
}

const VALID_CATEGORIES = new Set(['spelling', 'grammar', 'punctuation', 'style']);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح GEMINI_API_KEY غير متوفر في بيئة الخادم.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function handleGeminiRouteError(res: Response, error: unknown, fallbackMsg: string) {
  const message = error instanceof Error ? error.message : fallbackMsg;
  console.error('Gemini API error:', error);

  if (
    message.includes('API_KEY_INVALID') ||
    message.includes('PERMISSION_DENIED') ||
    message.includes('GEMINI_API_KEY غير متوفر')
  ) {
    res.status(502).json({
      error: 'تعذّر التحقق من صلاحية مفتاح Gemini API. يرجى التحقق من المفتاح في إعدادات الأسرار (Settings > Secrets).',
    });
    return;
  }

  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429')) {
    res.status(429).json({
      error: 'تم بلوغ حد الطلبات المؤقت للخدمة، يرجى المحاولة بعد قليل.',
    });
    return;
  }

  res.status(500).json({
    error: message || fallbackMsg,
  });
}

function getAutoThinkingLevel(detection: TextNatureDetection): ThinkingLevel {
  return detection.requiresDeepThinking ? ThinkingLevel.HIGH : ThinkingLevel.LOW;
}

function parseProofreadMode(raw: unknown): ProofreadMode {
  return raw === 'orthography_grammar' ? 'orthography_grammar' : 'comprehensive';
}

function writeSseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function buildSystemInstruction(
  mode: ProofreadMode,
  preserveStyle: boolean,
  detection: TextNatureDetection,
): string {
  const modeRule =
    mode === 'orthography_grammar'
      ? 'ركّز بصورة أساسية وسريعة على الأخطاء الإملائية والنحوية الصريحة (الهمزات، التاء المربوطة والهاء، الألف اللينة، الإعراب، المطابقة، الأفعال والأسماء) ولا تُدرج تعديلات أسلوبية تفضيلية.'
      : 'صحّح الأخطاء الإملائية والنحوية والصرفية وعلامات الترقيم بدقة وإيجاز، واقترح تحسينات أسلوبية عند وجود ركاكة واضحة في النثر الحديث.';

  const styleRule = preserveStyle
    ? 'حافظ على أسلوب الكاتب وصياغته الأصلية وبنية الفقرات قدر الإمكان، ولا تستبدل المفردات السليمة بمرادفات دون مبرر نحوي أو إملائي.'
    : 'يُسمح بصقل الجمل التي تعاني من ركاكة تركيبية مع الحفاظ التام على المعنى المقصود.';

  const quranRule = [
    'قاعدة قدسية النص القرآني والرسم العثماني (إلزامية):',
    'إذا تضمّن النص آياتٍ قرآنية أو أجزاءً منها (بالرسم العثماني أو الإملائي)، التزم فوراً بالرسم العثماني (مثل: الصَّلَوٰةَ، الزَّكَوٰةَ، سَمَٰوَٰتٍ، أُوْلَٰٓئِكَ، رَحْمَٰنِ، بِسْمِ ٱللَّهِ) وبالقراءات المتواترة؛ يُمنع منعاً باتاً تعديل حروفها أو رسمها أو حركاتها أو عدّها أخطاءً إملائية، واضبط `containsQuranicText` على `true`.',
  ].join('\n');

  const poetryRhetoricRule = [
    'قاعدة الشعر العربي والتراكيب البلاغية المعقدة (منهج سيبويه وابن جني):',
    'إذا كان النص شعراً عمودياً أو شعر تفعيلة أو نصاً بلاغياً تراثياً، فاستوعب تلقائياً الضرورات الشعرية (مثل صرف الممنوع من الصرف، قصر الممدود، مد المقصور، تسكين المتحرك، أو وصل القطع للوزن)، والتقديم والتأخير، والحذف البلاغي، والمجازات.',
    'لا تعدّ هذه الظواهر أخطاءً نحوية ولا تُدرجها في `corrections`، بل اشرحها في مصفوفة `rhetoricalInsights` موضحاً وجهها البلاغي والنحوي وتعدد أوجه التأويل والإعراب فيها بدقة على منهج كبار النحاة كسيبويه في «الكتاب» وابن جني في «الخصائص»، واضبط `isPoetryOrRhetoric` على `true`.',
  ].join('\n');

  const autoHintParts: string[] = [];
  if (detection.containsQuranicText) {
    autoHintParts.push('تنبيه تلقائي: رُصد نص قرآني كريم في المدخلات؛ التزم التزاماً تاماً بالرسم العثماني ولا تعدّله.');
  }
  if (detection.requiresDeepThinking) {
    autoHintParts.push('تنبيه تلقائي: رُصدت تراكيب شعرية أو بلاغية تراثية معقدة؛ فعّل منهج سيبويه وابن جني في `rhetoricalInsights`.');
  }

  const separationRule =
    'مهم جداً للسرعة: في النثر العادي، لا تُضِف التشكيل الكامل لكل الكلمات (فالتشكيل الكامل له أداة مستقلة)، ولا تكتب إعراباً تفصيلياً كاملاً للجمل (فالإعراب المفصل له أداة مستقلة)؛ واجعل `rhetoricalInsights` فارغة `[]` للنثر الإخباري والإداري البسيط.';

  return [
    'أنت مدقق لغوي عربي خبير ومرجع معتمد في النحو والصرف والإملاء وعلامات الترقيم والبلاغة العربية.',
    modeRule,
    styleRule,
    quranRule,
    poetryRhetoricRule,
    ...autoHintParts,
    separationRule,
    'قواعد الإخراج الصارمة:',
    '1. في حقل `original` داخل مصفوفة `corrections`، ضع الكلمة أو العبارة الخاطئة كما وردت حرفياً في نص المستخدم (خارج الآيات القرآنية وخارج الضرورات الشعرية).',
    '2. في حقل `corrected`، ضع الصيغة الصحيحة المطابقة لما ورد في `correctedText`.',
    '3. في حقل `category`، اختر واحداً فقط من: `spelling`، `grammar`، `punctuation`، `style`.',
    '4. في حقل `ruleTitle`، اذكر اسم القاعدة النحوية أو الإملائية بدقة وإيجاز.',
    '5. في حقل `explanation`، قدّم توضيحاً لغوياً مباشراً وموجزاً.',
    '6. إذا خلا النص من الأخطاء (أو كان قرآناً كريماً أو شعراً سليماً)، أعد `correctedText` مطابقاً للأصل، و`corrections` فارغة `[]`، و`overallAssessment` بقيمة `flawless`.',
  ].join('\n');
}

const PROOFREAD_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  propertyOrdering: [
    'containsQuranicText',
    'isPoetryOrRhetoric',
    'correctedText',
    'summary',
    'overallAssessment',
    'corrections',
    'rhetoricalInsights',
  ],
  properties: {
    containsQuranicText: {
      type: Type.BOOLEAN,
      description: 'true إذا تضمّن النص آية قرآنية كريمة أو جزءاً منها.',
    },
    isPoetryOrRhetoric: {
      type: Type.BOOLEAN,
      description: 'true إذا كان النص شعراً عمودياً أو تفعيلة أو نصاً بلاغياً تراثياً معقداً.',
    },
    correctedText: {
      type: Type.STRING,
      description: 'النص العربي الكامل بعد تصحيح الأخطاء الفعلية مع الإبقاء التام على الآيات القرآنية برسمها العثماني دون مساس.',
    },
    summary: {
      type: Type.STRING,
      description: 'ملخص لغوي موجز يوضح حالة النص وأبرز ما تم تصحيحه أو رصده.',
    },
    overallAssessment: {
      type: Type.STRING,
      description: 'التقييم العام للنص: flawless أو minor_edits أو needs_revision.',
    },
    corrections: {
      type: Type.ARRAY,
      description: 'قائمة التصحيحات الفعلية فقط بالترتيب الذي وردت به في النص.',
      items: {
        type: Type.OBJECT,
        properties: {
          original: {
            type: Type.STRING,
            description: 'الكلمة أو العبارة الخاطئة كما وردت تماماً في النص الأصلي.',
          },
          corrected: {
            type: Type.STRING,
            description: 'الصيغة الصحيحة بعد التصحيح.',
          },
          category: {
            type: Type.STRING,
            description: 'تصنيف الخطأ: spelling أو grammar أو punctuation أو style.',
          },
          ruleTitle: {
            type: Type.STRING,
            description: 'عنوان القاعدة الإملائية أو النحوية.',
          },
          explanation: {
            type: Type.STRING,
            description: 'شرح واضح وموجز لسبب التصحيح.',
          },
          context: {
            type: Type.STRING,
            description: 'الجملة أو المقطع القصير الذي ورد فيه الخطأ.',
          },
        },
        required: ['original', 'corrected', 'category', 'ruleTitle', 'explanation', 'context'],
      },
    },
    rhetoricalInsights: {
      type: Type.ARRAY,
      description: 'توضيح الأوجه البلاغية والنحوية وتعدد أوجه التأويل والإعراب في الشعر والتراكيب البلاغية على منهج سيبويه وابن جني.',
      items: {
        type: Type.OBJECT,
        properties: {
          excerpt: {
            type: Type.STRING,
            description: 'الشاهد أو التركيب الشعري أو البلاغي من النص.',
          },
          phenomenon: {
            type: Type.STRING,
            description: 'الظاهرة البلاغية أو النحوية (مثل: تقديم وتأخير، ضرورة شعرية، حذف بلاغي، استعارة).',
          },
          rhetoricalFacet: {
            type: Type.STRING,
            description: 'الوجه البلاغي والدلالي وأثره في المعنى.',
          },
          grammaticalInterpretations: {
            type: Type.STRING,
            description: 'أوجه التأويل والإعراب النحوي المحتملة على منهج سيبويه وابن جني.',
          },
        },
        required: ['excerpt', 'phenomenon', 'rhetoricalFacet', 'grammaticalInterpretations'],
      },
    },
  },
  required: [
    'containsQuranicText',
    'isPoetryOrRhetoric',
    'correctedText',
    'summary',
    'overallAssessment',
    'corrections',
    'rhetoricalInsights',
  ],
};

interface RawCorrectionPayload {
  original?: string;
  corrected?: string;
  category?: string;
  ruleTitle?: string;
  explanation?: string;
  context?: string;
}

interface RawRhetoricalInsightPayload {
  excerpt?: string;
  phenomenon?: string;
  rhetoricalFacet?: string;
  grammaticalInterpretations?: string;
}

function normalizeCorrectionItem(item: RawCorrectionPayload, idx: number, stamp: number) {
  return {
    id: `corr-${stamp}-${idx}`,
    original: item.original ?? '',
    corrected: item.corrected ?? '',
    category: VALID_CATEGORIES.has(item.category ?? '')
      ? (item.category as 'spelling' | 'grammar' | 'punctuation' | 'style')
      : 'grammar',
    ruleTitle: item.ruleTitle?.trim() || 'قاعدة لغوية',
    explanation: item.explanation?.trim() || '',
    context: item.context?.trim() || '',
  };
}

function normalizeRhetoricalInsightItem(
  item: RawRhetoricalInsightPayload,
  idx: number,
  stamp: number,
) {
  return {
    id: `rhet-${stamp}-${idx}`,
    excerpt: item.excerpt?.trim() || '',
    phenomenon: item.phenomenon?.trim() || 'تأويل نحوي وبلاغي',
    rhetoricalFacet: item.rhetoricalFacet?.trim() || '',
    grammaticalInterpretations: item.grammaticalInterpretations?.trim() || '',
  };
}

function normalizeProofreadPayload(
  rawJson: string,
  originalText: string,
  detection: TextNatureDetection,
  stamp = Date.now(),
) {
  const parsed = JSON.parse(rawJson) as {
    containsQuranicText?: boolean;
    isPoetryOrRhetoric?: boolean;
    correctedText?: string;
    summary?: string;
    overallAssessment?: string;
    corrections?: RawCorrectionPayload[];
    rhetoricalInsights?: RawRhetoricalInsightPayload[];
  };

  const normalizedCorrections = Array.isArray(parsed.corrections)
    ? parsed.corrections
        .filter((item) => item && typeof item.original === 'string' && typeof item.corrected === 'string')
        .map((item, idx) => normalizeCorrectionItem(item, idx, stamp))
    : [];

  const normalizedInsights = Array.isArray(parsed.rhetoricalInsights)
    ? parsed.rhetoricalInsights
        .filter((item) => item && typeof item.excerpt === 'string' && item.excerpt.trim().length > 0)
        .map((item, idx) => normalizeRhetoricalInsightItem(item, idx, stamp))
    : [];

  const assessment =
    parsed.overallAssessment === 'flawless' ||
    parsed.overallAssessment === 'minor_edits' ||
    parsed.overallAssessment === 'needs_revision'
      ? parsed.overallAssessment
      : normalizedCorrections.length === 0
        ? 'flawless'
        : normalizedCorrections.length <= 3
          ? 'minor_edits'
          : 'needs_revision';

  return {
    correctedText: parsed.correctedText ?? originalText,
    summary:
      parsed.summary?.trim() ||
      (normalizedCorrections.length === 0
        ? 'النص سليم لغوياً وإملائياً ولا يتطلب تعديلات.'
        : 'تمت مراجعة النص وتصحيح المواضع الإملائية والنحوية المشار إليها أدناه.'),
    overallAssessment: assessment,
    corrections: normalizedCorrections,
    containsQuranicText: Boolean(parsed.containsQuranicText || detection.containsQuranicText),
    isPoetryOrRhetoric: Boolean(
      parsed.isPoetryOrRhetoric || detection.requiresDeepThinking || normalizedInsights.length > 0,
    ),
    rhetoricalInsights: normalizedInsights,
  };
}

async function callGeminiProofread(
  ai: GoogleGenAI,
  text: string,
  mode: ProofreadMode,
  preserveStyle: boolean,
) {
  const detection = detectTextNature(text);
  const response = await ai.models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: `دقّق النص العربي التالي وفق طبيعته اللغوية مع الالتزام التام بالقواعد المحددة:\n\n"""\n${text}\n"""`,
    config: {
      systemInstruction: buildSystemInstruction(mode, preserveStyle, detection),
      thinkingConfig: { thinkingLevel: getAutoThinkingLevel(detection) },
      responseMimeType: 'application/json',
      responseSchema: PROOFREAD_RESPONSE_SCHEMA,
    },
  });

  const rawJson = (response.text ?? '').trim();
  if (!rawJson) {
    throw new Error('لم يُرجع النموذج استجابة صالحة.');
  }

  return normalizeProofreadPayload(rawJson, text, detection);
}

async function callGeminiTashkeel(
  ai: GoogleGenAI,
  text: string,
  level: 'full' | 'endings',
) {
  const instruction =
    level === 'endings'
      ? 'أنت عالم نحو وصرف عربي. اضبط أواخر الكلمات والبنية الأساسية في النص بالحركات الإعرابية الصحيحة (الفتحة، الضمة، الكسرة، السكون، التنوين، والشدّة اللازمة) دون تغيير ألفاظ النص أو ترتيبه.'
      : 'أنت عالم نحو وصرف عربي خبير في التشكيل. اضبط النص العربي التالي تشكيلاً تاماً وكاملاً (تشكيل كل حرف في كل كلمة بالحركات النحوية والصرفية الصحيحة: الفتحة والضمة والكسرة والسكون والشدّة والتنوين) وفق الإعراب السليم، مع الحفاظ التام على الكلمات والفقرات وعلامات الترقيم كما هي.';

  const response = await ai.models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: `اشكل النص العربي التالي تشكيلاً دقيقاً:\n\n"""\n${text}\n"""`,
    config: {
      systemInstruction: instruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        propertyOrdering: ['vocalizedText', 'notes'],
        properties: {
          vocalizedText: {
            type: Type.STRING,
            description: 'النص العربي مضبوطاً بالشكل الكامل الصحيح.',
          },
          notes: {
            type: Type.STRING,
            description: 'ملاحظة وجيزة عن أبرز المواضع الإعرابية التي رُوعي فيها الضبط.',
          },
        },
        required: ['vocalizedText', 'notes'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    vocalizedText?: string;
    notes?: string;
  };

  return {
    vocalizedText: parsed.vocalizedText?.trim() || text,
    notes: parsed.notes?.trim() || 'تم ضبط النص بالحركات النحوية والصرفية وفق الموقع الإعرابي.',
  };
}

async function callGeminiIrab(
  ai: GoogleGenAI,
  targetText: string,
  contextSentence: string,
  mode: 'word' | 'sentence',
) {
  const systemInstruction = [
    'أنت أستاذ متخصص في النحو العربي والإعراب التطبيقي.',
    'قدّم إعراباً عربياً أصيلاً، دقيقاً، ومفصلاً للكلمة أو الجملة المحددة ضمن سياقها.',
    'في `grammaticalRole` اذكر الموقع الإعرابي بإيجاز (مثل: فاعل مرفوع، خبر إنَّ مرفوع، جملة فعلية في محل نصب مفعول به).',
    'في `detailedIrab` اكتب الإعراب النحوي الكامل بالصيغة التراثية الواضحة (مثال: مبتدأ مرفوع وعلامة رفعه الضمة الظاهرة على آخره).',
    'في `morphologicalNote` اذكر الجذر الثلاثي/الرباعي والصيغة الصرفية (مثل: اسم فاعل، مصدر خماسي، فعل مضارع معتل الآخر) إن وجد.',
    'في `breakdown` حلّل كل كلمة داخل الجملة أو الكلمة المركبة (token، role، irab).',
  ].join('\n');

  const prompt =
    mode === 'word'
      ? `أعرب الكلمة التالية: «${targetText}»\nالواردة في سياق الجملة: «${contextSentence || targetText}»`
      : `أعرب الجملة التالية إعراباً كاملاً مفرداتٍ وجملاً:\n«${targetText}»`;

  const response = await ai.models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          grammaticalRole: {
            type: Type.STRING,
            description: 'الموقع الإعرابي المختصر.',
          },
          detailedIrab: {
            type: Type.STRING,
            description: 'الإعراب التفصيلي الكامل.',
          },
          morphologicalNote: {
            type: Type.STRING,
            description: 'بيان الصرف والجذر اللغوي.',
          },
          breakdown: {
            type: Type.ARRAY,
            description: 'تفصيل إعراب كل مفردة.',
            items: {
              type: Type.OBJECT,
              properties: {
                token: { type: Type.STRING, description: 'الكلمة.' },
                role: { type: Type.STRING, description: 'الموقع الإعرابي.' },
                irab: { type: Type.STRING, description: 'الإعراب التفصيلي للكلمة.' },
              },
              required: ['token', 'role', 'irab'],
            },
          },
        },
        required: ['grammaticalRole', 'detailedIrab', 'morphologicalNote', 'breakdown'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    grammaticalRole?: string;
    detailedIrab?: string;
    morphologicalNote?: string;
    breakdown?: Array<{ token?: string; role?: string; irab?: string }>;
  };

  return {
    target: targetText,
    mode,
    grammaticalRole: parsed.grammaticalRole?.trim() || 'تحليل نحوي',
    detailedIrab: parsed.detailedIrab?.trim() || '',
    morphologicalNote: parsed.morphologicalNote?.trim() || '',
    breakdown: Array.isArray(parsed.breakdown)
      ? parsed.breakdown
          .filter((b) => b && typeof b.token === 'string')
          .map((b) => ({
            token: b.token ?? '',
            role: b.role ?? '',
            irab: b.irab ?? '',
          }))
      : [],
  };
}

async function callGeminiEloquence(ai: GoogleGenAI, text: string) {
  const systemInstruction = [
    'أنت أديب وبلاغي عربي خبير في الفصاحة والبيان وحسن السبك.',
    'حلّل النص العربي المقترح وقدّم بدائل بلاغية ومرادفات أفصح وأدق دلالياً للعبارات الركيكة أو العادية أو المتكررة، مع المحافظة التامة على المعنى.',
    'في كل عنصر داخل `suggestions`:',
    '- `originalPhrase`: العبارة أو الكلمة كما وردت حرفياً في النص.',
    '- `rhetoricalReason`: سبب تفضيل البديل من حيث الفصاحة أو الإيجاز أو الدلالة.',
    '- `alternatives`: قدّم ٢ إلى ٣ بدائل فصيحة مع `phrase` و`nuance` (الفارق الدلالي) و`register` (مثل: فصيح رفيع، موجز بليغ، دقيق الدلالة).',
  ].join('\n');

  const response = await ai.models.generateContent({
    model: GEMINI_FLASH_MODEL,
    contents: `اقترح مرادفات وبدائل بلاغية أفصح لرفع المستوى البياني للنص التالي:\n\n"""\n${text}\n"""`,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallStyleNote: {
            type: Type.STRING,
            description: 'تقييم بلاغي موجز لأسلوب النص ومواطن التحسين.',
          },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalPhrase: { type: Type.STRING },
                rhetoricalReason: { type: Type.STRING },
                alternatives: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      phrase: { type: Type.STRING },
                      nuance: { type: Type.STRING },
                      register: { type: Type.STRING },
                    },
                    required: ['phrase', 'nuance', 'register'],
                  },
                },
              },
              required: ['originalPhrase', 'rhetoricalReason', 'alternatives'],
            },
          },
        },
        required: ['overallStyleNote', 'suggestions'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    overallStyleNote?: string;
    suggestions?: Array<{
      originalPhrase?: string;
      rhetoricalReason?: string;
      alternatives?: Array<{ phrase?: string; nuance?: string; register?: string }>;
    }>;
  };

  return {
    overallStyleNote:
      parsed.overallStyleNote?.trim() ||
      'يمكن تعزيز فصاحة النص باختيار ألفاظ أدق دلالةً وأقوى سبكاً.',
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s) => s && typeof s.originalPhrase === 'string' && Array.isArray(s.alternatives))
          .map((s, idx) => ({
            id: `eloq-${Date.now()}-${idx}`,
            originalPhrase: s.originalPhrase ?? '',
            rhetoricalReason: s.rhetoricalReason ?? '',
            alternatives: (s.alternatives ?? [])
              .filter((a) => a && typeof a.phrase === 'string')
              .map((a) => ({
                phrase: a.phrase ?? '',
                nuance: a.nuance ?? '',
                register: a.register ?? 'أفصح',
              })),
          }))
      : [],
  };
}

function buildAdvisorChatConfig(
  editorText: string,
  correctedText: string,
  history: Array<{ role?: string; text?: string }>,
) {
  const contextParts: string[] = [];
  if (editorText.trim()) {
    contextParts.push(`النص الموجود حالياً في محرر المستخدم:\n"""\n${editorText.trim()}\n"""`);
  }
  if (correctedText.trim() && correctedText.trim() !== editorText.trim()) {
    contextParts.push(`النسخة المصححة المقترحة للنص:\n"""\n${correctedText.trim()}\n"""`);
  }

  const systemInstruction = [
    'أنت «المستشار اللغوي» في منصة «فَصيح»: عالمٌ متبحر في النحو العربي والصرف والإملاء والبلاغة والشواهد الشعرية والنثرية.',
    'أجب بأسلوب أكاديمي عربي رصين وميسّر، يجمع بين الدقة العلمية ووضوح الشرح.',
    'عند الإجابة:',
    '1. اربط تحليلك مباشرةً بالنص الموجود في محرر المستخدم متى ما كان متاحاً، واستشهد بالكلمات والجمل الواردة فيه.',
    '2. إذا سأل المستخدم عن سبب نصب أو رفع أو جزم كلمة، اذكر العامل النحوي والموقع الإعرابي وعلامة الإعراب بوضوح.',
    '3. إذا طلب شاهداً شعرياً أو لغوياً، قدّم شاهداً عربياً أصيلاً وموثوقاً (مع نسبته لقائله أو مصدره عند التحقق) واشرح موضع الشاهد.',
    '4. إذا طلب شرح صورة بلاغية (استعارة، تشبيه، كناية، مجاز، طباق)، حلّل أركانها وأثرها الجمالي في المعنى.',
    contextParts.length > 0
      ? `السياق النصي الحالي للمحرر:\n${contextParts.join('\n\n')}`
      : 'ملاحظة: المحرر فارغ حالياً؛ أجب عن استفسارات المستخدم اللغوية العامة بدقة.',
  ].join('\n\n');

  const formattedHistory = history
    .filter(
      (item) =>
        item &&
        (item.role === 'user' || item.role === 'model') &&
        typeof item.text === 'string' &&
        item.text.trim().length > 0,
    )
    .slice(-16)
    .map((item) => ({
      role: item.role as 'user' | 'model',
      parts: [{ text: item.text!.trim() }],
    }));

  return { systemInstruction, formattedHistory };
}

async function callGeminiAdvisor(
  ai: GoogleGenAI,
  message: string,
  editorText: string,
  correctedText: string,
  history: Array<{ role?: string; text?: string }>,
) {
  const { systemInstruction, formattedHistory } = buildAdvisorChatConfig(
    editorText,
    correctedText,
    history,
  );

  const chat = ai.chats.create({
    model: GEMINI_FLASH_MODEL,
    history: formattedHistory,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });

  const response = await chat.sendMessage({ message });
  const reply = (response.text ?? '').trim();
  if (!reply) {
    throw new Error('لم يُرجع المستشار اللغوي إجابة صالحة.');
  }
  return { reply };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/proofread', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as ProofreadRequestBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      res.status(400).json({ error: 'يرجى إدخال نص عربي قبل طلب التدقيق اللغوي.' });
      return;
    }

    if (text.length > 15000) {
      res.status(400).json({ error: 'النص يتجاوز الحد الأقصى المسموح به في المرة الواحدة (١٥٬٠٠٠ حرف).' });
      return;
    }

    const mode = parseProofreadMode(body.mode);
    const preserveStyle = body.preserveStyle !== false;

    try {
      const ai = getAiClient();
      const result = await callGeminiProofread(ai, text, mode, preserveStyle);
      res.json(result);
    } catch (error) {
      handleGeminiRouteError(res, error, 'تعذّر إتمام التدقيق اللغوي حالياً. يرجى المحاولة مجدداً.');
    }
  });

  app.post('/api/proofread/stream', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as ProofreadRequestBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      res.status(400).json({ error: 'يرجى إدخال نص عربي قبل طلب التدقيق اللغوي.' });
      return;
    }

    if (text.length > 15000) {
      res.status(400).json({ error: 'النص يتجاوز الحد الأقصى المسموح به في المرة الواحدة (١٥٬٠٠٠ حرف).' });
      return;
    }

    const mode = parseProofreadMode(body.mode);
    const preserveStyle = body.preserveStyle !== false;
    const detection = detectTextNature(text);
    const thinkingTier = resolveAutoThinkingTier(text);

    let sseStarted = false;
    try {
      const ai = getAiClient();
      const stream = await ai.models.generateContentStream({
        model: GEMINI_FLASH_MODEL,
        contents: `دقّق النص العربي التالي وفق طبيعته اللغوية مع الالتزام التام بالقواعد المحددة:\n\n"""\n${text}\n"""`,
        config: {
          systemInstruction: buildSystemInstruction(mode, preserveStyle, detection),
          thinkingConfig: { thinkingLevel: getAutoThinkingLevel(detection) },
          responseMimeType: 'application/json',
          responseSchema: PROOFREAD_RESPONSE_SCHEMA,
        },
      });

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      sseStarted = true;

      writeSseEvent(res, 'meta', {
        thinkingTier,
        model: GEMINI_FLASH_MODEL,
        containsQuranicText: detection.containsQuranicText,
        isPoetryOrRhetoric: detection.requiresDeepThinking,
      });

      const stamp = Date.now();
      let buffer = '';
      let lastCorrected = '';
      let lastSummary = '';
      let lastQuranFlag = detection.containsQuranicText;
      let lastRhetoricFlag = detection.requiresDeepThinking;
      let parsedCorrectionsCount = 0;
      let parsedInsightsCount = 0;

      for await (const chunk of stream) {
        const chunkText = chunk.text ?? '';
        if (!chunkText) continue;
        buffer += chunkText;

        const qFlag = extractPartialJsonBooleanField(buffer, 'containsQuranicText');
        const rFlag = extractPartialJsonBooleanField(buffer, 'isPoetryOrRhetoric');
        if ((qFlag === true && !lastQuranFlag) || (rFlag === true && !lastRhetoricFlag)) {
          lastQuranFlag = lastQuranFlag || qFlag === true;
          lastRhetoricFlag = lastRhetoricFlag || rFlag === true;
          writeSseEvent(res, 'nature', {
            containsQuranicText: lastQuranFlag,
            isPoetryOrRhetoric: lastRhetoricFlag,
          });
        }

        const partialCorrected = extractPartialJsonStringField(buffer, 'correctedText');
        if (partialCorrected !== null && partialCorrected !== lastCorrected) {
          lastCorrected = partialCorrected;
          writeSseEvent(res, 'correctedText', { text: partialCorrected });
        }

        const partialSummary = extractPartialJsonStringField(buffer, 'summary');
        if (partialSummary !== null && partialSummary !== lastSummary) {
          lastSummary = partialSummary;
          writeSseEvent(res, 'summary', { text: partialSummary });
        }

        const newItems = extractCompletedArrayObjects<RawCorrectionPayload>(
          buffer,
          'corrections',
          parsedCorrectionsCount,
        );
        for (const rawItem of newItems) {
          const idx = parsedCorrectionsCount;
          parsedCorrectionsCount++;
          if (typeof rawItem.original === 'string' && typeof rawItem.corrected === 'string') {
            writeSseEvent(res, 'correction', {
              item: normalizeCorrectionItem(rawItem, idx, stamp),
            });
          }
        }

        const newInsights = extractCompletedArrayObjects<RawRhetoricalInsightPayload>(
          buffer,
          'rhetoricalInsights',
          parsedInsightsCount,
        );
        for (const rawInsight of newInsights) {
          const idx = parsedInsightsCount;
          parsedInsightsCount++;
          if (typeof rawInsight.excerpt === 'string' && rawInsight.excerpt.trim()) {
            writeSseEvent(res, 'rhetoricalInsight', {
              item: normalizeRhetoricalInsightItem(rawInsight, idx, stamp),
            });
          }
        }
      }

      const rawJson = buffer.trim();
      if (!rawJson) {
        throw new Error('لم يُرجع النموذج استجابة صالحة.');
      }

      const finalResult = normalizeProofreadPayload(rawJson, text, detection, stamp);
      writeSseEvent(res, 'done', { result: finalResult });
      res.end();
    } catch (error) {
      if (!sseStarted) {
        handleGeminiRouteError(res, error, 'تعذّر إتمام التدقيق اللغوي حالياً. يرجى المحاولة مجدداً.');
        return;
      }
      const message =
        error instanceof Error ? error.message : 'حدث خطأ أثناء البث المباشر للتدقيق.';
      writeSseEvent(res, 'error', { error: message });
      res.end();
    }
  });

  app.post('/api/tashkeel', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as TashkeelRequestBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      res.status(400).json({ error: 'يرجى إدخال نص عربي قبل طلب التشكيل.' });
      return;
    }

    if (text.length > 12000) {
      res.status(400).json({ error: 'النص يتجاوز الحد الأقصى المسموح به للتشكيل (١٢٬٠٠٠ حرف).' });
      return;
    }

    const level = body.level === 'endings' ? 'endings' : 'full';

    try {
      const ai = getAiClient();
      const result = await callGeminiTashkeel(ai, text, level);
      res.json(result);
    } catch (error) {
      handleGeminiRouteError(res, error, 'تعذّر تشكيل النص حالياً. يرجى المحاولة مجدداً.');
    }
  });

  app.post('/api/tashkeel/stream', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as TashkeelRequestBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      res.status(400).json({ error: 'يرجى إدخال نص عربي قبل طلب التشكيل.' });
      return;
    }

    if (text.length > 12000) {
      res.status(400).json({ error: 'النص يتجاوز الحد الأقصى المسموح به للتشكيل (١٢٬٠٠٠ حرف).' });
      return;
    }

    const level = body.level === 'endings' ? 'endings' : 'full';
    const instruction =
      level === 'endings'
        ? 'أنت عالم نحو وصرف عربي. اضبط أواخر الكلمات والبنية الأساسية في النص بالحركات الإعرابية الصحيحة (الفتحة، الضمة، الكسرة، السكون، التنوين، والشدّة اللازمة) دون تغيير ألفاظ النص أو ترتيبه.'
        : 'أنت عالم نحو وصرف عربي خبير في التشكيل. اضبط النص العربي التالي تشكيلاً تاماً وكاملاً (تشكيل كل حرف في كل كلمة بالحركات النحوية والصرفية الصحيحة: الفتحة والضمة والكسرة والسكون والشدّة والتنوين) وفق الإعراب السليم، مع الحفاظ التام على الكلمات والفقرات وعلامات الترقيم كما هي.';

    let sseStarted = false;
    try {
      const ai = getAiClient();
      const stream = await ai.models.generateContentStream({
        model: GEMINI_FLASH_MODEL,
        contents: `اشكل النص العربي التالي تشكيلاً دقيقاً:\n\n"""\n${text}\n"""`,
        config: {
          systemInstruction: instruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            propertyOrdering: ['vocalizedText', 'notes'],
            properties: {
              vocalizedText: {
                type: Type.STRING,
                description: 'النص العربي مضبوطاً بالشكل الكامل الصحيح.',
              },
              notes: {
                type: Type.STRING,
                description: 'ملاحظة وجيزة عن أبرز المواضع الإعرابية التي رُوعي فيها الضبط.',
              },
            },
            required: ['vocalizedText', 'notes'],
          },
        },
      });

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      sseStarted = true;

      let buffer = '';
      let lastVocalized = '';
      let lastNotes = '';

      for await (const chunk of stream) {
        const chunkText = chunk.text ?? '';
        if (!chunkText) continue;
        buffer += chunkText;

        const partialVocalized = extractPartialJsonStringField(buffer, 'vocalizedText');
        if (partialVocalized !== null && partialVocalized !== lastVocalized) {
          lastVocalized = partialVocalized;
          writeSseEvent(res, 'vocalizedText', { text: partialVocalized });
        }

        const partialNotes = extractPartialJsonStringField(buffer, 'notes');
        if (partialNotes !== null && partialNotes !== lastNotes) {
          lastNotes = partialNotes;
          writeSseEvent(res, 'notes', { text: partialNotes });
        }
      }

      const parsed = JSON.parse((buffer || '{}').trim()) as {
        vocalizedText?: string;
        notes?: string;
      };
      writeSseEvent(res, 'done', {
        vocalizedText: parsed.vocalizedText?.trim() || text,
        notes: parsed.notes?.trim() || 'تم ضبط النص بالحركات النحوية والصرفية وفق الموقع الإعرابي.',
      });
      res.end();
    } catch (error) {
      if (!sseStarted) {
        handleGeminiRouteError(res, error, 'تعذّر تشكيل النص حالياً. يرجى المحاولة مجدداً.');
        return;
      }
      const message = error instanceof Error ? error.message : 'حدث خطأ أثناء البث المباشر للتشكيل.';
      writeSseEvent(res, 'error', { error: message });
      res.end();
    }
  });

  app.post('/api/irab', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as IrabRequestBody;
    const targetText = typeof body.targetText === 'string' ? body.targetText.trim() : '';
    const contextSentence = typeof body.contextSentence === 'string' ? body.contextSentence.trim() : '';
    const mode = body.mode === 'sentence' ? 'sentence' : 'word';

    if (!targetText) {
      res.status(400).json({ error: 'يرجى اختيار كلمة أو جملة لعرض إعرابها.' });
      return;
    }

    try {
      const ai = getAiClient();
      const result = await callGeminiIrab(ai, targetText, contextSentence, mode);
      res.json(result);
    } catch (error) {
      handleGeminiRouteError(res, error, 'تعذّر استخراج الإعراب النحوي حالياً. يرجى المحاولة مجدداً.');
    }
  });

  app.post('/api/eloquence', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as EloquenceRequestBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      res.status(400).json({ error: 'يرجى إدخال نص عربي لاقتراح البدائل البلاغية.' });
      return;
    }

    try {
      const ai = getAiClient();
      const result = await callGeminiEloquence(ai, text);
      res.json(result);
    } catch (error) {
      handleGeminiRouteError(res, error, 'تعذّر استخراج البدائل البلاغية حالياً. يرجى المحاولة مجدداً.');
    }
  });

  app.post('/api/advisor', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as AdvisorRequestBody;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const editorText = typeof body.editorText === 'string' ? body.editorText : '';
    const correctedText = typeof body.correctedText === 'string' ? body.correctedText : '';
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      res.status(400).json({ error: 'يرجى كتابة سؤالك للمستشار اللغوي.' });
      return;
    }

    try {
      const ai = getAiClient();
      const result = await callGeminiAdvisor(ai, message, editorText, correctedText, history);
      res.json(result);
    } catch (error) {
      handleGeminiRouteError(res, error, 'تعذّر الاتصال بالمستشار اللغوي حالياً. يرجى المحاولة مجدداً.');
    }
  });

  app.post('/api/advisor/stream', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as AdvisorRequestBody;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const editorText = typeof body.editorText === 'string' ? body.editorText : '';
    const correctedText = typeof body.correctedText === 'string' ? body.correctedText : '';
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      res.status(400).json({ error: 'يرجى كتابة سؤالك للمستشار اللغوي.' });
      return;
    }

    let sseStarted = false;
    try {
      const ai = getAiClient();
      const { systemInstruction, formattedHistory } = buildAdvisorChatConfig(
        editorText,
        correctedText,
        history,
      );

      const chat = ai.chats.create({
        model: GEMINI_FLASH_MODEL,
        history: formattedHistory,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      const streamResponse = await chat.sendMessageStream({ message });

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      sseStarted = true;

      let fullReply = '';
      for await (const chunk of streamResponse) {
        const delta = chunk.text ?? '';
        if (!delta) continue;
        fullReply += delta;
        writeSseEvent(res, 'delta', { text: delta });
      }

      const trimmed = fullReply.trim();
      if (!trimmed) {
        throw new Error('لم يُرجع المستشار اللغوي إجابة صالحة.');
      }

      writeSseEvent(res, 'done', { reply: trimmed });
      res.end();
    } catch (error) {
      if (!sseStarted) {
        handleGeminiRouteError(res, error, 'تعذّر الاتصال بالمستشار اللغوي حالياً. يرجى المحاولة مجدداً.');
        return;
      }
      const errMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء البث المباشر.';
      writeSseEvent(res, 'error', { error: errMsg });
      res.end();
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
