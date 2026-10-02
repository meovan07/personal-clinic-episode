"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

// "⋯" for actions that shouldn't sit on the page all the time (edit, delete).
// Items are links or buttons with className "menu-item" (a delete keeps its own confirmation, see ConfirmForm).
export function MoreMenu({ label = "Thêm thao tác", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      // Clicks inside a confirmation dialog opened from the menu are outside this element but belong to it.
      const target = e.target as Element;
      if (!ref.current?.contains(target) && !target.closest?.("dialog")) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft ring-1 ring-line hover:bg-surface hover:text-ink"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <div
        role="menu"
        hidden={!open}
        className="anim-rise absolute right-0 top-11 z-30 min-w-48 overflow-hidden rounded-2xl bg-paper p-1.5 shadow-xl ring-1 ring-line"
      >
        {children}
      </div>
    </div>
  );
}
