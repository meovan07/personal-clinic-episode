"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import { Check, CircleAlert, MessageSquarePlus, Send, Sparkles, Square, X } from "lucide-react";

// What each read tool is doing, shown as a small status line while the agent works.
const TOOL_LABEL: Record<string, string> = {
  search_records: "Tìm trong hồ sơ",
  get_person_overview: "Xem hồ sơ",
  list_visits: "Xem các lần khám",
  get_visit: "Đọc chi tiết lần khám",
  get_test_history: "Xem lịch sử chỉ số",
  list_todos: "Xem việc cần làm",
  list_vaccinations: "Xem sổ tiêm chủng",
  get_calendar: "Xem lịch",
};

const SUGGESTIONS = [
  "LDL của Hưng thay đổi thế nào?",
  "Sắp tới có lịch hẹn hay việc gì cần làm?",
  "Lần khám gần nhất của Mai có gì bất thường?",
  "Hưng đã tiêm những mũi gì?",
];

function ToolStatus({ part }: { part: Parameters<typeof getToolName>[0] }) {
  const label = TOOL_LABEL[getToolName(part)] ?? getToolName(part);
  const done = part.state === "output-available";
  const failed = part.state === "output-error";
  return (
    <div className="flex items-center gap-1.5 text-xs text-ink-soft">
      {done ? (
        <Check className="h-3.5 w-3.5 text-flag-normal" strokeWidth={2} />
      ) : failed ? (
        <CircleAlert className="h-3.5 w-3.5 text-stamp" strokeWidth={2} />
      ) : (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-pine" />
      )}
      {label}
      {failed && " · không lấy được dữ liệu"}
    </div>
  );
}

function AssistantText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const components: Components = {
    p: ({ children }) => <p className="mt-2 leading-relaxed first:mt-0">{children}</p>,
    ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-ink-faint">{children}</ul>,
    ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
    h2: ({ children }) => <h3 className="mt-3 font-semibold text-pine">{children}</h3>,
    h3: ({ children }) => <h3 className="mt-3 font-semibold text-pine">{children}</h3>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    table: ({ children }) => (
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">{children}</table>
      </div>
    ),
    th: ({ children }) => <th className="border-b border-line px-2 py-1 font-medium text-ink-soft">{children}</th>,
    td: ({ children }) => <td className="border-b border-line px-2 py-1">{children}</td>,
    // Only links into the app are followed; anything else is shown as plain text.
    a: ({ href, children }) =>
      href?.startsWith("/") ? (
        <Link href={href} onClick={onNavigate} className="text-pen underline underline-offset-2">
          {children}
        </Link>
      ) : (
        <span>{children}</span>
      ),
  };
  return <ReactMarkdown components={components}>{text}</ReactMarkdown>;
}

function Message({ message, onNavigate }: { message: UIMessage; onNavigate: () => void }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-pine px-3 py-2 text-white">{text}</div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 text-sm">
      {message.parts.map((part, i) =>
        part.type === "text" ? (
          <AssistantText key={i} text={part.text} onNavigate={onNavigate} />
        ) : isToolUIPart(part) ? (
          <ToolStatus key={i} part={part} />
        ) : null,
      )}
    </div>
  );
}

// Phase 8a: read-only assistant. Opened from a button stacked above the "+" (the "+" menu comes in 8d).
// Mounted once in the layout so a conversation survives navigating to a linked page.
export function AssistantChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, error, regenerate, setMessages } = useChat();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, status]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  // On phones the panel covers the page, so following a link closes it; on wider screens it stays open beside it.
  function onNavigate() {
    if (window.innerWidth < 640) setOpen(false);
  }

  // Review pages have their own sticky action bar in that corner.
  if (pathname.endsWith("/review")) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Hỏi trợ lý AI"
          title="Hỏi trợ lý AI"
          className="fixed bottom-[9.5rem] right-5 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-pine shadow-lg hover:bg-paper-dim sm:bottom-[5.75rem] sm:right-6"
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Trợ lý AI"
          className="fixed inset-0 z-40 flex flex-col bg-surface pt-[env(safe-area-inset-top)] sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(42rem,calc(100vh-2.5rem))] sm:w-[26rem] sm:rounded-2xl sm:border sm:border-line sm:pt-0 sm:shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-pine">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
                Trợ lý AI
              </div>
              <p className="text-xs text-ink-soft">Chỉ đọc hồ sơ, chưa thêm hay sửa được dữ liệu.</p>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    stop();
                    setMessages([]);
                  }}
                  className="text-ink-soft hover:text-ink"
                  aria-label="Cuộc trò chuyện mới"
                  title="Cuộc trò chuyện mới"
                >
                  <MessageSquarePlus className="h-5 w-5" strokeWidth={1.75} />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink" aria-label="Đóng">
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
            {messages.length === 0 && (
              <div>
                <p className="muted mb-3">Hỏi về các lần khám, chỉ số xét nghiệm, thuốc, lịch hẹn hay tiêm chủng. Ví dụ:</p>
                <div className="flex flex-col items-start gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" className="btn text-left" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <Message key={m.id} message={m} onNavigate={onNavigate} />
            ))}
            {status === "submitted" && (
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-pine" />
                Đang suy nghĩ…
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-stamp-tint px-3 py-2 text-sm text-stamp">
                {error.message || "Trợ lý gặp lỗi khi trả lời."}{" "}
                <button type="button" className="underline" onClick={() => regenerate()}>
                  Thử lại
                </button>
              </div>
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-line px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Hỏi về hồ sơ của hai bạn…"
              aria-label="Tin nhắn"
              className="input max-h-32 min-h-10 flex-1 resize-none"
            />
            {busy ? (
              <button type="button" onClick={() => stop()} className="btn h-10 w-10 shrink-0 px-0" aria-label="Dừng">
                <Square className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="btn-primary h-10 w-10 shrink-0 px-0" aria-label="Gửi">
                <Send className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
