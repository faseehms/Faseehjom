import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, BrainCircuit, MessageSquareText, Moon, Sun, Zap } from 'lucide-react';
import { EditorPane } from './components/EditorPane';
import { HeaderBar } from './components/HeaderBar';
import { HistoryModal } from './components/HistoryModal';
import { LinguisticAdvisorDrawer } from './components/LinguisticAdvisorDrawer';
import { ResultsPane } from './components/ResultsPane';
import { RulesGuideSection } from './components/RulesGuideSection';
import { SAMPLE_TEXTS, type SampleTextItem } from './data/sampleTexts';
import type {
  AdvisorMessage,
  CorrectionItem,
  EloquenceResult,
  IrabResult,
  ProofreadHistoryEntry,
  ProofreadMode,
  ProofreadResult,
  RhetoricalInsightItem,
  TashkeelResult,
  ThemeMode,
  WorkspaceTab,
} from './types/proofread';
import { normalizeAdvisorHistory } from './utils/advisorContext';
import {
  detectCommonMistakePatterns,
  replacePhraseInText,
  splitArabicSentences,
} from './utils/arabicLinguistics';
import {
  applySingleCorrection,
  buildHighlightedSegments,
  computeTextStats,
} from './utils/proofreadDiff';
import { parseSseChunk } from './utils/streamJsonParser';
import { detectTextNature } from './utils/textNatureDetector';

const HISTORY_STORAGE_KEY = 'mishkat_proofread_history_v1';
const THEME_STORAGE_KEY = 'faseeh_theme_v1';

const MODE_OPTIONS: Array<{ id: ProofreadMode; label: string }> = [
  { id: 'comprehensive', label: 'تدقيق شامل' },
  { id: 'orthography_grammar', label: 'إملائي ونحوي فقط' },
];

