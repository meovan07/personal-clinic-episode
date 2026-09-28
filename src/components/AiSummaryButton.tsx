"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePersonSummary } from "@/app/actions";

export function AiSummaryButton({ personId, label = "🤖 Tóm tắt bằng AI" }: { personId: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const { error } = await generatePersonSummary(personId);
            if (error) setError(error);
            else router.refresh();
          })
        }
      >
        {pending ? "AI đang tổng hợp… (khoảng 30-60 giây)" : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
