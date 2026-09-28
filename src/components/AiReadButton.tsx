"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { readDocumentWithAI } from "@/app/actions";

export function AiReadButton({ documentId, label }: { documentId: string; label?: React.ReactNode }) {
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
        {pending ? (
          "AI đang đọc… (khoảng 30-60 giây)"
        ) : (
          <>
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            {label ?? "Đọc bằng AI"}
          </>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-stamp">{error}</p>}
    </div>
  );
}
