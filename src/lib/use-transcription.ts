"use client";

import { useCallback, useRef, useState } from "react";
import { loadTranscriptParts, transcribePart, type TranscriptPartRow } from "@/app/actions";
import { failureLabel, nextParts, progressLabel } from "@/lib/transcript";

const MAX_CONCURRENT = 3;

type Owner = { inboxItemId?: string; documentId?: string };

/**
 * Transcribes pending parts, at most 3 at a time. start() runs until nothing is left to start;
 * a part that failed in this run waits for retry(), which re-runs failed parts only.
 * When a run ends the parts are reloaded so finished parts carry their segments.
 */
export function useTranscription(owner: Owner, initialParts: TranscriptPartRow[]) {
  const [parts, setParts] = useState(initialParts);
  const [running, setRunning] = useState(false);
  const latest = useRef(initialParts);
  const active = useRef(false);
  const tried = useRef(new Set<number>());

  const update = useCallback((next: TranscriptPartRow[]) => {
    latest.current = next;
    setParts(next);
  }, []);

  const patch = useCallback(
    (partNo: number, change: Partial<TranscriptPartRow>) =>
      update(latest.current.map((p) => (p.part_no === partNo ? { ...p, ...change } : p))),
    [update],
  );

  const run = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    setRunning(true);
    const inFlight = new Map<number, Promise<void>>();
    try {
      for (;;) {
        const candidates = latest.current.filter((p) => !tried.current.has(p.part_no));
        for (const partNo of nextParts(candidates, [...inFlight.keys()], MAX_CONCURRENT)) {
          const part = latest.current.find((p) => p.part_no === partNo);
          if (!part) continue;
          tried.current.add(partNo);
          inFlight.set(
            partNo,
            transcribePart(part.id)
              .then((r) => patch(partNo, { status: r.status, error: r.error }))
              .catch(() => patch(partNo, { status: "failed", error: "Chưa chép lời được phần này. Thử lại." }))
              .then(() => void inFlight.delete(partNo)),
          );
        }
        if (inFlight.size === 0) break;
        await Promise.race(inFlight.values());
      }
      update(await loadTranscriptParts(owner));
    } catch {
      // Keep the in-memory statuses if the reload fails.
    } finally {
      active.current = false;
      setRunning(false);
    }
  }, [owner, patch, update]);

  const start = useCallback(() => {
    tried.current.clear();
    void run();
  }, [run]);

  const retry = useCallback(() => {
    // Everything that is not failed counts as already tried.
    tried.current = new Set(latest.current.filter((p) => p.status !== "failed").map((p) => p.part_no));
    void run();
  }, [run]);

  return { parts, running, label: failureLabel(parts) ?? progressLabel(parts), start, retry };
}
