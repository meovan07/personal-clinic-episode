"use client";

import { useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-danger" disabled={pending}>
      {pending ? "Đang xóa…" : "Xóa"}
    </button>
  );
}

// Opens an in-app modal (instead of the browser's native confirm()) before running its server action.
export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: () => Promise<void>;
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
        <p className="mb-4">{message}</p>
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
