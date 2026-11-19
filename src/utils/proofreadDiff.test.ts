import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySingleCorrection,
  buildHighlightedSegments,
  computeTextStats,
  countByCategory,
  filterCorrections,
  formatCorrectionsCountLabel,
} from './proofreadDiff';
import type { CorrectionItem } from '../types/proofread';

const sampleCorrections: CorrectionItem[] = [
  {
    id: 'c1',
    original: 'أستقبال',
    corrected: 'استقبال',
    category: 'spelling',
    ruleTitle: 'همزة الوصل في المصادر الخماسية والسداسية',
    explanation: 'كلمة استقبال مصدر للفعل السداسي استقبل، وهمزته همزة وصل لا قطع.',
    context: 'تم أستقبال الضيوف',
  },
  {
    id: 'c2',
    original: 'المهندسين',
    corrected: 'المهندسون',
    category: 'grammar',
    ruleTitle: 'إعراب جمع المذكر السالم في حالة الرفع',
    explanation: 'وقع الجمع فاعلاً مرفوعاً، وعلامة رفع جمع المذكر السالم الواو لا الياء.',
    context: 'حضر المهندسين إلى الموقع',
  },
  {
    id: 'c3',
    original: 'المدرسه',
    corrected: 'المدرسة',
    category: 'spelling',
    ruleTitle: 'التاء المربوطة والهاء',
    explanation: 'تُكتب بالتاء المربوطة لأنها تنطق تاءً عند الوصل.',
    context: 'في المدرسه',
  },
];

test('computeTextStats counts Arabic words, sentences, paragraphs, and reading time accurately', () => {
  const text = 'ذهب الطالب إلى المدرسة.\n\nهل قرأت الكتاب اليوم؟ نعم، قرأته.';
  const stats = computeTextStats(text);
  assert.equal(stats.words, 10);
  assert.equal(stats.sentences, 3);
  assert.equal(stats.paragraphs, 2);
  assert.equal(stats.readingTimeLabel, 'أقل من دقيقة');
  assert.ok(stats.readingTimeSeconds >= 5);
});

test('computeTextStats handles empty input', () => {
  const stats = computeTextStats('   ');
  assert.equal(stats.words, 0);
  assert.equal(stats.sentences, 0);
  assert.equal(stats.paragraphs, 0);
  assert.equal(stats.readingTimeLabel, '0 ثانية');
});

test('buildHighlightedSegments partitions text cleanly without losing characters', () => {
  const source = 'تم أستقبال الضيوف، وحضر المهندسين إلى المدرسه صباحًا.';
  const segments = buildHighlightedSegments(source, sampleCorrections);

  const reconstructed = segments.map((s) => s.text).join('');
  assert.equal(reconstructed, source);

  const errorSegments = segments.filter((s) => s.type === 'error');
  assert.equal(errorSegments.length, 3);
  assert.deepEqual(
    errorSegments.map((s) => s.text),
    ['أستقبال', 'المهندسين', 'المدرسه'],
  );
});

test('buildHighlightedSegments skips overlapping matches safely', () => {
  const source = 'أستقبال الضيوف';
  const overlapping: CorrectionItem[] = [
    sampleCorrections[0],
    {
      ...sampleCorrections[0],
      id: 'c-overlap',
      original: 'أستقبال الضيوف',
    },
  ];
  const segments = buildHighlightedSegments(source, overlapping);
  assert.equal(segments.map((s) => s.text).join(''), source);
  assert.equal(segments.filter((s) => s.type === 'error').length, 1);
});

test('filterCorrections filters by category and search query', () => {
  assert.equal(filterCorrections(sampleCorrections, 'spelling').length, 2);
  assert.equal(filterCorrections(sampleCorrections, 'grammar').length, 1);
  assert.equal(filterCorrections(sampleCorrections, 'all', 'الواو').length, 1);
  assert.equal(filterCorrections(sampleCorrections, 'punctuation').length, 0);
});

test('countByCategory tallies all categories', () => {
  const counts = countByCategory(sampleCorrections);
  assert.equal(counts.all, 3);
  assert.equal(counts.spelling, 2);
  assert.equal(counts.grammar, 1);
  assert.equal(counts.punctuation, 0);
});

test('applySingleCorrection replaces exact target cleanly', () => {
  const source = 'تم أستقبال الضيوف في المدرسه.';
  const { updatedText, applied } = applySingleCorrection(source, sampleCorrections[0]);
  assert.equal(applied, true);
  assert.equal(updatedText, 'تم استقبال الضيوف في المدرسه.');
});

test('formatCorrectionsCountLabel applies Arabic plural rules', () => {
  assert.equal(formatCorrectionsCountLabel(0), 'لا توجد أخطاء');
  assert.equal(formatCorrectionsCountLabel(1), 'تصحيح واحد');
  assert.equal(formatCorrectionsCountLabel(2), 'تصحيحان');
  assert.equal(formatCorrectionsCountLabel(5), '5 تصحيحات');
  assert.equal(formatCorrectionsCountLabel(14), '14 تصحيحًا');
});
