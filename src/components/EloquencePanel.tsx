import React from 'react';
import { AlertCircle, ArrowLeft, Check, Feather, RotateCcw } from 'lucide-react';
import type { EloquenceResult } from '../types/proofread';

interface EloquencePanelProps {
  activeText: string;
  eloquenceResult: EloquenceResult | null;
  isLoading: boolean;
  error: string | null;
  onGenerateEloquence: () => void;
  onApplyAlternative: (suggestionId: string, originalPhrase: string, replacement: string) => void;
  appliedReplacements: Record<string, string>;
}

export const EloquencePanel: React.FC<EloquencePanelProps> = ({
  activeText,
  eloquenceResult,
  isLoading,
  error,
  onGenerateEloquence,
  onApplyAlternative,
  appliedReplacements,
}) => {
  if (!activeText.trim()) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <Feather className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
          المرادفات والبدائل البلاغية
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
          أدخل نصاً أولاً، ثم اطلب اقتراح بدائل أفصح وأبلغ لرفع المستوى البياني لكتابتك.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" aria-busy="true">
        <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        {[1, 2].map((n) => (
          <div key={n} className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
            <div className="h-4 w-36 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-8 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-6 w-6 text-rose-700 dark:text-rose-400 mb-3" aria-hidden="true" />
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-4 max-w-sm">{error}</p>
        <button
          type="button"
          onClick={onGenerateEloquence}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!eloquenceResult) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <Feather className="h-7 w-7 text-emerald-800 dark:text-emerald-400 mb-3" aria-hidden="true" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
          تحسين الفصاحة والبدائل البلاغية
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md leading-relaxed mb-5">
          يحلّل «فَصيح» عبارات نصك ويقترح مرادفات وتراكيب عربية أفصح وأدق دلالياً مع بيان الفارق البلاغي لكل بديل.
        </p>
        <button
          type="button"
          onClick={onGenerateEloquence}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 dark:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 dark:hover:bg-emerald-600 transition-colors cursor-pointer"
        >
          <Feather className="h-3.5 w-3.5" aria-hidden="true" />
          اقتراح بدائل أفصح للنص
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col divide-y divide-slate-200 dark:divide-slate-800 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6 bg-slate-50/40 dark:bg-slate-950/40">
        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 flex-1">
          <span className="font-semibold text-slate-900 dark:text-white">التقييم البلاغي: </span>
          {eloquenceResult.overallStyleNote}
        </p>
        <button
          type="button"
          onClick={onGenerateEloquence}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
        >
          تحديث الاقتراحات
        </button>
      </div>

      {eloquenceResult.suggestions.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-600 dark:text-slate-400">
          النص مصوغ بعبارات فصيحة وسليمة ولا يحتاج إلى بدائل إضافية.
        </div>
      ) : (
        <div data-testid="eloquence-list" className="divide-y divide-slate-200 dark:divide-slate-800">
          {eloquenceResult.suggestions.map((item) => {
            const chosen = appliedReplacements[item.id];
            return (
              <article key={item.id} className="px-5 py-4 sm:px-6 space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>العبارة الحالية:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5">
                      {item.originalPhrase}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.rhetoricalReason}
                  </p>
                </div>

                <div className="space-y-2">
                  {item.alternatives.map((alt, i) => {
                    const isApplied = chosen === alt.phrase;
                    return (
                      <div
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 px-3.5 py-2.5"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <ArrowLeft className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                            <span className="font-semibold text-emerald-950 dark:text-emerald-300">{alt.phrase}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">· {alt.register}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{alt.nuance}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onApplyAlternative(item.id, item.originalPhrase, alt.phrase)
                          }
                          disabled={isApplied}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isApplied
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-default'
                              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-300'
                          }`}
                        >
                          {isApplied ? (
                            <>
                              <Check className="h-3 w-3" aria-hidden="true" />
                              تم الاستبدال
                            </>
                          ) : (
                            'استبدال في النص'
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