function loadSavedHistory(): ProofreadHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function loadSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // Ignore storage error
  }
  return 'light';
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(loadSavedTheme);
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<ProofreadMode>('comprehensive');
  const [preserveStyle, setPreserveStyle] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('proofread');

  // Proofreading state
  const [result, setResult] = useState<ProofreadResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'highlights' | 'irab'>('edit');
  const [appliedCorrectionIds, setAppliedCorrectionIds] = useState<Set<string>>(new Set());
  const [selectedCorrectionId, setSelectedCorrectionId] = useState<string | null>(null);

  // Full Tashkeel state (strictly independent on-demand trigger)
  const [tashkeelResult, setTashkeelResult] = useState<TashkeelResult | null>(null);
  const [isTashkeelLoading, setIsTashkeelLoading] = useState(false);
  const [isTashkeelStreaming, setIsTashkeelStreaming] = useState(false);

  // I'rab state (strictly independent on-demand trigger)
  const [irabResult, setIrabResult] = useState<IrabResult | null>(null);
  const [selectedIrabTarget, setSelectedIrabTarget] = useState<string | null>(null);
  const [lastIrabRequest, setLastIrabRequest] = useState<{
    targetText: string;
    contextSentence: string;
    mode: 'word' | 'sentence';
  } | null>(null);
  const [isIrabLoading, setIsIrabLoading] = useState(false);
  const [irabError, setIrabError] = useState<string | null>(null);

  // Eloquence state
  const [eloquenceResult, setEloquenceResult] = useState<EloquenceResult | null>(null);
  const [isEloquenceLoading, setIsEloquenceLoading] = useState(false);
  const [eloquenceError, setEloquenceError] = useState<string | null>(null);
  const [appliedReplacements, setAppliedReplacements] = useState<Record<string, string>>({});

  // Linguistic Advisor Chat Drawer state (deep thinking + streaming)
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [advisorMessages, setAdvisorMessages] = useState<AdvisorMessage[]>([]);
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);

  // History modal
  const [history, setHistory] = useState<ProofreadHistoryEntry[]>(loadSavedHistory);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const samplesRef = useRef<HTMLDivElement | null>(null);
  const proofreadAbortRef = useRef<AbortController | null>(null);
  const tashkeelAbortRef = useRef<AbortController | null>(null);
  const advisorAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage error
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const stats = useMemo(() => computeTextStats(inputText), [inputText]);

  const detectedPatterns = useMemo(
    () => detectCommonMistakePatterns(inputText),
    [inputText],
  );

  const highlightedSegments = useMemo(() => {
    if (!result || result.corrections.length === 0) return [];
    return buildHighlightedSegments(inputText, result.corrections);
  }, [inputText, result]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleChangeText = (value: string) => {
    setInputText(value);
    if (validationError && value.trim().length > 0) {
      setValidationError(null);
    }
    if (viewMode === 'highlights') {
      setViewMode('edit');
    }
  };

  const textNature = useMemo(() => detectTextNature(inputText), [inputText]);

  const handleProofread = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      setValidationError('يرجى إدخال نص عربي في المحرر قبل طلب التدقيق اللغوي.');
      textareaRef.current?.focus();
      return;
    }

    proofreadAbortRef.current?.abort();
    const controller = new AbortController();
    proofreadAbortRef.current = controller;

    setActiveTab('proofread');
    setValidationError(null);
    setApiError(null);
    setTashkeelResult(null);
    setIsLoading(true);
    setIsStreaming(false);
    setAppliedCorrectionIds(new Set());
    setSelectedCorrectionId(null);

    let receivedFirstChunk = false;
    let finalPayload: ProofreadResult | null = null;
    let streamedResult: ProofreadResult = {
      correctedText: '',
      summary: '',
      corrections: [],
      overallAssessment: 'minor_edits',
      containsQuranicText: textNature.containsQuranicText,
      isPoetryOrRhetoric: textNature.requiresDeepThinking,
      rhetoricalInsights: [],
    };

    const ensureStreamInitialized = () => {
      if (!receivedFirstChunk) {
        receivedFirstChunk = true;
        setIsLoading(false);
        setIsStreaming(true);
      }
    };

    try {
      const response = await fetch('/api/proofread/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          mode,
          preserveStyle,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || 'تعذّر إتمام عملية التدقيق اللغوي.');
      }

      if (!response.body) {
        throw new Error('تعذّر فتح قناة البث المباشر مع الخادم.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let carry = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const textChunk = decoder.decode(value, { stream: true });
        const { events, nextCarry } = parseSseChunk(textChunk, carry);
        carry = nextCarry;

        for (const ev of events) {
          const payload = (ev.data ?? {}) as {
            text?: string;
            item?: CorrectionItem | RhetoricalInsightItem;
            result?: ProofreadResult;
            containsQuranicText?: boolean;
            isPoetryOrRhetoric?: boolean;
            error?: string;
          };

          if (ev.event === 'error') {
            throw new Error(payload.error || 'حدث خطأ أثناء البث المباشر للتدقيق.');
          } else if (ev.event === 'meta' || ev.event === 'nature') {
            if (payload.containsQuranicText || payload.isPoetryOrRhetoric) {
              streamedResult = {
                ...streamedResult,
                containsQuranicText: Boolean(
                  streamedResult.containsQuranicText || payload.containsQuranicText,
                ),
                isPoetryOrRhetoric: Boolean(
                  streamedResult.isPoetryOrRhetoric || payload.isPoetryOrRhetoric,
                ),
              };
              if (receivedFirstChunk) {
                setResult({ ...streamedResult });
              }
            }
          } else if (ev.event === 'correctedText' && typeof payload.text === 'string') {
            ensureStreamInitialized();
            streamedResult = { ...streamedResult, correctedText: payload.text };
            setResult({ ...streamedResult });
          } else if (ev.event === 'summary' && typeof payload.text === 'string') {
            ensureStreamInitialized();
            streamedResult = { ...streamedResult, summary: payload.text };
            setResult({ ...streamedResult });
          } else if (ev.event === 'correction' && payload.item) {
            ensureStreamInitialized();
            streamedResult = {
              ...streamedResult,
              corrections: [...streamedResult.corrections, payload.item as CorrectionItem],
            };
            setResult({ ...streamedResult });
          } else if (ev.event === 'rhetoricalInsight' && payload.item) {
            ensureStreamInitialized();
            streamedResult = {
              ...streamedResult,
              isPoetryOrRhetoric: true,
              rhetoricalInsights: [
                ...(streamedResult.rhetoricalInsights ?? []),
                payload.item as RhetoricalInsightItem,
              ],
            };
            setResult({ ...streamedResult });
          } else if (ev.event === 'done' && payload.result) {
            finalPayload = payload.result;
            setResult(payload.result);
          }
        }
      }

      if (finalPayload) {
        setViewMode(finalPayload.corrections.length > 0 ? 'highlights' : 'edit');
        const newEntry: ProofreadHistoryEntry = {
          id: `hist-${Date.now()}`,
          createdAt: new Date().toISOString(),
          mode,
          originalText: inputText,
          result: finalPayload,
        };
        setHistory((prev) => [newEntry, ...prev].slice(0, 20));
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const message =
        err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بخادم التدقيق.';
      setApiError(message);
    } finally {
      if (proofreadAbortRef.current === controller) {
        setIsLoading(false);
        setIsStreaming(false);
      }
    }
  }, [inputText, mode, preserveStyle, textNature]);

  const runTashkeel = useCallback(async (sourceText: string) => {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setValidationError('يرجى إدخال نص عربي في المحرر قبل طلب التشكيل.');
      textareaRef.current?.focus();
      return;
    }

    tashkeelAbortRef.current?.abort();
    const controller = new AbortController();
    tashkeelAbortRef.current = controller;

    setActiveTab('proofread');
    setValidationError(null);
    setApiError(null);
    setIsTashkeelLoading(true);
    setIsTashkeelStreaming(false);

    let receivedFirst = false;
    let streamedTashkeel: TashkeelResult = { vocalizedText: '', notes: '' };

    try {
      const response = await fetch('/api/tashkeel/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText, level: 'full' }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || 'تعذّر تشكيل النص حالياً.');
      }

      if (!response.body) {
        throw new Error('تعذّر فتح قناة البث المباشر للتشكيل.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let carry = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const { events, nextCarry } = parseSseChunk(
          decoder.decode(value, { stream: true }),
          carry,
        );
        carry = nextCarry;

        for (const ev of events) {
          const payload = (ev.data ?? {}) as {
            text?: string;
            vocalizedText?: string;
            notes?: string;
            error?: string;
          };
          if (ev.event === 'error') {
            throw new Error(payload.error || 'حدث خطأ أثناء البث المباشر للتشكيل.');
          } else if (ev.event === 'vocalizedText' && typeof payload.text === 'string') {
            if (!receivedFirst) {
              receivedFirst = true;
              setIsTashkeelLoading(false);
              setIsTashkeelStreaming(true);
            }
            streamedTashkeel = { ...streamedTashkeel, vocalizedText: payload.text };
            setTashkeelResult({ ...streamedTashkeel });
          } else if (ev.event === 'notes' && typeof payload.text === 'string') {
            if (!receivedFirst) {
              receivedFirst = true;
              setIsTashkeelLoading(false);
              setIsTashkeelStreaming(true);
            }
            streamedTashkeel = { ...streamedTashkeel, notes: payload.text };
            setTashkeelResult({ ...streamedTashkeel });
          } else if (ev.event === 'done' && typeof payload.vocalizedText === 'string') {
            setTashkeelResult({
              vocalizedText: payload.vocalizedText,
              notes: payload.notes || '',
            });
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const message =
        err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بخادم التشكيل.';
      setApiError(message);
    } finally {
      if (tashkeelAbortRef.current === controller) {
        setIsTashkeelLoading(false);
        setIsTashkeelStreaming(false);
      }
    }
  }, []);

  const runIrab = useCallback(
    async (targetText: string, contextSentence: string, irabMode: 'word' | 'sentence') => {
      setActiveTab('irab');
      setSelectedIrabTarget(targetText);
      setLastIrabRequest({ targetText, contextSentence, mode: irabMode });
      setIrabError(null);
      setIsIrabLoading(true);

      try {
        const response = await fetch('/api/irab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetText,
            contextSentence,
            mode: irabMode,
          }),
        });
        const data = (await response.json()) as IrabResult & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'تعذّر استخراج الإعراب النحوي.');
        }
        setIrabResult(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'حدث خطأ أثناء استخراج الإعراب.';
        setIrabError(message);
      } finally {
        setIsIrabLoading(false);
      }
    },
    [],
  );

  const handleDetailedIrab = useCallback(
    (sourceText: string) => {
      const trimmed = sourceText.trim();
      if (!trimmed) {
        setValidationError('يرجى إدخال نص عربي في المحرر قبل طلب الإعراب المفصل.');
        textareaRef.current?.focus();
        return;
      }
      setValidationError(null);
      const sentences = splitArabicSentences(trimmed);
      const target = sentences[0] || trimmed;
      void runIrab(target, target, 'sentence');
    },
    [runIrab],
  );

  const runEloquence = useCallback(async () => {
    const textForEloquence = tashkeelResult?.vocalizedText || result?.correctedText || inputText;
    if (!textForEloquence.trim()) {
      setValidationError('يرجى إدخال نص عربي قبل طلب البدائل البلاغية.');
      return;
    }

    setActiveTab('eloquence');
    setEloquenceError(null);
    setIsEloquenceLoading(true);
    setAppliedReplacements({});

    try {
      const response = await fetch('/api/eloquence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textForEloquence }),
      });
      const data = (await response.json()) as EloquenceResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'تعذّر استخراج البدائل البلاغية.');
      }
      setEloquenceResult(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'حدث خطأ أثناء جلب البدائل البلاغية.';
      setEloquenceError(message);
    } finally {
      setIsEloquenceLoading(false);
    }
  }, [inputText, result, tashkeelResult]);

  const handleSendAdvisorMessage = useCallback(
    async (question: string) => {
      advisorAbortRef.current?.abort();
      const controller = new AbortController();
      advisorAbortRef.current = controller;

      const userMsg: AdvisorMessage = {
        id: `adv-u-${Date.now()}`,
        role: 'user',
        text: question,
        createdAt: new Date().toISOString(),
      };
      const modelMsgId = `adv-m-${Date.now() + 1}`;

      const priorHistory = normalizeAdvisorHistory(advisorMessages);
      setAdvisorMessages((prev) => [...prev, userMsg]);
      setAdvisorError(null);
      setIsAdvisorLoading(true);

      let appendedModelBubble = false;
      let accumulatedText = '';

      try {
        const response = await fetch('/api/advisor/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: question,
            editorText: inputText,
            correctedText: tashkeelResult?.vocalizedText || result?.correctedText || '',
            history: priorHistory,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || 'تعذّر الحصول على رد من المستشار اللغوي.');
        }

        if (!response.body) {
          throw new Error('تعذّر فتح قناة البث المباشر للمستشار اللغوي.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let carry = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const { events, nextCarry } = parseSseChunk(
            decoder.decode(value, { stream: true }),
            carry,
          );
          carry = nextCarry;

          for (const ev of events) {
            const payload = (ev.data ?? {}) as {
              text?: string;
              reply?: string;
              error?: string;
            };
            if (ev.event === 'error') {
              throw new Error(payload.error || 'حدث خطأ أثناء البث المباشر.');
            } else if (ev.event === 'delta' && typeof payload.text === 'string') {
              accumulatedText += payload.text;
              if (!appendedModelBubble) {
                appendedModelBubble = true;
                setAdvisorMessages((prev) => [
                  ...prev,
                  {
                    id: modelMsgId,
                    role: 'model',
                    text: accumulatedText,
                    createdAt: new Date().toISOString(),
                  },
                ]);
              } else {
                setAdvisorMessages((prev) =>
                  prev.map((m) => (m.id === modelMsgId ? { ...m, text: accumulatedText } : m)),
                );
              }
            } else if (ev.event === 'done' && typeof payload.reply === 'string') {
              const finalReply = payload.reply;
              if (!appendedModelBubble) {
                appendedModelBubble = true;
                setAdvisorMessages((prev) => [
                  ...prev,
                  {
                    id: modelMsgId,
                    role: 'model',
                    text: finalReply,
                    createdAt: new Date().toISOString(),
                  },
                ]);
              } else {
                setAdvisorMessages((prev) =>
                  prev.map((m) => (m.id === modelMsgId ? { ...m, text: finalReply } : m)),
                );
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        const message =
          err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بالمستشار اللغوي.';
        setAdvisorError(message);
      } finally {
        if (advisorAbortRef.current === controller) {
          setIsAdvisorLoading(false);
        }
      }
    },
    [advisorMessages, inputText, result, tashkeelResult],
  );

  const handleLoadSample = (sample: SampleTextItem) => {
    setInputText(sample.text);
    setResult(null);
    setTashkeelResult(null);
    setIrabResult(null);
    setEloquenceResult(null);
    setApiError(null);
    setValidationError(null);
    setViewMode('edit');
    setActiveTab('proofread');
    setAppliedCorrectionIds(new Set());
    setSelectedCorrectionId(null);
    textareaRef.current?.focus();
  };

  const handleClear = () => {
    setInputText('');
    setResult(null);
    setTashkeelResult(null);
    setIrabResult(null);
    setEloquenceResult(null);
    setApiError(null);
    setValidationError(null);
    setViewMode('edit');
    setAppliedCorrectionIds(new Set());
    setSelectedCorrectionId(null);
    textareaRef.current?.focus();
  };

  const handleReplaceEditorWithText = (newText: string) => {
    setInputText(newText);
    setViewMode('edit');
    if (result) {
      setAppliedCorrectionIds(new Set(result.corrections.map((c) => c.id)));
    }
  };

  const handleApplySingleCorrection = (correction: CorrectionItem) => {
    const { updatedText, applied } = applySingleCorrection(inputText, correction);
    if (applied) {
      setInputText(updatedText);
    }
    setAppliedCorrectionIds((prev) => {
      const next = new Set(prev);
      next.add(correction.id);
      return next;
    });
  };

  const handleApplyAlternative = (
    suggestionId: string,
    originalPhrase: string,
    replacement: string,
  ) => {
    const baseText = result?.correctedText || inputText;
    const { updatedText, replaced } = replacePhraseInText(baseText, originalPhrase, replacement);
    if (replaced) {
      if (result) {
        setResult({ ...result, correctedText: updatedText });
      }
      setInputText((prev) => {
        const direct = replacePhraseInText(prev, originalPhrase, replacement);
        return direct.replaced ? direct.updatedText : updatedText;
      });
    }
    setAppliedReplacements((prev) => ({ ...prev, [suggestionId]: replacement }));
  };

  const handleSelectCorrection = (correction: CorrectionItem) => {
    setSelectedCorrectionId(correction.id);
    const el = document.getElementById(`correction-item-${correction.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleRestoreHistory = (entry: ProofreadHistoryEntry) => {
    setInputText(entry.originalText);
    setMode(entry.mode === 'orthography_grammar' ? 'orthography_grammar' : 'comprehensive');
    setResult(entry.result);
    setTashkeelResult(null);
    setActiveTab('proofread');
    setApiError(null);
    setValidationError(null);
    setAppliedCorrectionIds(new Set());
    setViewMode(entry.result.corrections.length > 0 ? 'highlights' : 'edit');
  };

  const handleJumpToEditor = () => {
    document.getElementById('editor-workspace')?.scrollIntoView({ behavior: 'smooth' });
    textareaRef.current?.focus();
  };

  const handleJumpToSamples = () => {
    samplesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleJumpToRules = () => {
    document.getElementById('grammar-guide')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTryRuleExample = (example: string) => {
    setInputText(`الجملة المراد فحصها: ${example}.`);
    setResult(null);
    setTashkeelResult(null);
    setApiError(null);
    setValidationError(null);
    setViewMode('edit');
    setActiveTab('proofread');
    handleJumpToEditor();
  };

  const handleQuickReplacePattern = (matchedText: string, suggestion: string) => {
    const { updatedText, replaced } = replacePhraseInText(inputText, matchedText, suggestion);
    if (replaced) {
      setInputText(updatedText);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] dark:bg-[#0b111a] text-slate-900 dark:text-slate-100">
      <HeaderBar
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenAdvisor={() => setIsAdvisorOpen(true)}
        onJumpToSamples={handleJumpToSamples}
        onJumpToRules={handleJumpToRules}
        onJumpToEditor={handleJumpToEditor}
        onRunProofread={handleProofread}
        isLoading={isLoading}
      />

      <main className="flex-1 mx-auto w-full max-w-[1360px] px-4 py-7 sm:px-6 lg:px-8">
        {/* Editorial Intro + Workspace Controls */}
        <section id="editor-workspace" className="mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-2xl">
              <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
                فَصيح — المدقق اللغوي العربي الخبير
              </h1>
              <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                منصة متكاملة للتصحيح الإملائي والنحوي، والضبط التام بالتشكيل، والإعراب التفصيلي، والبدائل البلاغية.
              </p>
            </div>

            {/* Mode, Theme & Advisor Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                role="group"
                aria-label="نطاق التدقيق اللغوي"
                className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1"
              >
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      mode === opt.id
                        ? 'bg-emerald-800 dark:bg-emerald-700 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={preserveStyle}
                  onChange={(e) => setPreserveStyle(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 text-emerald-800 focus:ring-emerald-700"
                />
                <span>الحفاظ على أسلوب الكاتب</span>
              </label>

              <button
                type="button"
                onClick={handleToggleTheme}
                aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-700 dark:hover:border-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    <span>الوضع النهاري</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                    <span>الوضع الليلي</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sample Text Quick Loaders + Engine Indicator + Direct Advisor CTA */}
          <div
            ref={samplesRef}
            className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-500 dark:text-slate-400 ml-1">نماذج تطبيقية:</span>
              {SAMPLE_TEXTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleLoadSample(sample)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-700 dark:hover:border-emerald-500 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {sample.title}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                data-testid="engine-thinking-indicator"
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  textNature.requiresDeepThinking
                    ? 'text-amber-800 dark:text-amber-300'
                    : textNature.containsQuranicText
                      ? 'text-emerald-900 dark:text-emerald-300'
                      : 'text-emerald-800 dark:text-emerald-400'
                }`}
              >
                {textNature.requiresDeepThinking ? (
                  <>
                    <BrainCircuit className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {textNature.containsQuranicText
                        ? 'آية قرآنية بالرسم العثماني · تحليل عميق تلقائي'
                        : 'تحليل عميق تلقائي · شعر وبلاغة'}
                    </span>
                  </>
                ) : textNature.containsQuranicText ? (
                  <>
                    <BookOpenCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>آية قرآنية بالرسم العثماني</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>استجابة فورية · Gemini Flash</span>
                  </>
                )}
              </span>

              <button
                type="button"
                onClick={() => setIsAdvisorOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/30 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                اسأل المستشار اللغوي
              </button>
            </div>
          </div>
        </section>

        {/* Two-Column Proofreading Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-6 flex flex-col">
            <EditorPane
              inputText={inputText}
              onChangeText={handleChangeText}
              onProofread={handleProofread}
              onFullTashkeel={() => runTashkeel(inputText)}
              onDetailedIrab={() => handleDetailedIrab(inputText)}
              onClear={handleClear}
              isLoading={isLoading}
              isTashkeelLoading={isTashkeelLoading}
              isIrabLoading={isIrabLoading}
              validationError={validationError}
              stats={stats}
              viewMode={viewMode}
              onToggleViewMode={setViewMode}
              hasHighlights={Boolean(result && result.corrections.length > 0)}
              segments={highlightedSegments}
              selectedCorrectionId={selectedCorrectionId}
              onSelectCorrection={handleSelectCorrection}
              onInspectWordIrab={(word, sentence) => runIrab(word, sentence, 'word')}
              selectedIrabWord={selectedIrabTarget}
              textareaRef={textareaRef}
            />
          </div>

          <div className="lg:col-span-6 flex flex-col">
            <ResultsPane
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              activeText={inputText}
              result={result}
              tashkeelResult={tashkeelResult}
              isLoading={isLoading}
              isStreaming={isStreaming}
              isTashkeelLoading={isTashkeelLoading}
              isTashkeelStreaming={isTashkeelStreaming}
              detectedQuranic={textNature.containsQuranicText}
              error={apiError}
              onRetry={handleProofread}
              onFullTashkeelOnOutput={() =>
                runTashkeel(result?.correctedText || inputText)
              }
              onDetailedIrabOnOutput={() =>
                handleDetailedIrab(
                  tashkeelResult?.vocalizedText || result?.correctedText || inputText,
                )
              }
              onReplaceEditorWithText={handleReplaceEditorWithText}
              onApplySingleCorrection={handleApplySingleCorrection}
              appliedCorrectionIds={appliedCorrectionIds}
              selectedCorrectionId={selectedCorrectionId}
              onSelectCorrection={handleSelectCorrection}
              samples={SAMPLE_TEXTS}
              onLoadSample={handleLoadSample}
              irabResult={irabResult}
              selectedIrabTarget={selectedIrabTarget}
              isIrabLoading={isIrabLoading}
              irabError={irabError}
              onInspectWordIrab={(word, sentence) => runIrab(word, sentence, 'word')}
              onInspectSentenceIrab={(sentence) => runIrab(sentence, sentence, 'sentence')}
              onRetryIrab={() => {
                if (lastIrabRequest) {
                  runIrab(
                    lastIrabRequest.targetText,
                    lastIrabRequest.contextSentence,
                    lastIrabRequest.mode,
                  );
                }
              }}
              eloquenceResult={eloquenceResult}
              isEloquenceLoading={isEloquenceLoading}
              eloquenceError={eloquenceError}
              onGenerateEloquence={runEloquence}
              onApplyAlternative={handleApplyAlternative}
              appliedReplacements={appliedReplacements}
            />
          </div>
        </div>

        {/* Common Mistakes & Linguistic Reference */}
        <RulesGuideSection
          detectedPatterns={detectedPatterns}
          onTryExample={handleTryRuleExample}
          onQuickReplacePattern={handleQuickReplacePattern}
        />
      </main>

      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-3 px-4 py-5 text-xs text-slate-500 dark:text-slate-400 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>فَصيح للتدقيق اللغوي العربي · نحو وإملاء وتشكيل وإعراب وبلاغة</span>
            <span>جميع التصحيحات مشفوعة بتوضيح القاعدة اللغوية</span>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 text-center font-medium text-slate-600 dark:text-slate-300">
            تطوير وبرمجة: محمد سليم دويكات © 2026
          </div>
        </div>
      </footer>

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        entries={history}
        onRestoreEntry={handleRestoreHistory}
        onClearHistory={() => setHistory([])}
      />

      <LinguisticAdvisorDrawer
        isOpen={isAdvisorOpen}
        onClose={() => setIsAdvisorOpen(false)}
        editorText={inputText}
        correctedText={tashkeelResult?.vocalizedText || result?.correctedText}
        messages={advisorMessages}
        isLoading={isAdvisorLoading}
        error={advisorError}
        onSendMessage={handleSendAdvisorMessage}
        onResetChat={() => {
          setAdvisorMessages([]);
          setAdvisorError(null);
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    </div>
  );
}
