"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  History,
  MessageSquarePlus,
  Paperclip,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { createInboxItem, type UploadedFile } from "@/app/actions";
import { ApprovalCard, isApprovalPart } from "@/components/ApprovalCard";
import type { DocumentAttachment } from "@/lib/agent/attachments";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, formatDate } from "@/lib/format";
import { hashAndCheckDuplicates, rollbackUpload, uploadToStorage } from "@/lib/upload";

// What each tool is doing, shown as a small status line while the agent works.
const TOOL_LABEL: Record<string, string> = {
  search_records: "Tìm trong hồ sơ",
  get_person_overview: "Xem hồ sơ",
  list_visits: "Xem các lần khám",
  get_visit: "Đọc chi tiết lần khám",
  get_test_history: "Xem lịch sử chỉ số",
  list_todos: "Xem việc cần làm",
  list_vaccinations: "Xem sổ tiêm chủng",
  get_calendar: "Xem lịch",
  read_document: "Đọc tài liệu",
  // Write tools show this only while the change is being prepared; then the approval card takes over.
  create_case: "Soạn bệnh án mới",
  update_case: "Soạn thay đổi bệnh án",
  delete_case: "Chuẩn bị xoá bệnh án",
  create_visit: "Soạn lần khám mới",
  update_visit: "Soạn thay đổi lần khám",
  delete_visit: "Chuẩn bị xoá lần khám",
  delete_document: "Chuẩn bị xoá tài liệu",
  add_medication: "Soạn thuốc mới",
  delete_medication: "Chuẩn bị xoá thuốc",
  add_todo: "Soạn việc cần làm",
  update_todo: "Soạn thay đổi việc cần làm",
  delete_todo: "Chuẩn bị xoá việc cần làm",
  add_vaccination: "Soạn mũi tiêm",
  delete_vaccination: "Chuẩn bị xoá mũi tiêm",
  save_document: "Chuẩn bị lưu tài liệu",
  discard_document: "Chuẩn bị bỏ tài liệu",
};

const SUGGESTIONS = [
  "LDL của Hưng thay đổi thế nào?",
  "Sắp tới có lịch hẹn hay việc gì cần làm?",
  "Lần khám gần nhất của Mai có gì bất thường?",
  "Hưng đã tiêm những mũi gì?",
  "Nhắc Mai tái khám sau 2 tuần",
];

// The conversation that was open last, so a reload continues it. Per-browser convenience only.
const THREAD_KEY = "assistant.thread";

type View = "chat" | "history" | "memory";
type ToolPart = Parameters<typeof getToolName>[0];
type Answer = (id: string, approved: boolean) => void;

function readStoredThread(): string | null {
  try {
    return localStorage.getItem(THREAD_KEY);
  } catch {
    return null;
  }
}

function storeThread(id: string) {
  try {
    localStorage.setItem(THREAD_KEY, id);
  } catch {
    // Private mode etc.: the conversation is still saved server-side, just not reopened automatically.
  }
}

async function loadThreadMessages(threadId: string): Promise<UIMessage[]> {
  const { data } = await createClient()
    .from("chat_messages")
    .select("id, role, parts")
    .eq("thread_id", threadId)
    .order("seq");
  return (data ?? []).map((r) => ({
    id: r.id,
    role: r.role as UIMessage["role"],
    parts: r.parts as UIMessage["parts"],
  }));
}

function ToolStatus({ part }: { part: ToolPart }) {
  const name = getToolName(part);
  const done = part.state === "output-available";
  const failed = part.state === "output-error";

  const label = TOOL_LABEL[name] ?? name;
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
      {!done && !failed && name === "read_document" && " (khoảng 30-60 giây)"}
      {failed && " · không thực hiện được"}
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

function Message({
  message,
  onNavigate,
  onAnswer,
  canAnswer,
}: {
  message: UIMessage;
  onNavigate: () => void;
  onAnswer: Answer;
  canAnswer: boolean;
}) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    const attached = message.parts.flatMap((p) =>
      p.type === "data-document" ? (p.data as DocumentAttachment).files : [],
    );
    return (
      <div className="flex flex-col items-end gap-1">
        {attached.length > 0 && (
          <div className="flex max-w-[85%] items-start gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft">
            <Paperclip className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0 break-words">{attached.join(", ")}</span>
          </div>
        )}
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-pine px-3 py-2 text-white">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 text-sm">
      {message.parts.map((part, i) =>
        part.type === "text" ? (
          <AssistantText key={i} text={part.text} onNavigate={onNavigate} />
        ) : isToolUIPart(part) ? (
          isApprovalPart(part) ? (
            <ApprovalCard key={i} part={part} onAnswer={onAnswer} canAnswer={canAnswer} onNavigate={onNavigate} />
          ) : (
            <ToolStatus key={i} part={part} />
          )
        ) : null,
      )}
    </div>
  );
}

