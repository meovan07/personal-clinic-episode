"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readDocumentWithAI } from "@/app/actions";

export function AiReadButton({ documentId, label = "🤖 Đọc bằng AI" }: { documentId: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const { error } = await readDocumentWithAI(documentId);
            if (error) setError(error);
            else router.push(`/documents/${documentId}/review`);
          })
        }
      >
        {pending ? "AI đang đọc… (khoảng 30-60 giây)" : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
