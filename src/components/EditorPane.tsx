import React, { useMemo } from 'react';
import { BookOpenText, Eraser, Eye, PenLine, Sparkles, Wand2 } from 'lucide-react';
import type { CorrectionItem, HighlightSegment, TextStats } from '../types/proofread';
import { tokenizeForIrab } from '../utils/arabicLinguistics';
import { getCategoryMeta } from '../utils/proofreadDiff';

interface EditorPaneProps {
  inputText: string;
  onChangeText: (value: string) => void;
  onProofread: () => void;
  onFullTashkeel: () => void;
  onDetailedIrab: () => void;
  onClear: () => void;
  isLoading: boolean;
  isTashkeelLoading: boolean;
  isIrabLoading: boolean;
  validationError: string | null;
  stats: TextStats;
  viewMode: 'edit' | 'highlights' | 'irab';
  onToggleViewMode: (mode: 'edit' | 'highlights' | 'irab') => void;
  hasHighlights: boolean;
  segments: HighlightSegment[];
  selectedCorrectionId: string | null;
  onSelectCorrection: (correction: CorrectionItem) => void;
  onInspectWordIrab: (word: string, sentence: string) => void;
  selectedIrabWord: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  inputText,
  onChangeText,
  onProofread,
  onFullTashkeel,
  onDetailedIrab,
  onClear,
  isLoading,
  isTashkeelLoading,
  isIrabLoading,
  validationError,
  stats,
  viewMode,
  onToggleViewMode,
  hasHighlights,
  segments,
  selectedCorrectionId,
  onSelectCorrection,
  onInspectWordIrab,
  selectedIrabWord,
  textareaRef,
}) => {
  const irabTokens = useMemo(() => tokenizeForIrab(inputText), [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onProofread();
    }
  };

  return (
    <section
      aria-labelledby="editor-pane-heading"
      className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden h-full"
    >
      {/* Pane Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="editor-pane-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            النص الأصلي
          </h2>
          {(hasHighlights || inputText.trim().length > 0) && (
            <div
              role="group"
              aria-label="وضع عرض النص الأصلي"
              className="flex items-center gap-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5"
            >
              <button
                type="button"
                onClick={() => onToggleViewMode('edit')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'edit'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                تحرير
              </button>
              {hasHighlights && (
                <button
                  type="button"
                  onClick={() => onToggleViewMode('highlights')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === 'highlights'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  معاينة الأخطاء
                </button>
              )}
              {inputText.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleViewMode('irab')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === 'irab'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
                  الإعراب بالنقر
                </button>
              )}
            </div>
          )}
        </div>

        <div
          data-testid="text-stats-bar"
          className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400"
        >
          <span className="tabular-nums">{stats.words} كلمة</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{stats.characters} حرف</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">وقت القراءة: {stats.readingTimeLabel}</span>
          {inputText.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400 transition-colors font-medium whitespace-nowrap shrink-0 cursor-pointer"
                aria-label="مسح النص"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                مسح
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor / Highlighted / Click-to-Irab Body */}
      <div className="relative flex-1 min-h-[340px] lg:min-h-[430px] flex flex-col">
        {viewMode === 'highlights' && hasHighlights ? (
          <div
            data-testid="highlighted-source-view"
            className="flex-1 p-5 sm:p-6 text-base sm:text-[17px] leading-[2] text-slate-900 dark:text-slate-100 whitespace-pre-wrap overflow-y-auto"
          >
            {segments.map((segment, idx) => {
              if (segment.type === 'text' || !segment.correction) {
                return <React.Fragment key={idx}>{segment.text}</React.Fragment>;
              }
              const meta = getCategoryMeta(segment.correction.category);
              const isSelected = selectedCorrectionId === segment.correction.id;
              return (
                <button
                  key={`${segment.correction.id}-${idx}`}
                  type="button"
                  onClick={() => onSelectCorrection(segment.correction!)}
                  title={`${meta.label}: ${segment.correction.corrected}`}
                  className={`inline rounded px-1 py-0.5 underline decoration-2 underline-offset-4 transition-colors cursor-pointer ${
                    meta.underlineClass
                  } ${isSelected ? 'ring-2 ring-emerald-700 dark:ring-emerald-400 ring-offset-1' : ''}`}
                >
                  {segment.text}
                </button>
              );
            })}
          </div>
        ) : viewMode === 'irab' && inputText.trim().length > 0 ? (
          <div
            data-testid="editor-irab-view"
            className="flex-1 p-5 sm:p-6 font-serif text-[19px] leading-[2.1] text-slate-900 dark:text-slate-100 whitespace-pre-wrap overflow-y-auto"
          >
            <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mb-3">
              انقر على أي كلمة لعرض إعرابها التفصيلي وموقعها النحوي في اللوحة المقابلة:
            </p>
            {irabTokens.map((tok) => {
              if (!tok.isWord) {
                return <React.Fragment key={tok.id}>{tok.text}</React.Fragment>;
              }
              const isSelected = selectedIrabWord === tok.text;
              return (
                <button
                  key={tok.id}
                  type="button"
                  onClick={() => onInspectWordIrab(tok.text, tok.sentence)}
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
        ) : (
          <div className="flex-1 flex flex-col">
            <label htmlFor="arabic-input-textarea" className="sr-only">
              أدخل النص العربي المراد تدقيقه
            </label>
            <textarea
              ref={textareaRef}
              id="arabic-input-textarea"
              value={inputText}
              onChange={(e) => onChangeText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب أو الصق النص العربي هنا لتصحيح الأخطاء الإملائية والنحوية وعلامات الترقيم، أو تشكيله كاملاً، أو تحليل إعرابه..."
              dir="rtl"
              className="flex-1 w-full resize-none border-0 bg-transparent p-5 sm:p-6 text-base sm:text-[17px] leading-[1.95] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        )}

        {validationError && (
          <div
            role="alert"
            className="mx-5 mb-3 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-sm text-rose-800 dark:text-rose-200"
          >
            {validationError}
          </div>
        )}
      </div>

      {/* Footer Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-5 py-3.5">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          اضغط{' '}
          <span dir="ltr" className="inline-flex items-center gap-1 mx-0.5">
            <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-200">Ctrl</kbd>
            <span>+</span>
            <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-200">Enter</kbd>
          </span>{' '}
          للتدقيق السريع
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onFullTashkeel}
            disabled={isTashkeelLoading || isLoading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 hover:border-emerald-700 dark:hover:border-emerald-500 hover:text-emerald-900 dark:hover:text-emerald-300 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <Wand2 className="h-4 w-4 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
            {isTashkeelLoading ? 'جارٍ التشكيل...' : 'التشكيل الكامل'}
          </button>

          <button
            type="button"
            onClick={onDetailedIrab}
            disabled={isIrabLoading || isLoading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 hover:border-emerald-700 dark:hover:border-emerald-500 hover:text-emerald-900 dark:hover:text-emerald-300 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <BookOpenText className="h-4 w-4 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
            {isIrabLoading ? 'جارٍ الإعراب...' : 'الإعراب المفصل'}
          </button>

          <button
            type="button"
            onClick={onProofread}
            disabled={isLoading || isTashkeelLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-800 dark:bg-emerald-700 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-900 dark:hover:bg-emerald-600 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {isLoading ? 'جارٍ التدقيق...' : 'تدقيق النص وتوضيح الأخطاء'}
          </button>
        </div>
      </div>
    </section>
  );
};
