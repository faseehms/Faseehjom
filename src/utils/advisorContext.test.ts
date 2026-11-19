import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdvisorContextPreview,
  normalizeAdvisorHistory,
} from './advisorContext';
import type { AdvisorMessage } from '../types/proofread';

test('buildAdvisorContextPreview handles empty and populated editor text', () => {
  const empty = buildAdvisorContextPreview('   ');
  assert.equal(empty.hasContext, false);
  assert.equal(empty.wordCount, 0);

  const longText = 'إن اللغة العربية بحرٌ واسعٌ من البيان والفصاحة '.repeat(6);
  const filled = buildAdvisorContextPreview(longText);
  assert.equal(filled.hasContext, true);
  assert.ok(filled.wordCount > 10);
  assert.ok(filled.previewText.endsWith('…'));
});

test('normalizeAdvisorHistory removes blank turns and caps length', () => {
  const msgs: AdvisorMessage[] = [
    { id: '1', role: 'user', text: '   ', createdAt: '2026-01-01' },
    { id: '2', role: 'user', text: 'ما إعراب الفاعل؟', createdAt: '2026-01-01' },
    { id: '3', role: 'model', text: 'الفاعل مرفوع دائماً.', createdAt: '2026-01-01' },
  ];

  const normalized = normalizeAdvisorHistory(msgs, 2);
  assert.equal(normalized.length, 2);
  assert.deepEqual(normalized, [
    { role: 'user', text: 'ما إعراب الفاعل؟' },
    { role: 'model', text: 'الفاعل مرفوع دائماً.' },
  ]);
});
