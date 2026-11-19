import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCompletedArrayObjects,
  extractPartialJsonBooleanField,
  extractPartialJsonStringField,
  parseSseChunk,
  resolveAutoThinkingTier,
} from './streamJsonParser';

test('resolveAutoThinkingTier activates deep thinking automatically only for poetry/complex rhetoric', () => {
  assert.equal(resolveAutoThinkingTier('نود إعلامكم بان الاجتماع سيعقد غدا.'), 'fast');
  assert.equal(
    resolveAutoThinkingTier('﴿بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ﴾'),
    'fast',
  );
  assert.equal(
    resolveAutoThinkingTier('قفا نبك من ذكرى حبيب ومنزل   بسقط اللوى بين الدخول فحومل'),
    'deep',
  );
});

test('extractPartialJsonBooleanField parses boolean flags during streaming', () => {
  assert.equal(
    extractPartialJsonBooleanField('{"containsQuranicText": true, "correctedText":', 'containsQuranicText'),
    true,
  );
  assert.equal(
    extractPartialJsonBooleanField('{"containsQuranicText": false}', 'containsQuranicText'),
    false,
  );
  assert.equal(
    extractPartialJsonBooleanField('{"containsQuranicText": tr', 'containsQuranicText'),
    null,
  );
});

test('extractPartialJsonStringField decodes partial Arabic strings and incomplete escapes safely', () => {
  const partial1 = '{"correctedText":"السَّلامُ عليكم\\nورحمة\\';
  assert.equal(
    extractPartialJsonStringField(partial1, 'correctedText'),
    'السَّلامُ عليكم\nورحمة',
  );
  assert.equal(extractPartialJsonStringField(partial1, 'summary'), null);

  const partial2 = partial1 + 'nالله","summary":"النص سليم';
  assert.equal(
    extractPartialJsonStringField(partial2, 'correctedText'),
    'السَّلامُ عليكم\nورحمة\nالله',
  );
  assert.equal(extractPartialJsonStringField(partial2, 'summary'), 'النص سليم');
});

test('extractCompletedArrayObjects extracts newly finished items while ignoring braces inside strings', () => {
  const buf1 =
    '{"correctedText":"اذهب","corrections":[{"original":"إذهب","explanation":"مثال {توضيحي}"},';
  const firstBatch = extractCompletedArrayObjects<{ original: string; explanation: string }>(
    buf1,
    'corrections',
    0,
  );
  assert.equal(firstBatch.length, 1);
  assert.equal(firstBatch[0].original, 'إذهب');
  assert.equal(firstBatch[0].explanation, 'مثال {توضيحي}');

  const buf2 = buf1 + '{"original":"الى","corrected":"إلى"},{"original":"في';
  const secondBatch = extractCompletedArrayObjects<{ original: string; corrected?: string }>(
    buf2,
    'corrections',
    1,
  );
  assert.equal(secondBatch.length, 1);
  assert.equal(secondBatch[0].original, 'الى');
  assert.equal(secondBatch[0].corrected, 'إلى');
});

test('parseSseChunk parses split frames cleanly across boundaries', () => {
  const chunk1 = 'event: correctedText\ndata: {"text":"مرح"}\n\nevent: corrected';
  const res1 = parseSseChunk(chunk1, '');
  assert.equal(res1.events.length, 1);
  assert.equal(res1.events[0].event, 'correctedText');
  assert.deepEqual(res1.events[0].data, { text: 'مرح' });

  const chunk2 = 'Text\ndata: {"text":"مرحباً"}\n\n';
  const res2 = parseSseChunk(chunk2, res1.nextCarry);
  assert.equal(res2.events.length, 1);
  assert.equal(res2.events[0].event, 'correctedText');
  assert.deepEqual(res2.events[0].data, { text: 'مرحباً' });
  assert.equal(res2.nextCarry, '');
});
