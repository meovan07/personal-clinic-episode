"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { processInboxItem, type TranscriptPartRow } from "@/app/actions";
import { useTranscription } from "@/lib/use-transcription";

// Shown when an inbox item is still processing (e.g. the tab closed mid-upload) or the AI read failed.
// Recordings: transcribes pending parts first, then runs the AI read once every part is done.
export function InboxRetry({
  id,
  error,
  parts: initialParts = [],
}: {
  id: string;
  error?: string | null;
  parts?: TranscriptPartRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(error ?? null);
  const [owner] = useState(() => ({ inboxItemId: id }));
  const { parts, running, label, start, retry } = useTranscription(owner, initialParts);
  const hasParts = initialParts.length > 0;
  const allDone = hasParts && parts.every((p) => p.status === "done");
  const anyFailed = parts.some((p) => p.status === "failed");
  const started = useRef(false);
  const processed = useRef(false);

  function process() {
    startTransition(async () => {
      setErr(null);
      const { error } = await processInboxItem(id);
      if (error) setErr(error);
      else router.refresh();
    });
  }

  // On mount: transcribe whatever is still pending.
  useEffect(() => {
    if (started.current || !initialParts.some((p) => p.status === "pending")) return;
    started.current = true;
    start();
  }, [initialParts, start]);

  // Once every part is done, read it with AI exactly once (guarded by a ref). Parts that were
  // already done on load with an earlier error mean the AI read failed: wait for "Thử lại" (R8).
  useEffect(() => {
    if (!allDone || running || processed.current) return;
    if (!started.current && error) return;
    processed.current = true;
    process();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- process only closes over stable values
  }, [allDone, running]);

  const transcribing = hasParts && !allDone && !anyFailed;
  const failedParts = hasParts && anyFailed && !running;

  return (
    <div className="card space-y-3">
      {hasParts && !allDone && (
        <div className="space-y-2">
          <p className={failedParts ? "text-sm text-stamp" : "muted"}>{label}</p>
          {transcribing && (
            <div className="h-1.5 overflow-hidden rounded-full bg-paper-dim">
              <div
                className="h-full bg-pine transition-all"
                style={{ width: `${(parts.filter((p) => p.status === "done").length / parts.length) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
      {!hasParts || allDone ? (
        <>
          <p className="muted">{err ? "Lần đọc trước bị lỗi:" : "Tài liệu đang chờ AI xử lý."}</p>
          {err && <p className="text-sm text-stamp">{err}</p>}
        </>
      ) : (
        err && <p className="text-sm text-stamp">{err}</p>
      )}
      {(!hasParts || allDone || failedParts) && (
        <button
          className="btn-primary"
          disabled={pending || running}
          onClick={() => {
            if (failedParts) {
              started.current = true;
              processed.current = false;
              retry();
            } else {
              process();
            }
          }}
        >
          {pending ? (
            "AI đang đọc… (khoảng 30-60 giây)"
          ) : (
            <>
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              Thử lại
            </>
          )}
        </button>
      )}
    </div>
  );
}
