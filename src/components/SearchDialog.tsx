"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  FlaskConical,
  FolderOpen,
  ListChecks,
  Pill,
  Search,
  Stethoscope,
  Syringe,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { formatDate } from "@/lib/format";
import { CASE_STATUS, CASE_STATUS_TONE, DOC_TYPE } from "@/lib/labels";

type Hit = Database["public"]["Functions"]["search_records"]["Returns"][number];

const FLAG: Record<string, { label: string; tone: "danger" | "low" }> = {
  high: { label: "Cao", tone: "danger" },
  low: { label: "Thấp", tone: "low" },
  abnormal: { label: "Bất thường", tone: "danger" },
};

// Display order of the result groups, and where each kind of hit links to.
const KINDS: {
  kind: string;
  label: string;
  icon: LucideIcon;
  href: (h: Hit) => string;
}[] = [
  {
    kind: "visit",
    label: "Lần khám",
    icon: Stethoscope,
    href: (h) => `/visits/${h.id}`,
  },
  {
    kind: "observation",
    label: "Chỉ số xét nghiệm",
    icon: FlaskConical,
    href: (h) => `/visits/${h.visit_id}`,
  },
  {
    kind: "document",
    label: "Tài liệu",
    icon: FileText,
    href: (h) => `/visits/${h.visit_id}`,
  },
  {
    kind: "medication",
    label: "Thuốc",
    icon: Pill,
    href: (h) => `/visits/${h.visit_id}`,
  },
  {
    kind: "case",
    label: "Bệnh án",
    icon: FolderOpen,
    href: (h) => `/cases/${h.id}`,
  },
  {
    kind: "action_item",
    label: "Việc cần làm",
    icon: ListChecks,
    href: (h) => (h.visit_id ? `/visits/${h.visit_id}` : `/people/${h.person_id}`),
  },
  {
    kind: "vaccination",
    label: "Tiêm chủng",
    icon: Syringe,
    href: (h) => `/people/${h.person_id}/vaccinations`,
  },
  {
    kind: "person",
    label: "Hồ sơ",
    icon: UserRound,
    href: (h) => `/people/${h.id}`,
  },
];

const SUGGESTIONS = ["LDL", "đường huyết", "cholesterol cao", "Medilab", "tiêm", "đơn thuốc"];

function tagBadge(h: Hit) {
  if (h.kind === "observation" && h.tag && FLAG[h.tag])
    return <Badge tone={FLAG[h.tag].tone}>{FLAG[h.tag].label}</Badge>;
  if (h.kind === "case" && h.tag) return <Badge tone={CASE_STATUS_TONE[h.tag]}>{CASE_STATUS[h.tag]}</Badge>;
  if (h.kind === "action_item" && h.tag === "done") return <Badge tone="pine">Đã xong</Badge>;
  return null;
}

function hitTitle(h: Hit): string {
  if (h.title) return h.title;
  if (h.kind === "document") return DOC_TYPE[h.tag ?? "other"] ?? "Tài liệu";
  if (h.kind === "visit") return "Lần khám";
  return "—";
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

// Search popup opened from the header (or "/" / Ctrl+K). Results update as you type, via the
// search_records Postgres function, so row-level security decides what comes back.
export function SearchDialog() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  // Global shortcuts: "/" or Ctrl/Cmd+K to open, Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isTyping(e.target))) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Debounced search; a response that arrives after a newer keystroke is ignored.
  function changeQuery(value: string) {
    setQuery(value);
    clearTimeout(debounce.current);
    const id = ++requestId.current;
    const q = value.trim();
    if (!q) {
      setHits([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const { data, error } = await createClient().rpc("search_records", { q });
      if (id !== requestId.current) return;
      setHits(data ?? []);
      setError(error?.message ?? null);
      setActive(0);
      setLoading(false);
    }, 200);
  }

  // Groups in display order; `index` is each hit's position in the flat list used for arrow keys.
  const { groups, flat } = useMemo(() => {
    const flat: { hit: Hit; href: string }[] = [];
    const groups = KINDS.map((k) => ({
      ...k,
      hits: hits
        .filter((h) => h.kind === k.kind)
        .map((h) => {
          flat.push({ hit: h, href: k.href(h) });
          return { hit: h, index: flat.length - 1 };
        }),
    })).filter((g) => g.hits.length > 0);
    return { groups, flat };
  }, [hits]);

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      router.push(flat[active].href);
      setOpen(false);
    }
  }

  useEffect(() => {
    document.getElementById(`search-hit-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
        aria-label="Tìm kiếm"
        title="Tìm kiếm (/)"
      >
        <Search className="h-4 w-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">Tìm</span>
      </button>

      {/* Portal to <body>: the header's backdrop-blur makes it the containing block for fixed
          descendants, which would shrink the overlay to the header's box. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-40 bg-ink/30 sm:px-4 sm:pt-[10vh]"
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Tìm kiếm"
              className="mx-auto flex h-full max-w-2xl flex-col bg-surface pt-[env(safe-area-inset-top)] sm:h-auto sm:max-h-[75vh] sm:rounded-xl sm:border sm:border-line sm:pt-0 sm:shadow-xl"
            >
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <Search className="h-5 w-5 shrink-0 text-ink-faint" strokeWidth={1.75} />
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => changeQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder="Tìm lần khám, chỉ số, thuốc, tiêm chủng…"
                  aria-label="Tìm kiếm"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-faint"
                />
                {loading && (
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-pine" />
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 text-ink-faint hover:text-ink"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                {!query.trim() && (
                  <div className="p-4">
                    <p className="muted mb-2">Gõ có dấu hay không dấu đều được. Thử:</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button key={s} type="button" className="btn" onClick={() => changeQuery(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="p-4 text-sm text-stamp">Lỗi tìm kiếm: {error}</p>}

                {query.trim() && !loading && !error && hits.length === 0 && (
                  <p className="muted p-4">Không tìm thấy kết quả cho “{query.trim()}”.</p>
                )}

                {hits.some((h) => h.approximate) && (
                  <p className="mx-4 mt-3 rounded-lg bg-flag-low-tint px-3 py-2 text-sm text-flag-low">
                    Không có kết quả khớp chính xác. Đây là kết quả gần đúng (có thể bạn gõ sai chính tả).
                  </p>
                )}

                {groups.map((g) => (
                  <section key={g.kind} className="py-2">
                    <h2 className="flex items-center gap-2 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      <g.icon className="h-4 w-4 text-pine" strokeWidth={1.75} />
                      {g.label}
                      <span className="font-normal text-ink-faint">{g.hits.length}</span>
                    </h2>
                    <ul>
                      {g.hits.map(({ hit: h, index: i }) => {
                        return (
                          <li key={h.id}>
                            <Link
                              id={`search-hit-${i}`}
                              href={g.href(h)}
                              onClick={() => setOpen(false)}
                              onMouseMove={() => setActive(i)}
                              className={`flex items-start justify-between gap-3 px-4 py-2.5 ${
                                i === active ? "bg-paper-dim" : ""
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{hitTitle(h)}</span>
                                  {tagBadge(h)}
                                </div>
                                {h.detail && <div className="muted line-clamp-2">{h.detail}</div>}
                              </div>
                              <div className="shrink-0 text-right text-sm text-ink-soft">
                                <div>{h.person_name}</div>
                                {h.happened_on && <div className="font-mono text-xs">{formatDate(h.happened_on)}</div>}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
