import { formatTime, transcriptToggleLabel, type Segment } from "@/lib/transcript";

// Read-only, folded transcript: one line per turn with time, speaker and text.
export function Transcript({ segments }: { segments: Segment[] }) {
  if (segments.length === 0) return null;
  const duration = segments[segments.length - 1].end;
  return (
    <details className="card">
      <summary className="cursor-pointer text-sm font-medium text-ink">{duration > 0 ? transcriptToggleLabel(duration) : "Xem lời thoại"}</summary>
      <ol className="mt-3 space-y-2 text-sm text-ink">
        {segments.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-12 shrink-0 text-ink-soft [font-variant-numeric:tabular-nums]">{formatTime(s.start)}</span>
            <span>
              <strong className="font-medium">{s.speaker}:</strong> {s.text}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
