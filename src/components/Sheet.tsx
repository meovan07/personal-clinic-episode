"use client";

import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";

// A form or detail that's rarely needed, behind a button instead of always open on the page.
// Slides up from the bottom on phones, centered on wider screens. A form inside closes the sheet when submitted.
export function Sheet({
  trigger,
  title,
  children,
  triggerClassName = "btn",
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        className="sheet m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink sm:m-auto sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
        // Server actions submit then re-render the page; close right away so the result is visible.
        onSubmit={() => setTimeout(() => ref.current?.close(), 0)}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl">{title}</h2>
          <button
            type="button"
            className="rounded-full p-1.5 text-ink-soft hover:bg-surface"
            aria-label="Đóng"
            onClick={() => ref.current?.close()}
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}
