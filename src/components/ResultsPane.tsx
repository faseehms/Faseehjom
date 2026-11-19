import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  BookOpenText,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Feather,
  FileCheck2,
  FileText,
  RotateCcw,
  Search,
  SpellCheck,
  Wand2,
} from 'lucide-react';
import type { SampleTextItem } from '../data/sampleTexts';
import type {
  CategoryFilter,
  CorrectionCategory,
  CorrectionItem,
  EloquenceResult,
  IrabResult,
  ProofreadResult,
  TashkeelResult,
  WorkspaceTab,
} from '../types/proofread';
import {
  buildPlainTextExport,
  buildWordHtmlDocument,
  triggerFileDownload,
} from '../utils/exportText';
import {
  countByCategory,
  filterCorrections,
  formatCorrectionsCountLabel,
  getCategoryMeta,
} from '../utils/proofreadDiff';
import { EloquencePanel } from './EloquencePanel';
import { IrabPanel } from './IrabPanel';

interface ResultsPaneProps {
  activeTab: WorkspaceTab;
  onChangeTab: (tab: WorkspaceTab) => void;
  activeText: string;
  result: ProofreadResult | null;
  tashkeelResult: TashkeelResult | null;
  isLoading: boolean;
  isStreaming: boolean;
  isTashkeelLoading: boolean;
  isTashkeelStreaming: boolean;
  detectedQuranic?: boolean;
  error: string | null;
  onRetry: () => void;
  onFullTashkeelOnOutput: () => void;
  onDetailedIrabOnOutput: () => void;
  onReplaceEditorWithText: (text: string) => void;
  onApplySingleCorrection: (correction: CorrectionItem) => void;
  appliedCorrectionIds: Set<string>;
  selectedCorrectionId: string | null;
  onSelectCorrection: (correction: CorrectionItem) => void;
  samples: SampleTextItem[];
  onLoadSample: (sample: SampleTextItem) => void;
  irabResult: IrabResult | null;
  selectedIrabTarget: string | null;
  isIrabLoading: boolean;
  irabError: string | null;
  onInspectWordIrab: (word: string, sentence: string) => void;
  onInspectSentenceIrab: (sentence: string) => void;
  onRetryIrab: () => void;
  eloquenceResult: EloquenceResult | null;
  isEloquenceLoading: boolean;
  eloquenceError: string | null;
  onGenerateEloquence: () => void;
  onApplyAlternative: (suggestionId: string, originalPhrase: string, replacement: string) => void;
  appliedReplacements: Record<string, string>;
}

const FILTER_OPTIONS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'spelling', label: 'إملائي' },
  { id: 'grammar', label: 'نحوي' },
  { id: 'punctuation', label: 'ترقيم' },
  { id: 'style', label: 'أسلوبي' },
];

function getCategoryIcon(category: CorrectionCategory) {
  switch (category) {
    case 'spelling':
      return <SpellCheck className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'grammar':
      return <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'punctuation':
      return <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'style':
      return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  }
}

