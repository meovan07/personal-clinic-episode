"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { loadTranscriptParts, readDocumentWithAI, type TranscriptPartRow } from "@/app/actions";
import { useTranscription } from "@/lib/use-transcription";

// Reads a recording attached on the visit page: transcribes any pending parts, then runs the AI read once.
export function RecordingReadButton({ documentId, label }: { documentId: string; label?: string }) {
  const [initial, setInitial] = useState<TranscriptPartRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTranscriptParts({ documentId })
      .then((p) => !cancelled && setInitial(p))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (loadError) return <p className="text-sm text-stamp">Không tải được bản ghi. Tải lại trang để thử lại.</p>;
  if (!initial) return <p className="muted">Đang tải…</p>;
  return <Reader documentId={documentId} label={label} initialParts={initial} />;
}

function Reader({
  documentId,
  label,
  initialParts,
}: {
  documentId: string;
  label?: string;
  initialParts: TranscriptPartRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [owner] = useState(() => ({ documentId }));
  const { parts, running, label: progress, start, retry } = useTranscription(owner, initialParts);
  const [clicked, setClicked] = useState(false);
  const processed = useRef(false);
  const allDone = parts.every((p) => p.status === "done");
  const anyFailed = parts.some((p) => p.status === "failed");

  function read() {
    processed.current = true;
    startTransition(async () => {
      setErr(null);
      const { error } = await readDocumentWithAI(documentId);
      if (error) setErr(error);
      else router.push(`/documents/${documentId}/review`);
    });
  }

  // After a click, once every part is done, the AI read runs exactly once (guarded by a ref).
  useEffect(() => {
    if (!clicked || !allDone || running || processed.current) return;
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read only closes over stable values
  }, [clicked, allDone, running]);

  const transcribing = clicked && !allDone && !anyFailed;
  const failedParts = anyFailed && !running;

  return (
    <div className="space-y-2">
      {clicked && !allDone && (
        <>
          <p className={failedParts ? "text-sm text-stamp" : "muted"}>{progress}</p>
          {transcribing && (
            <div className="h-1.5 overflow-hidden rounded-full bg-paper-dim">
              <div
                className="h-full bg-pine transition-all"
                style={{ width: `${(parts.filter((p) => p.status === "done").length / parts.length) * 100}%` }}
              />
            </div>
          )}
        </>
      )}
      {err && <p className="text-sm text-stamp">{err}</p>}
      {(!clicked || failedParts || (err && allDone)) && (
        <button
          className="btn-primary"
          disabled={pending || running}
          onClick={() => {
            if (failedParts) retry();
            else if (err && allDone) read();
            else {
              setClicked(true);
              if (!allDone) start();
            }
          }}
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          {err || failedParts ? "Thử lại" : (label ?? "Đọc bằng AI")}
        </button>
      )}
      {pending && <p className="muted">AI đang đọc… (khoảng 30-60 giây)</p>}
    </div>
  );
}
