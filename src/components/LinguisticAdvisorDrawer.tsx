import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  MessageSquareText,
  Moon,
  RotateCcw,
  Send,
  Sun,
  X,
} from 'lucide-react';
import type { AdvisorMessage, ThemeMode } from '../types/proofread';
import {
  ADVISOR_QUICK_PROMPTS,
  buildAdvisorContextPreview,
} from '../utils/advisorContext';

interface LinguisticAdvisorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editorText: string;
  correctedText?: string;
  messages: AdvisorMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (messageText: string) => void;
  onResetChat: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const LinguisticAdvisorDrawer: React.FC<LinguisticAdvisorDrawerProps> = ({
  isOpen,
  onClose,
  editorText,
  correctedText,
  messages,
  isLoading,
  error,
  onSendMessage,
  onResetChat,
  theme,
  onToggleTheme,
}) => {
  const [draft, setDraft] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const contextPreview = useMemo(
    () => buildAdvisorContextPreview(editorText, correctedText),
    [editorText, correctedText],
  );

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isLoading]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = draft.trim();
      if (!trimmed || isLoading) return;
      onSendMessage(trimmed);
      setDraft('');
    }
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex justify-end" dir="rtl">
      {/* Subtle click-away backdrop on smaller viewports; unobtrusive on desktop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/35 lg:bg-slate-950/15 pointer-events-auto transition-opacity"
      />

      <aside
        role="dialog"
        aria-modal="false"
        aria-labelledby="advisor-drawer-title"
        data-testid="linguistic-advisor-drawer"
        className="pointer-events-auto relative z-10 flex h-full w-full sm:w-[440px] flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/80 dark:bg-slate-900/95">
          <div className="flex items-center gap-2.5 min-w-0">
            <MessageSquareText
              className="h-5 w-5 text-emerald-800 dark:text-emerald-400 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2
                id="advisor-drawer-title"
                className="text-sm font-bold text-slate-950 dark:text-slate-50 truncate"
              >
                اسأل المستشار اللغوي
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                تفكير عميق · مرتبطة بسياق المحرر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
              title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
              className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={onResetChat}
                aria-label="محادثة جديدة"
                title="محادثة جديدة"
                className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق المستشار اللغوي"
              className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Active Editor Context Bar */}
        <div
          data-testid="advisor-context-bar"
          className="border-b border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/30 px-5 py-3"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 mb-1">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {contextPreview.hasContext ? 'مرتبط بسياق المحرر النشط' : 'بدون نص في المحرر'}
            </span>
            {contextPreview.hasContext && (
              <span className="tabular-nums text-emerald-800/80 dark:text-emerald-400/90">
                {contextPreview.wordCount} كلمة
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 line-clamp-2">
            {contextPreview.previewText}
          </p>
        </div>

        {/* Conversation Body */}
        <div
          data-testid="advisor-messages-list"
          className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#fafbfc] dark:bg-slate-950/60"
        >
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
                <p className="font-serif text-lg font-bold text-slate-900 dark:text-slate-100">
                  أهلاً بك في مجلس المستشار اللغوي
                </p>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  اطرح أي سؤال حول النص الموجود في المحرر—عن علل الإعراب، أو الشواهد الشعرية والنثرية، أو الصور البلاغية، وسيجيبك المستشار بأسلوب أكاديمي رصين وميسّر.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  أسئلة مقترحة مرتبطة بنصك:
                </p>
                <div className="flex flex-col gap-2">
                  {ADVISOR_QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="text-right rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-emerald-700 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-emerald-800 text-white'
                        : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-[11px] opacity-80">
                      <span className="font-semibold">
                        {isUser ? 'أنت' : 'المستشار اللغوي'}
                      </span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-emerald-800 dark:hover:text-emerald-400 cursor-pointer"
                          aria-label="نسخ الإجابة"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                              <span>نُسخت</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" aria-hidden="true" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className={isUser ? '' : 'font-sans text-[13.5px] leading-[1.85]'}>
                      {msg.text || (isLoading ? '...' : '')}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isLoading && messages[messages.length - 1]?.role !== 'model' && (
            <div className="flex items-end flex-col">
              <div
                aria-busy="true"
                className="w-4/5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2"
              >
                <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2"
        >
          <label htmlFor="advisor-question-input" className="sr-only">
            اكتب سؤالك للمستشار اللغوي
          </label>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              id="advisor-question-input"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اسأل: لماذا نُصبت هذه الكلمة؟ أو ما الشاهد الشعري هنا؟"
              className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-700 dark:focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || isLoading}
              aria-label="إرسال السؤال"
              className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-lg bg-emerald-800 dark:bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-900 dark:hover:bg-emerald-600 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              إرسال
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            اضغط Enter للإرسال · يدعم الأسئلة المتتابعة حول النص الحالي
          </p>
        </form>
      </aside>
    </div>
  );
};
