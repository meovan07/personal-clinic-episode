import { Badge } from "@/components/Badge";
import { formatDate } from "@/lib/format";

const FLAG: Record<string, { label: string; tone: "danger" | "low" | "pine" }> = {
  high: { label: "Cao", tone: "danger" },
  abnormal: { label: "Bất thường", tone: "danger" },
  low: { label: "Thấp", tone: "low" },
  normal: { label: "Bình thường", tone: "pine" },
};
const LINE: Record<string, string> = {
  high: "var(--color-flag-high)",
  abnormal: "var(--color-flag-high)",
  low: "var(--color-flag-low)",
  normal: "var(--color-flag-normal)",
};

export type ResultRowData = {
  name: string;
  /** Plain-language line from test-info, if the test is in the catalog. */
  explanation: string | null;
  value: string;
  unit: string | null;
  flag: string | null;
  date?: string | null;
  refRange?: string | null;
  previous?: { value: string; date: string } | null;
  /** Numeric history, oldest first, for the small trend line (shown with 2+ points). */
  points?: number[];
};

function Sparkline({ points, flag }: { points: number[]; flag: string | null }) {
  const w = 72;
  const h = 22;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * (w - 4) + 2, h - 2 - ((p - min) / span) * (h - 4)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy.at(-1)!;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <path d={d} fill="none" style={{ stroke: "var(--color-line-strong)" }} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.5} style={{ fill: LINE[flag ?? ""] ?? "var(--color-ink-soft)" }} />
    </svg>
  );
}

// One test result for a reader without medical training: the name, what it means in plain words,
// the value with a clear "Cao / Thấp / Bình thường" chip, and the trend or previous value when there is one.
export function ResultRow({ r }: { r: ResultRowData }) {
  const flag = r.flag ? FLAG[r.flag] : undefined;
  const valueColor = flag && flag.tone !== "pine" ? (flag.tone === "danger" ? "text-stamp" : "text-flag-low") : "";
  // Short numbers sit on the right; long printed results ("Mẫu dương tính với nồng độ…") get their own line.
  const long = `${r.value} ${r.unit ?? ""}`.length > 16;
  const value = (
    <span className="tabular-nums">
      <span className={`font-semibold ${valueColor}`}>{r.value}</span>{" "}
      {r.unit && <span className="text-sm text-ink-soft">{r.unit}</span>}
    </span>
  );
  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{r.name}</div>
          {long && <div className="mt-0.5 break-words">{value}</div>}
          {r.explanation && <p className="mt-0.5 text-sm text-ink-soft">{r.explanation}</p>}
        </div>
        <div className="shrink-0 text-right">
          {!long && <div>{value}</div>}
          {flag && <Badge tone={flag.tone}>{flag.label}</Badge>}
        </div>
      </div>
      {(r.points && r.points.length >= 2) || r.previous || r.refRange || r.date ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          {r.points && r.points.length >= 2 && <Sparkline points={r.points} flag={r.flag} />}
          {r.date && <span className="tabular-nums">{formatDate(r.date)}</span>}
          {r.previous && (
            <span className="line-clamp-1 tabular-nums">
              Lần trước {r.previous.value} ({formatDate(r.previous.date)})
            </span>
          )}
          {r.refRange && <span className="line-clamp-1">Bình thường: {r.refRange}</span>}
        </div>
      ) : null}
    </div>
  );
}