// One conversation. Keyed by thread id in the parent, so switching threads starts a fresh useChat.
function ChatSession({
  threadId,
  initialMessages,
  onNavigate,
  focusKey,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onNavigate: () => void;
  focusKey: number;
}) {
  const [input, setInput] = useState("");
  const router = useRouter();
  const { messages, sendMessage, status, stop, error, regenerate, addToolApprovalResponse } = useChat({
    id: threadId,
    messages: initialMessages,
    // Once every card in the last answer is approved or declined, the conversation continues by itself.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // The server keeps the history; only the newest message travels.
      prepareSendMessagesRequest: ({ messages, id }) => ({ body: { id, message: messages[messages.length - 1] } }),
    }),
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusKey]);

  // When an approved change has been saved, refresh the page behind the chat so it shows it.
  const savedChanges = useRef<Set<string> | null>(null);
  useEffect(() => {
    const done = messages
      .flatMap((m) => m.parts)
      .filter((p) => isToolUIPart(p) && p.state === "output-available" && p.approval && !p.approval.isAutomatic)
      .map((p) => (p as ToolPart).toolCallId);
    const seen = savedChanges.current;
    savedChanges.current = new Set(done);
    if (seen && done.some((id) => !seen.has(id))) router.refresh();
  }, [messages, router]);

  // Photos/PDFs picked for the next message. Uploaded into the inbox (like the "+" button) when sent,
  // so the assistant can read them on the server; kept locally until then so several camera trips add up.
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || busy || uploading) return;
    storeThread(threadId);
    if (files.length === 0) {
      sendMessage({ text: trimmed });
      setInput("");
      return;
    }

    setUploadError(null);
    const supabase = createClient();
    let uploaded: UploadedFile[] = [];
    try {
      setUploading("Đang kiểm tra…");
      const hashes = await hashAndCheckDuplicates(files);
      uploaded = await uploadToStorage(supabase, files, hashes, "inbox", (i, total) =>
        setUploading(`Đang tải ${i + 1}/${total}…`),
      );
      const { id } = await createInboxItem(uploaded);
      const attachment: DocumentAttachment = { inbox_id: id, files: files.map((f) => f.name) };
      sendMessage({
        role: "user",
        parts: [
          { type: "text", text: trimmed || "Đọc và lưu giúp mình tài liệu này." },
          { type: "data-document", data: attachment },
        ],
      });
      setFiles([]);
      setInput("");
    } catch (e) {
      await rollbackUpload(supabase, uploaded);
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  }

  return (
    <>
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 && (
          <div>
            <p className="muted mb-3">
              Hỏi về các lần khám, chỉ số xét nghiệm, thuốc, lịch hẹn hay tiêm chủng, nhờ ghi lại giúp, hoặc gửi ảnh/PDF
              kết quả khám bằng nút kẹp giấy (bạn xác nhận trước khi lưu). Ví dụ:
            </p>
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
          <Message
            key={m.id}
            message={m}
            onNavigate={onNavigate}
            canAnswer={!busy}
            onAnswer={(id, approved) =>
              addToolApprovalResponse({
                id,
                approved,
                // Tells the model it was the user's own choice, not an error.
                ...(approved ? {} : { reason: "The user chose not to make this change." }),
              })
            }
          />
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

      {(files.length > 0 || uploadError) && (
        <div className="space-y-1 border-t border-line px-3 pt-2 text-xs">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 text-ink-soft">
              <Paperclip className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">
                {f.name} ({formatBytes(f.size)})
              </span>
              <button
                type="button"
                className="shrink-0 text-ink-faint hover:text-stamp"
                aria-label={`Bỏ ${f.name}`}
                disabled={!!uploading}
                onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ))}
          {uploading && <p className="text-ink-soft">{uploading}</p>}
          {uploadError && <p className="text-stamp">{uploadError}</p>}
        </div>
      )}
      <form
        className="flex items-end gap-2 border-t border-line px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) {
              setUploadError(null);
              setFiles((fs) => [...fs, ...picked]);
            }
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || !!uploading}
          className="btn h-10 w-10 shrink-0 px-0"
          aria-label="Đính kèm ảnh hoặc PDF"
          title="Đính kèm ảnh hoặc PDF (nhiều trang: chọn/chụp thêm trước khi gửi)"
        >
          <Paperclip className="h-4 w-4" strokeWidth={1.75} />
        </button>
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
          maxLength={4000}
          placeholder="Hỏi hoặc nhờ cập nhật hồ sơ…"
          aria-label="Tin nhắn"
          className="input max-h-32 min-h-10 flex-1 resize-none"
        />
        {busy ? (
          <button type="button" onClick={() => stop()} className="btn h-10 w-10 shrink-0 px-0" aria-label="Dừng">
            <Square className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={(!input.trim() && files.length === 0) || !!uploading}
            className="btn-primary h-10 w-10 shrink-0 px-0"
            aria-label="Gửi"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </form>
    </>
  );
}

