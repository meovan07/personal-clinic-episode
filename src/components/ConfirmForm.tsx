"use client";

import { useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { TriangleAlert } from "lucide-react";

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-danger-solid" disabled={pending}>
      {pending ? "Đang xóa…" : "Xóa"}
    </button>
  );
}

// Opens an in-app modal (instead of the browser's native confirm()) before running its server action.
// Every current caller is a delete/discard confirmation, hence the fixed default title.
export function ConfirmForm({
  action,
  title = "Xác nhận xóa",
  message,
  children,
  className,
}: {
  action: () => Promise<void>;
  title?: string;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className={className}>
      <span onClick={() => dialogRef.current?.showModal()}>{children}</span>
      <dialog
        ref={dialogRef}
        className="m-auto w-80 max-w-[90vw] rounded-lg border border-line bg-surface p-5 shadow-lg"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <TriangleAlert className="h-5 w-5 shrink-0 text-stamp" strokeWidth={1.75} />
          <h2 className="font-semibold text-ink">{title}</h2>
        </div>
        <p className="mb-4 text-ink-soft">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
            Hủy
          </button>
          <form action={action}>
            <ConfirmSubmitButton />
          </form>
        </div>
      </dialog>
    </div>
  );
}
