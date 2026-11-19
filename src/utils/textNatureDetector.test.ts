import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTextNature } from './textNatureDetector';

test('detectTextNature classifies ordinary modern prose as standard_prose with fast thinking', () => {
  const adminSample =
    'السادة المسؤولين فى الإداره العامه، تحيه طيبه وبعد. نود إعلامكم بان الإجتماع السنوى سوف ينعقد يوم الثلاثاء القادم.';
  const res = detectTextNature(adminSample);
  assert.equal(res.nature, 'standard_prose');
  assert.equal(res.containsQuranicText, false);
  assert.equal(res.requiresDeepThinking, false);
});

test('detectTextNature detects Quranic verses via Uthmani Unicode markers or brackets', () => {
  const uthmani = '﴿بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ﴾';
  const res1 = detectTextNature(uthmani);
  assert.equal(res1.containsQuranicText, true);
  assert.equal(res1.nature, 'quranic');
  assert.equal(res1.requiresDeepThinking, false);

  const plainAyah = 'قال تعالى: «وقل رب زدني علما» وهذه الآية تحث على طلب المعرفة.';
  const res2 = detectTextNature(plainAyah);
  assert.equal(res2.containsQuranicText, true);
});

test('detectTextNature detects classical two-hemistich poetry and Tafila poetry and enables deep thinking', () => {
  const twoHemistich =
    'قِفَا نَبْكِ مِنْ ذِكْرَى حَبِيبٍ وَمَنْزِلِ   بِسِقْطِ اللِّوَى بَيْنَ الدَّخُولِ فَحَوْمَلِ';
  const res1 = detectTextNature(twoHemistich);
  assert.equal(res1.isPoetry, true);
  assert.equal(res1.requiresDeepThinking, true);
  assert.equal(res1.nature, 'classical_poetry');

  const tafila = [
    'ألا أيها الليل الطويل ألا انجلي',
    'بصبح وما الإصباح منك بأمثل',
    'فيالك من ليل كأن نجومه',
  ].join('\n');
  const res2 = detectTextNature(tafila);
  assert.equal(res2.isPoetry, true);
  assert.equal(res2.requiresDeepThinking, true);
});

test('detectTextNature detects classical rhetorical prose and combined Quranic + rhetorical text', () => {
  const combined =
    'قال تعالى: «فإن مع العسر يسرا»، ولعمري إن الصبر عند الهيجاء والمنايا لأجدر بالثناء.';
  const res = detectTextNature(combined);
  assert.equal(res.containsQuranicText, true);
  assert.equal(res.isComplexRhetoric, true);
  assert.equal(res.requiresDeepThinking, true);
  assert.equal(res.nature, 'quranic_and_rhetorical');
});