// Delete button for a row in the panel's lists: the first tap asks right there in the row
// (no browser confirm() popup), the second one deletes.
function InlineDelete({ label, onDelete }: { label: string; onDelete: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (!asking)
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="shrink-0 text-ink-faint hover:text-stamp"
        aria-label={label}
        title={label}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    );
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <button type="button" className="btn px-2 py-1 text-xs" disabled={deleting} onClick={() => setAsking(false)}>
        Huỷ
      </button>
      <button
        type="button"
        className="btn-danger-solid px-2 py-1 text-xs"
        disabled={deleting}
        autoFocus
        onClick={async () => {
          setDeleting(true);
          await onDelete();
        }}
      >
        {deleting ? "Đang xoá…" : "Xoá"}
      </button>
    </span>
  );
}

type ThreadRow = { id: string; title: string | null; updated_at: string };

function HistoryList({
  currentId,
  onOpen,
  onShowMemory,
}: {
  currentId: string;
  onOpen: (id: string) => void;
  onShowMemory: () => void;
}) {
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("chat_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled) setThreads(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function remove(id: string) {
    await createClient().from("chat_threads").delete().eq("id", id);
    setVersion((v) => v + 1);
  }

  const memoryLink = (
    <button
      type="button"
      onClick={onShowMemory}
      className="w-full border-t border-line px-4 py-3 text-left text-xs text-pen hover:underline"
    >
      Xem trợ lý đang nhớ gì về hai bạn
    </button>
  );
  if (!threads) return <p className="muted flex-1 px-4 py-4">Đang tải…</p>;
  if (threads.length === 0)
    return (
      <>
        <p className="muted flex-1 px-4 py-4">Chưa có cuộc trò chuyện nào.</p>
        {memoryLink}
      </>
    );
  return (
    <>
      <ul className="flex-1 divide-y divide-line overflow-y-auto">
        {threads.map((t) => (
          <li key={t.id} className={`flex items-center gap-2 px-4 py-3 ${t.id === currentId ? "bg-paper-dim" : ""}`}>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(t.id)}>
              <span className="block truncate">{t.title ?? "Cuộc trò chuyện"}</span>
              <span className="muted text-xs">{formatDate(t.updated_at)}</span>
            </button>
            <InlineDelete label="Xóa cuộc trò chuyện" onDelete={() => remove(t.id)} />
          </li>
        ))}
      </ul>
      {memoryLink}
    </>
  );
}

type MemoryRow = { id: string; content: string; updated_at: string; people: { full_name: string } | null };

