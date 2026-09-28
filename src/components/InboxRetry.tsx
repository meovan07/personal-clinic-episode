"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { processInboxItem } from "@/app/actions";

// Shown when an inbox item is still processing (e.g. the tab closed mid-upload) or the AI read failed.
export function InboxRetry({ id, error }: { id: string; error?: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(error ?? null);

  return (
    <div className="card space-y-3">
      <p className="muted">{err ? "Lần đọc trước bị lỗi:" : "Tài liệu đang chờ AI xử lý."}</p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setErr(null);
            const { error } = await processInboxItem(id);
            if (error) setErr(error);
            else router.refresh();
          })
        }
      >
        {pending ? "AI đang đọc… (khoảng 30-60 giây)" : "🤖 Thử lại"}
      </button>
    </div>
  );
}
