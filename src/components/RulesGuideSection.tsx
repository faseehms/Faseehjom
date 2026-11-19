import React from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { GRAMMAR_REFERENCE } from '../data/sampleTexts';
import type { CommonMistakeDetection } from '../utils/arabicLinguistics';

interface RulesGuideSectionProps {
  detectedPatterns: CommonMistakeDetection[];
  onTryExample: (exampleSentence: string) => void;
  onQuickReplacePattern: (matchedText: string, suggestion: string) => void;
}

export const RulesGuideSection: React.FC<RulesGuideSectionProps> = ({
  detectedPatterns,
  onTryExample,
  onQuickReplacePattern,
}) => {
  return (
    <section
      id="grammar-guide"
      aria-labelledby="grammar-guide-heading"
      className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-10 space-y-8"
    >
      {/* Live Common Mistakes Detector */}
      {detectedPatterns.length > 0 && (
        <div
          data-testid="common-mistakes-detected"
          className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/25 p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                تنبيهات كاشف الأخطاء الشائعة في نصك الحالي ({detectedPatterns.length})
              </h3>
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              رصد فوري للهمزات والضاد والظاء والياء والألف الفارقة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {detectedPatterns.map((item, idx) => (
              <div
                key={`${item.patternId}-${idx}`}
                className="flex flex-col justify-between rounded-lg border border-amber-200/80 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-4 gap-2.5"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-amber-900 dark:text-amber-300">{item.title}</span>
                    <button
                      type="button"
                      onClick={() => onQuickReplacePattern(item.matchedText, item.suggestion.split(' ')[0])}
                      className="text-xs font-medium text-emerald-800 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      تصحيح فوري
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs mb-1.5">
                    <span className="rounded bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 text-rose-800 dark:text-rose-200 line-through">
                      {item.matchedText}
                    </span>
                    <ArrowLeft className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                    <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 font-semibold text-emerald-900 dark:text-emerald-200">
                      {item.suggestion}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Curated Common Mistakes Cards */}
      <div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="grammar-guide-heading" className="font-serif text-2xl font-bold text-slate-900 dark:text-slate-50">
              كشف الأخطاء الشائعة ومرجع القواعد
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              بطاقات تطبيقية توضح أسباب التصحيح في أشهر مواضع اللبس كالضاد والظاء وهمزات القطع والوصل.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {GRAMMAR_REFERENCE.map((rule) => (
            <article
              key={rule.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <div>
                <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{rule.category}</span>
                  <span aria-hidden="true"> · </span>
                  <span>قاعدة أساسية</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {rule.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-4">
                  {rule.summary}
                </p>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-rose-800 dark:text-rose-300 line-through">{rule.wrongExample}</span>
                  <ArrowLeft className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-emerald-800 dark:text-emerald-400">{rule.rightExample}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onTryExample(rule.wrongExample)}
                  className="text-xs font-medium text-emerald-800 dark:text-emerald-400 hover:underline transition-colors cursor-pointer"
                >
                  اختبر هذا المثال في المحرر
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
