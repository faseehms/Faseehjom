import React, { useMemo } from 'react';
import { AlertCircle, BookOpenText, RotateCcw } from 'lucide-react';
import type { IrabResult } from '../types/proofread';
import { splitArabicSentences, tokenizeForIrab } from '../utils/arabicLinguistics';

interface IrabPanelProps {
  activeText: string;
  irabResult: IrabResult | null;
  selectedTarget: string | null;
  isLoading: boolean;
  error: string | null;
  onInspectWord: (word: string, sentence: string) => void;
  onInspectSentence: (sentence: string) => void;
  onRetry: () => void;
}

export const IrabPanel: React.FC<IrabPanelProps> = ({
  activeText,
  irabResult,
  selectedTarget,
  isLoading,
  error,
  onInspectWord,
  onInspectSentence,
  onRetry,
}) => {
  const sentences = useMemo(() => splitArabicSentences(activeText), [activeText]);
  const tokens = useMemo(() => tokenizeForIrab(activeText), [activeText]);

  if (!activeText.trim()) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <BookOpenText className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
          الإعراب والتحليل النحوي التفاعلي
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
          اكتب نصاً في المحرر أو اختر نموذجاً تطبيقياً، ثم انقر على أي كلمة أو جملة هنا لعرض إعرابها المفصل وموقعها الإعرابي.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col divide-y divide-slate-200 dark:divide-slate-800 overflow-y-auto">
      {/* Interactive Sentence & Word Selector */}
      <div className="p-5 sm:px-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            انقر على أي كلمة لعرض إعرابها، أو اختر جملة كاملة للتحليل:
          </p>
          {sentences.length > 0 && (
            <button
              type="button"
              onClick={() => onInspectSentence(sentences[0])}
              disabled={isLoading}
              className="rounded-lg border border-emerald-800/20 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              إعراب الجملة الأولى
            </button>
          )}
        </div>

        {/* Clickable Words Surface */}
        <div
          data-testid="irab-clickable-text"
          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-4 font-serif text-[19px] leading-[2.1] text-slate-900 dark:text-slate-100"
        >
          {tokens.map((tok) => {
            if (!tok.isWord) {
              return <React.Fragment key={tok.id}>{tok.text}</React.Fragment>;
            }
            const isSelected = selectedTarget === tok.text;
            return (
              <button
                key={tok.id}
                type="button"
                onClick={() => onInspectWord(tok.text, tok.sentence)}
                className={`inline rounded px-1 py-0.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-800 dark:bg-emerald-700 text-white font-semibold'
                    : 'hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:text-emerald-950 dark:hover:text-emerald-200'
                }`}
              >
                {tok.text}
              </button>
            );
          })}
        </div>

        {/* Quick Sentence Buttons */}
        {sentences.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">إعراب جملة كاملة:</span>
            <div className="flex flex-wrap gap-2">
              {sentences.slice(0, 6).map((sentence, idx) => {
                const isSelected = selectedTarget === sentence;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onInspectSentence(sentence)}
                    className={`max-w-[260px] truncate rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-emerald-800 bg-emerald-800 dark:bg-emerald-700 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-700'
                    }`}
                    title={sentence}
                  >
                    جملة {idx + 1}: {sentence}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Analysis Output Area */}
      <div className="p-5 sm:px-6 flex-1">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-5 w-5 text-rose-700 dark:text-rose-400 mb-2" aria-hidden="true" />
            <p className="text-xs text-slate-700 dark:text-slate-300 mb-3">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              إعادة التحليل
            </button>
          </div>
        ) : !irabResult ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
            اختر أي كلمة أو جملة من النص أعلاه لعرض إعرابها التفصيلي وتصريفها الصرفي.
          </p>
        ) : (
          <div data-testid="irab-result-card" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="font-serif text-xl font-bold text-emerald-900 dark:text-emerald-400">
                  {irabResult.target}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {irabResult.mode === 'word' ? 'تحليل مفردة' : 'تحليل جملة'} · {irabResult.grammaticalRole}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              <p>
                <span className="font-semibold text-slate-900 dark:text-white">الإعراب المفصل: </span>
                {irabResult.detailedIrab}
              </p>
              {irabResult.morphologicalNote && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">البيان الصرفي: </span>
                  {irabResult.morphologicalNote}
                </p>
              )}
            </div>

            {irabResult.breakdown.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2.5">
                  التفصيل الإعرابي للمكونات:
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {irabResult.breakdown.map((part, i) => (
                    <div key={i} className="py-2 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-serif text-base font-bold text-slate-900 dark:text-slate-100">
                          {part.token}
                        </span>
                        <span className="text-slate-400" aria-hidden="true">·</span>
                        <span className="font-medium text-emerald-800 dark:text-emerald-400">{part.role}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{part.irab}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
