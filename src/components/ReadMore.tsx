"use client";

import { useState, type ReactNode } from "react";

// Long text (the AI health summary) shown as a short preview with "Đọc thêm" instead of a wall of text.
export function ReadMore({ children, collapsedHeight = "12rem" }: { children: ReactNode; collapsedHeight?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="relative overflow-hidden" style={open ? undefined : { maxHeight: collapsedHeight }}>
        {children}
        {!open && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface" />
        )}
      </div>
      <button
        type="button"
        className="mt-2 text-sm font-medium text-pen hover:underline"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Thu gọn" : "Đọc thêm"}
      </button>
    </div>
  );
}
