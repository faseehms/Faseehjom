import React from 'react';

interface HeaderBarProps {
  historyCount: number;
  onOpenHistory: () => void;
  onOpenAdvisor: () => void;
  onJumpToSamples: () => void;
  onJumpToRules: () => void;
  onJumpToEditor: () => void;
  onRunProofread: () => void;
  isLoading: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  historyCount,
  onOpenHistory,
  onOpenAdvisor,
  onJumpToSamples,
  onJumpToRules,
  onJumpToEditor,
  onRunProofread,
  isLoading,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#editor-workspace"
          onClick={(e) => {
            e.preventDefault();
            onJumpToEditor();
          }}
          className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded"
        >
          فَصيح
        </a>

        {/* Zone 2: Concise single-line nav links */}
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <a
            href="#editor-workspace"
            onClick={(e) => {
              e.preventDefault();
              onJumpToEditor();
            }}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-1"
          >
            المحرر اللغوي
          </a>
          <button
            type="button"
            onClick={onOpenAdvisor}
            className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer"
          >
            المستشار اللغوي
          </button>
          <button
            type="button"
            onClick={onJumpToSamples}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer"
          >
            نماذج تطبيقية
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer"
          >
            سجل التدقيق{historyCount > 0 ? ` (${historyCount})` : ''}
          </button>
          <a
            href="#grammar-guide"
            onClick={(e) => {
              e.preventDefault();
              onJumpToRules();
            }}
            className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 py-1"
          >
            دليل القواعد
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAdvisor}
            className="md:hidden px-2.5 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-400 whitespace-nowrap shrink-0"
          >
            المستشار
          </button>
          <button
            type="button"
            onClick={onRunProofread}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-800 dark:bg-emerald-700 rounded-lg hover:bg-emerald-900 dark:hover:bg-emerald-600 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            {isLoading ? 'جارٍ التدقيق...' : 'تدقيق النص'}
          </button>
        </div>
      </div>
    </header>
  );
};
