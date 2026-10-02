"use client";

import { useRef, useTransition } from "react";
import { Pencil } from "lucide-react";
import { updateActionItem } from "@/app/actions";

// Lets the user add context to a vague to-do (who a name refers to, which test, etc.).
// updateActionItem doesn't just rephrase that note - it hands the AI the real family
// roster and the person's recent visits/cases so it can resolve things like "chồng" to
// an actual name or match a vague test against what was really recorded.
export function EditActionItem({
  id,
  content,
  dueOn,
  notes,
  asMenuItem = false,
}: {
  id: string;
  content: string;
  dueOn: string | null;
  notes: string | null;
  /** Rendered as a "Sửa" row inside a ⋯ menu instead of a pencil icon. */
  asMenuItem?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startTransition(async () => {
      await updateActionItem(fd);
      dialogRef.current?.close();
    });
  }

  return (
    <>
      <button
        type="button"
        className={asMenuItem ? "menu-item" : "text-ink-faint hover:text-pen"}
        aria-label="Sửa việc cần làm"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Pencil className="h-4 w-4" strokeWidth={1.75} />
        {asMenuItem && "Sửa"}
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-96 max-w-[90vw] rounded-3xl bg-paper p-5 text-ink shadow-xl"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <h2 className="mb-3 font-serif text-xl text-ink">Sửa việc cần làm</h2>
        <form
          ref={formRef}
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <label className="block">
            <span className="label">Nội dung</span>
            <input name="content" required defaultValue={content} className="input" />
          </label>
          <label className="block">
            <span className="label">Hạn</span>
            <input type="date" name="due_on" defaultValue={dueOn ?? ""} className="input" />
          </label>
          <label className="block">
            <span className="label">
              Bối cảnh thêm (AI sẽ đối chiếu với gia đình &amp; lịch sử khám để viết lại nội dung)
            </span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={notes ?? ""}
              className="input"
              placeholder={'VD: "chồng" là anh Nam. Xét nghiệm tổng quát máu, đường huyết.'}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