function MemoryList() {
  const [memories, setMemories] = useState<MemoryRow[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("agent_memories")
      .select("id, content, updated_at, people(full_name)")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setMemories(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function remove(id: string) {
    await createClient().from("agent_memories").delete().eq("id", id);
    setVersion((v) => v + 1);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <p className="muted border-b border-line px-4 py-3 text-xs">
        Trợ lý tự ghi nhớ những điều quan trọng hai bạn kể khi trò chuyện, để trả lời sát với hoàn cảnh hơn. Cả hai
        người đều thấy danh sách này; xóa mục nào sai hoặc không muốn giữ.
      </p>
      {!memories ? (
        <p className="muted px-4 py-4">Đang tải…</p>
      ) : memories.length === 0 ? (
        <p className="muted px-4 py-4">Chưa ghi nhớ gì.</p>
      ) : (
        <ul className="divide-y divide-line">
          {memories.map((m) => (
            <li key={m.id} className="flex items-start gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p>{m.content}</p>
                <p className="muted text-xs">
                  {m.people?.full_name ?? "Chung"} · {formatDate(m.updated_at)}
                </p>
              </div>
              <InlineDelete label="Xóa khỏi trí nhớ" onDelete={() => remove(m.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Phase 8 assistant. Opened from a button stacked above the "+" (the "+" menu comes in 8d).
// Mounted once in the layout and kept mounted while closed, so an answer keeps streaming in the background.
export function AssistantChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [session, setSession] = useState<{ threadId: string; messages: UIMessage[] } | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  async function openThread(threadId: string) {
    const messages = await loadThreadMessages(threadId);
    storeThread(threadId);
    setSession({ threadId, messages });
    setView("chat");
  }

  function newThread() {
    setSession({ threadId: crypto.randomUUID(), messages: [] });
    setView("chat");
    setFocusKey((k) => k + 1);
  }

  async function openPanel() {
    setOpen(true);
    setFocusKey((k) => k + 1);
    if (session) return;
    // First open: continue the conversation from last time if there is one.
    const stored = readStoredThread();
    if (stored) await openThread(stored);
    else newThread();
  }

  // On phones the panel covers the page, so following a link closes it; on wider screens it stays open beside it.
  function onNavigate() {
    if (window.innerWidth < 640) setOpen(false);
  }

  // Review pages have their own sticky action bar in that corner.
  if (pathname.endsWith("/review")) return null;

  const headerButton = "text-ink-soft hover:text-ink";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Hỏi trợ lý AI"
          title="Hỏi trợ lý AI"
          className="fixed bottom-[9.5rem] right-5 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-pine shadow-lg hover:bg-paper-dim sm:bottom-[5.75rem] sm:right-6"
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}

      <div
        role="dialog"
        aria-label="Trợ lý AI"
        hidden={!open}
        className="fixed inset-0 z-40 flex flex-col bg-surface pt-[env(safe-area-inset-top)] sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(42rem,calc(100vh-2.5rem))] sm:w-[26rem] sm:rounded-2xl sm:border sm:border-line sm:pt-0 sm:shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          {view === "chat" ? (
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-pine">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
                Trợ lý AI
              </div>
              <p className="text-xs text-ink-soft">Hỏi hoặc nhờ cập nhật hồ sơ. Mọi thay đổi đều chờ bạn đồng ý.</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setView(view === "memory" ? "history" : "chat")}
              className="flex items-center gap-1.5 font-semibold text-pine"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              {view === "history" ? "Lịch sử trò chuyện" : "Trí nhớ của trợ lý"}
            </button>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView("history")}
              className={headerButton}
              aria-label="Lịch sử"
              title="Lịch sử"
            >
              <History className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={newThread}
              className={headerButton}
              aria-label="Cuộc trò chuyện mới"
              title="Cuộc trò chuyện mới"
            >
              <MessageSquarePlus className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <button type="button" onClick={() => setOpen(false)} className={headerButton} aria-label="Đóng">
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Kept mounted while viewing history/memory so a streaming answer isn't cut off. */}
        <div className={view === "chat" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          {session ? (
            <ChatSession
              key={session.threadId}
              threadId={session.threadId}
              initialMessages={session.messages}
              onNavigate={onNavigate}
              focusKey={focusKey}
            />
          ) : (
            <p className="muted px-4 py-4">Đang tải…</p>
          )}
        </div>
        {view === "history" && (
          <HistoryList currentId={session?.threadId ?? ""} onOpen={openThread} onShowMemory={() => setView("memory")} />
        )}
        {view === "memory" && <MemoryList />}
      </div>
    </>
  );
}
