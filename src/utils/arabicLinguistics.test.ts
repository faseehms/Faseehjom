import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCommonMistakePatterns,
  replacePhraseInText,
  splitArabicSentences,
  tokenizeForIrab,
} from './arabicLinguistics';
import { buildPlainTextExport, buildWordHtmlDocument } from './exportText';

test('splitArabicSentences splits Arabic sentences cleanly', () => {
  const sentences = splitArabicSentences('أشرقت الشمس صباحاً. هل قرأت الدرس؟ نعم؛ قرأته.');
  assert.equal(sentences.length, 3);
  assert.equal(sentences[0], 'أشرقت الشمس صباحاً.');
  assert.equal(sentences[1], 'هل قرأت الدرس؟');
  assert.equal(sentences[2], 'نعم؛ قرأته.');
});

test('tokenizeForIrab preserves entire text and tracks containing sentence', () => {
  const input = 'العلم نور. والجهل ظلام.';
  const tokens = tokenizeForIrab(input);
  assert.equal(tokens.map((t) => t.text).join(''), input);

  const wordTokens = tokens.filter((t) => t.isWord);
  assert.equal(wordTokens.length, 4);
  assert.equal(wordTokens[0].text, 'العلم');
  assert.equal(wordTokens[0].sentence, 'العلم نور.');
  assert.equal(wordTokens[3].text, 'ظلام');
  assert.equal(wordTokens[3].sentence, 'والجهل ظلام.');
});

test('detectCommonMistakePatterns detects Dad/Zaa, Hamza Wasl, Yaa, Alif Fariqa, and final Hamza', () => {
  const sample = 'إن الحق محفوض فى الإجتماع وقد كتبو شئ مهم.';
  const detected = detectCommonMistakePatterns(sample);
  const patternIds = new Set(detected.map((d) => d.patternId));

  assert.equal(patternIds.has('dad-zaa-confusion'), true);
  assert.equal(patternIds.has('alif-maqsura-yaa-prep'), true);
  assert.equal(patternIds.has('hamza-wasl-masdar'), true);
  assert.equal(patternIds.has('alif-fariqa-missing'), true);
  assert.equal(patternIds.has('hamza-final-mistake'), true);
});

test('replacePhraseInText replaces rhetorical phrase cleanly', () => {
  const source = 'إن هذا الأمر مهم جداً في حياتنا اليومية.';
  const { updatedText, replaced } = replacePhraseInText(source, 'مهم جداً', 'بالغ الأهمية');
  assert.equal(replaced, true);
  assert.equal(updatedText, 'إن هذا الأمر بالغ الأهمية في حياتنا اليومية.');
});

test('buildPlainTextExport and buildWordHtmlDocument format RTL exports cleanly', () => {
  const txt = buildPlainTextExport('نص عربي سليم.', 'النص سليم.');
  assert.match(txt, /نص عربي سليم\./);
  assert.match(txt, /الخلاصة اللغوية/);

  const doc = buildWordHtmlDocument('السطر الأول\nالسطر الثاني', 'فَصيح', 'خلاصة');
  assert.match(doc, /dir="rtl"/);
  assert.match(doc, /<meta charset="utf-8"/);
  assert.match(doc, /السطر الأول/);
  assert.match(doc, /السطر الثاني/);
});
