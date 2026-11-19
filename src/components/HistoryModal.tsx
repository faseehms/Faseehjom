import React, { useEffect } from 'react';
import { History, Trash2, X } from 'lucide-react';
import type { ProofreadHistoryEntry } from '../types/proofread';
import { formatCorrectionsCountLabel } from '../utils/proofreadDiff';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ProofreadHistoryEntry[];
  onRestoreEntry: (entry: ProofreadHistoryEntry) => void;
  onClearHistory: () => void;
}

function getModeLabel(mode: ProofreadHistoryEntry['mode'] | string): string {
  switch (mode) {
    case 'orthography_grammar':
      return 'إملائي ونحوي';
    case 'classical_rhetoric':
      return 'شعر جاهلي / بلاغي عميق';
    case 'diacritics':
      return 'ضبط بالتشكيل';
    case 'comprehensive':
    default:
      return 'تدقيق سريع شامل';
  }
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  entries,
  onRestoreEntry,
  onClearHistory,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 dark:bg-slate-950/70 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl overflow-hidden flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
            <h2 id="history-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              سجل جلسات التدقيق
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                مسح السجل
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق سجل التدقيق"
              className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
          {entries.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                لا توجد جلسات تدقيق محفوظة بعد
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تُحفظ النصوص التي تدققها تلقائياً هنا لسهولة الرجوع إليها.
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const formattedTime = new Date(entry.createdAt).toLocaleString('ar-EG', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={entry.id}
                  className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>{getModeLabel(entry.mode)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {formatCorrectionsCountLabel(entry.result.corrections.length)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formattedTime}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onRestoreEntry(entry);
                        onClose();
                      }}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-400 hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                    >
                      استعادة في المحرر
                    </button>
                  </div>

                  <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                    {entry.originalText}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
