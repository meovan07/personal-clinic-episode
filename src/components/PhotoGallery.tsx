"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, ImageIcon, X } from "lucide-react";
import { lockPageScroll } from "@/lib/scroll-lock";

export type GalleryItem = {
  url: string;
  name: string;
  /** "image" can be shown inline; anything else (PDF, HEIC) opens in its own viewer. */
  kind: "image" | "pdf" | "other";
  /** e.g. "Kết quả xét nghiệm · trang 2". */
  caption: string;
};

// All pages of a visit's documents as one strip; tapping opens a full-screen viewer to swipe through every page
// (scroll-snap, so swiping feels native), double-tap or the zoom button to enlarge, arrows/Esc on a keyboard.
// It stays inside the app: no new browser tab, which in the installed app would jump out to Safari.
export function PhotoGallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (items.length === 0) return null;
  return (
    <>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {items.map((item, i) => (
          <button
            key={item.url}
            type="button"
            onClick={() => setOpen(i)}
            className="relative h-40 w-28 shrink-0 snap-start overflow-hidden rounded-2xl bg-surface"
            aria-label={`Xem ${item.caption}`}
          >
            {item.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URLs, not optimizable
              <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center text-xs text-ink-soft">
                {item.kind === "pdf" ? (
                  <FileText className="h-7 w-7" strokeWidth={1.5} />
                ) : (
                  <ImageIcon className="h-7 w-7" strokeWidth={1.5} />
                )}
                <span className="line-clamp-3 break-all">{item.name}</span>
              </span>
            )}
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-medium text-paper">
              {i + 1}/{items.length}
            </span>
          </button>
        ))}
      </div>
      {open !== null && <Viewer items={items} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Viewer({ items, start, onClose }: { items: GalleryItem[]; start: number; onClose: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);

  const goTo = useCallback((i: number, smooth = true) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(i, track.children.length - 1));
    track.scrollTo({ left: next * track.clientWidth, behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    goTo(start, false);
    return lockPageScroll();
  }, [goTo, start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, onClose]);

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) {
      setIndex(i);
      setZoomed(false);
    }
  }

  const item = items[index];
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh tài liệu"
      className="anim-fade fixed inset-0 z-50 flex flex-col bg-[#05080c] text-white"
    >
      <div className="flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium tabular-nums">
            {index + 1} / {items.length}
          </div>
          <div className="truncate text-xs text-white/60">{item?.caption}</div>
        </div>
        {item && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Mở file gốc"
            title="Mở file gốc"
          >
            <ExternalLink className="h-5 w-5" strokeWidth={1.75} />
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="Đóng"
        >
          <X className="h-6 w-6" strokeWidth={1.75} />
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className={`flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] ${
          zoomed ? "overflow-hidden" : "overflow-x-auto"
        }`}
      >
        {items.map((it, i) => (
          <div key={it.url} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            {it.kind === "image" ? (
              <div
                className={`h-full w-full ${i === index && zoomed ? "overflow-auto" : "overflow-hidden"} flex`}
                onDoubleClick={() => setZoomed((z) => !z)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs, not optimizable */}
                <img
                  src={it.url}
                  alt={it.caption}
                  loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                  draggable={false}
                  className={
                    i === index && zoomed
                      ? "m-auto max-w-none select-none"
                      : "m-auto max-h-full max-w-full select-none object-contain"
                  }
                  style={i === index && zoomed ? { width: "220%" } : undefined}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-8 text-center">
                <FileText className="h-12 w-12 text-white/60" strokeWidth={1.25} />
                <div className="break-all text-sm text-white/80">{it.name}</div>
                <a href={it.url} target="_blank" rel="noreferrer" className="btn-primary">
                  {it.kind === "pdf" ? "Mở PDF" : "Mở file"}
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-full p-2.5 text-white/80 hover:bg-white/10 disabled:opacity-30"
          aria-label="Trang trước"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
        </button>
        {item?.kind === "image" ? (
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
          >
            {zoomed ? "Thu nhỏ" : "Phóng to"}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === items.length - 1}
          className="rounded-full p-2.5 text-white/80 hover:bg-white/10 disabled:opacity-30"
          aria-label="Trang sau"
        >
          <ChevronRight className="h-6 w-6" strokeWidth={1.75} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