export const ResultsPane: React.FC<ResultsPaneProps> = ({
  activeTab,
  onChangeTab,
  activeText,
  result,
  tashkeelResult,
  isLoading,
  isStreaming,
  isTashkeelLoading,
  isTashkeelStreaming,
  detectedQuranic = false,
  error,
  onRetry,
  onFullTashkeelOnOutput,
  onDetailedIrabOnOutput,
  onReplaceEditorWithText,
  onApplySingleCorrection,
  appliedCorrectionIds,
  selectedCorrectionId,
  onSelectCorrection,
  samples,
  onLoadSample,
  irabResult,
  selectedIrabTarget,
  isIrabLoading,
  irabError,
  onInspectWordIrab,
  onInspectSentenceIrab,
  onRetryIrab,
  eloquenceResult,
  isEloquenceLoading,
  eloquenceError,
  onGenerateEloquence,
  onApplyAlternative,
  appliedReplacements,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const displayOutputText = tashkeelResult?.vocalizedText || result?.correctedText || '';
  const displaySummary = tashkeelResult?.notes || result?.summary || '';

  const handleCopy = async () => {
    const textToCopy = displayOutputText || activeText;
    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore if clipboard unavailable
    }
  };

  const handleExportTxt = () => {
    const textToExport = displayOutputText || activeText;
    if (!textToExport.trim()) return;
    const content = buildPlainTextExport(textToExport, displaySummary);
    triggerFileDownload('faseeh-corrected.txt', content, 'text/plain;charset=utf-8');
  };

  const handleExportWord = () => {
    const textToExport = displayOutputText || activeText;
    if (!textToExport.trim()) return;
    const content = buildWordHtmlDocument(
      textToExport,
      'النص المصحح — فَصيح',
      displaySummary,
    );
    triggerFileDownload('faseeh-corrected.doc', content, 'application/msword;charset=utf-8');
  };

  const renderTabBar = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-4 py-2.5 sm:px-5">
      <div
        role="tablist"
        aria-label="أدوات التحليل اللغوي"
        className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'proofread'}
          onClick={() => onChangeTab('proofread')}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'proofread'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          التصحيح والتوضيح
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'irab'}
          onClick={() => onChangeTab('irab')}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'irab'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          الإعراب النحوي
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'eloquence'}
          onClick={() => onChangeTab('eloquence')}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'eloquence'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          البدائل البلاغية
        </button>
      </div>

      {activeTab === 'proofread' && result && (
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {formatCorrectionsCountLabel(result.corrections.length)}
        </span>
      )}
    </div>
  );

  const renderExportToolbar = () => {
    const hasExportableText = Boolean((displayOutputText || activeText).trim());
    if (!hasExportableText) return null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                تم النسخ
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                نسخ النص
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportTxt}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            تصدير TXT
          </button>

          <button
            type="button"
            onClick={handleExportWord}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
            تصدير Word
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {displayOutputText && !isStreaming && !isTashkeelStreaming && (
            <>
              <button
                type="button"
                onClick={onFullTashkeelOnOutput}
                disabled={isTashkeelLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-300 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wand2 className="h-3.5 w-3.5 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
                {isTashkeelLoading ? 'جارٍ التشكيل...' : 'التشكيل الكامل'}
              </button>

              <button
                type="button"
                onClick={onDetailedIrabOnOutput}
                disabled={isIrabLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-300 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpenText className="h-3.5 w-3.5 text-emerald-800 dark:text-emerald-400" aria-hidden="true" />
                {isIrabLoading ? 'جارٍ الإعراب...' : 'الإعراب المفصل'}
              </button>

              <button
                type="button"
                onClick={() => onReplaceEditorWithText(displayOutputText)}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-800/20 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1.5 text-xs font-medium text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                اعتماد في المحرر
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (activeTab === 'irab') {
    return (
      <section
        aria-label="الإعراب والتحليل النحوي"
        className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden h-full"
      >
        {renderTabBar()}
        <IrabPanel
          activeText={displayOutputText || activeText}
          irabResult={irabResult}
          selectedTarget={selectedIrabTarget}
          isLoading={isIrabLoading}
          error={irabError}
          onInspectWord={onInspectWordIrab}
          onInspectSentence={onInspectSentenceIrab}
          onRetry={onRetryIrab}
        />
      </section>
    );
  }

  if (activeTab === 'eloquence') {
    return (
      <section
        aria-label="المرادفات والبدائل البلاغية"
        className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden h-full"
      >
        {renderTabBar()}
        <EloquencePanel
          activeText={displayOutputText || activeText}
          eloquenceResult={eloquenceResult}
          isLoading={isEloquenceLoading}
          error={eloquenceError}
          onGenerateEloquence={onGenerateEloquence}
          onApplyAlternative={onApplyAlternative}
          appliedReplacements={appliedReplacements}
        />
      </section>
    );
  }

  if ((isLoading && !isStreaming) || (isTashkeelLoading && !isTashkeelStreaming)) {
    return (
      <section
        aria-label="نتائج التدقيق"
        aria-busy="true"
        className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden h-full"
      >
        {renderTabBar()}
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="h-7 w-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 w-11/12 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 w-4/5 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            {[1, 2, 3].map((n) => (
              <div key={n} className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="h-4 w-48 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-3.5 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label="خطأ في التدقيق"
        className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-full overflow-hidden"
      >
        {renderTabBar()}
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="rounded-full bg-rose-50 dark:bg-rose-950/50 p-3 text-rose-700 dark:text-rose-400 mb-4">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
            تعذّر إتمام الطلب اللغوي
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md leading-relaxed mb-5">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            إعادة المحاولة
          </button>
        </div>
      </section>
    );
  }

  if (!result && !tashkeelResult) {
    return (
      <section
        aria-label="دليل البدء السريع"
        className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-full overflow-hidden"
      >
        {renderTabBar()}
        {renderExportToolbar()}
        <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
          <div>
            <h2 className="font-serif text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              منصة التحليل والتصحيح اللغوي المتكاملة
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mb-6">
              أدخل نصك في المحرر للاستفادة من التدقيق الإملائي والنحوي المشفوع بالتعليل، والضبط التام بالتشكيل، والإعراب التفصيلي بالنقر على أي كلمة، والبدائل البلاغية، واستشارة المستشار اللغوي.
            </p>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                أدوات المنصة المتاحة:
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>تصحيح الهمزات والضاد والظاء والإعراب</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>الضبط التام للنص بالحركات الإعرابية</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>إعراب تفاعلي لأي كلمة أو جملة بالنقر</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>بدائل بلاغية أفصح وتصدير Word / TXT</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-5 mt-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                مثال توضيحي لكيفية عرض التصحيح:
              </p>
              {samples[0] && (
                <button
                  type="button"
                  onClick={() => onLoadSample(samples[0])}
                  className="text-xs font-medium text-emerald-800 dark:text-emerald-400 hover:underline transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  تعبئة المحرر بنموذج تجريبي
                </button>
              )}
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-200">همزة الوصل والقطع:</span>
                <span className="rounded bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 text-rose-800 dark:text-rose-200 line-through">تم أستقبال الضيوف</span>
                <ArrowLeft className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 font-semibold text-emerald-900 dark:text-emerald-200">تم استقبال الضيوف</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                كلمة «استقبال» مصدر للفعل السداسي (استقبل)، وهمزته همزة وصل لا قطع، لذا تُكتب ألفاً مجرّدة من الهمزة.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (tashkeelResult && (!result || isTashkeelStreaming)) {
    return (
      <section
        aria-label="نتيجة الضبط التام بالتشكيل"
        aria-busy={isTashkeelStreaming}
        className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden h-full"
      >
        {renderTabBar()}
        {renderExportToolbar()}
        <div className="px-5 py-6 sm:px-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
              النص مضبوطاً بالتشكيل التام
            </div>
            {isTashkeelStreaming && (
              <span
                data-testid="streaming-status-indicator"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-400"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                جارٍ البث المباشر للتشكيل...
              </span>
            )}
          </div>
          <div
            data-testid="tashkeel-text-output"
            className="font-serif text-[20px] leading-[2.1] text-slate-950 dark:text-slate-50 whitespace-pre-wrap"
          >
            {tashkeelResult.vocalizedText || '...'}
          </div>
          {tashkeelResult.notes && (
            <p className="border-t border-slate-100 dark:border-slate-800 pt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">ملاحظة الضبط: </span>
              {tashkeelResult.notes}
            </p>
          )}
        </div>
      </section>
    );
  }

  const categoryCounts = countByCategory(result!.corrections);
  const filteredCorrections = filterCorrections(
    result!.corrections,
    categoryFilter,
    searchQuery,
  );
  const showQuranicNotice = Boolean(result?.containsQuranicText || detectedQuranic);
  const rhetoricalInsights = result?.rhetoricalInsights ?? [];

  return (
    <section
      aria-labelledby="results-pane-heading"
      className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden h-full"
    >
      {renderTabBar()}
      {renderExportToolbar()}

      {showQuranicNotice && (
        <div
          data-testid="quranic-uthmani-notice"
          className="flex items-start gap-2.5 border-b border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/35 px-5 py-3 text-xs leading-relaxed text-emerald-950 dark:text-emerald-200 sm:px-6"
        >
          <BookOpen className="h-4 w-4 text-emerald-800 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <span className="font-semibold">آية قرآنية بالرسم العثماني: </span>
            التزم المحرك تلقائياً بحفظ الرسم العثماني والقراءات المتواترة دون تعديلها أو اعتبارها أخطاءً إملائية.
          </p>
        </div>
      )}

      {/* Corrected Text Output */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h2 id="results-pane-heading" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {tashkeelResult ? 'النص المصحح والمضبوط بالتشكيل التام' : 'النص المصحح'}
          </h2>
          {isStreaming && (
            <span
              data-testid="streaming-status-indicator"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-400"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
              جارٍ البث المباشر...
            </span>
          )}
        </div>

        <div
          data-testid="corrected-text-output"
          className="font-serif text-[19px] sm:text-[20px] leading-[2] text-slate-950 dark:text-slate-50 whitespace-pre-wrap"
        >
          {displayOutputText || (isStreaming ? '...' : '')}
        </div>

        {displaySummary && (
          <p
            data-testid="streaming-summary-output"
            className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-300"
          >
            <span className="font-semibold text-slate-800 dark:text-slate-100">الخلاصة اللغوية: </span>
            {displaySummary}
          </p>
        )}
      </div>

      {/* Rhetorical & Sibawayh/Ibn Jinni Grammatical Insights (when poetry or complex rhetoric detected) */}
      {rhetoricalInsights.length > 0 && (
        <div
          data-testid="rhetorical-insights-section"
          className="border-b border-slate-200 dark:border-slate-800 bg-amber-50/35 dark:bg-amber-950/15 px-5 py-4 sm:px-6 space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300">
            <Feather className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>التأويل النحوي والوجه البلاغي (منهج سيبويه وابن جني)</span>
          </div>
          <div className="space-y-3">
            {rhetoricalInsights.map((insight) => (
              <article
                key={insight.id}
                className="rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-white dark:bg-slate-900 p-3.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-serif text-base font-bold text-slate-900 dark:text-slate-100">
                    «{insight.excerpt}»
                  </span>
                  <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    {insight.phenomenon}
                  </span>
                </div>
                {insight.rhetoricalFacet && (
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">الوجه البلاغي: </span>
                    {insight.rhetoricalFacet}
                  </p>
                )}
                {insight.grammaticalInterpretations && (
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">أوجه الإعراب والتأويل: </span>
                    {insight.grammaticalInterpretations}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Corrections Breakdown */}
      <div className="flex-1 flex flex-col">
        {result!.corrections.length === 0 && isStreaming ? (
          <div className="p-6 space-y-3" aria-busy="true">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              جارٍ استخراج الملاحظات والتصحيحات تدريجياً...
            </div>
            <div className="h-4 w-48 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-3.5 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : result!.corrections.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 p-3 text-emerald-700 dark:text-emerald-400 mb-3">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {showQuranicNotice
                ? 'النص القرآني محفوظ بالرسم العثماني'
                : rhetoricalInsights.length > 0
                  ? 'النص سليم على منهج العرب'
                  : 'النص سليم لغوياً'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
              {showQuranicNotice
                ? 'تمت مراجعة النص مع الالتزام الكامل بالرسم العثماني والقراءات المتواترة دون تسجيل أخطاء.'
                : rhetoricalInsights.length > 0
                  ? 'استوعب المحرك الضرورات الشعرية والوجوه البلاغية دون اعتبارها أخطاءً نحوية.'
                  : 'لم يجد المدقق أخطاء إملائية أو نحوية تستوجب التعديل في هذا النص.'}
            </p>
          </div>
        ) : (
          <>
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 px-5 py-3">
              <div
                role="group"
                aria-label="تصفية التصحيحات حسب النوع"
                className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1"
              >
                {FILTER_OPTIONS.map((opt) => {
                  const count = categoryCounts[opt.id];
                  const active = categoryFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCategoryFilter(opt.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                        active
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="relative min-w-[170px] flex-1 sm:flex-initial">
                <Search
                  className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في التصحيحات..."
                  aria-label="بحث في التصحيحات"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pr-8 pl-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-700 dark:focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Itemized Explanations */}
            <div
              data-testid="corrections-list"
              className="divide-y divide-slate-200 dark:divide-slate-800 overflow-y-auto max-h-[460px]"
            >
              {filteredCorrections.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  لا توجد تصحيحات مطابقة للتصفية الحالية.
                </div>
              ) : (
                filteredCorrections.map((item, idx) => {
                  const meta = getCategoryMeta(item.category);
                  const isApplied = appliedCorrectionIds.has(item.id);
                  const isSelected = selectedCorrectionId === item.id;

                  return (
                    <article
                      key={item.id}
                      id={`correction-item-${item.id}`}
                      onClick={() => onSelectCorrection(item)}
                      className={`px-5 py-4 sm:px-6 transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/30'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono text-slate-400 tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium ${meta.badgeClass}`}
                          >
                            {getCategoryIcon(item.category)}
                            {meta.label}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {item.ruleTitle}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onApplySingleCorrection(item);
                          }}
                          disabled={isApplied}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isApplied
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-default'
                              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-700 hover:text-emerald-800 dark:hover:text-emerald-300'
                          }`}
                        >
                          {isApplied ? (
                            <>
                              <Check className="h-3 w-3" aria-hidden="true" />
                              تم التطبيق
                            </>
                          ) : (
                            'تطبيق في المحرر'
                          )}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
                        <span className="rounded bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 text-rose-800 dark:text-rose-200 line-through decoration-rose-500">
                          {item.original}
                        </span>
                        <ArrowLeft className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 font-semibold text-emerald-900 dark:text-emerald-200">
                          {item.corrected}
                        </span>
                      </div>

                      <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {item.explanation}
                      </p>
                    </article>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
