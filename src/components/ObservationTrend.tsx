import { formatDate } from "@/lib/format";

export type TrendPoint = { date: string; value: number };
export type TrendSeries = {
  code: string;
  name: string;
  category: string | null;
  unit: string | null;
  latestFlag: string | null;
  points: TrendPoint[];
};

// Status colors come from the theme tokens (globals.css --color-flag-*), so they follow light/dark mode.
const STATUS_COLOR: Record<string, string> = {
  normal: "var(--color-flag-normal)",
  high: "var(--color-flag-high)",
  low: "var(--color-flag-low)",
  abnormal: "var(--color-flag-high)",
};
const STATUS_LABEL: Record<string, string> = {
  normal: "Bình thường",
  high: "Cao",
  low: "Thấp",
  abnormal: "Bất thường",
};
const LINE_COLOR = "var(--color-line-strong)"; // de-emphasis: the trend line itself isn't the status, the endpoint dot is

const WIDTH = 100;
const HEIGHT = 28;
const PAD = 4;

function sparkline(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  const coords = values.map((v, i): [number, number] => [
    i * step,
    HEIGHT - PAD - ((v - min) / span) * (HEIGHT - PAD * 2),
  ]);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${HEIGHT} L0,${HEIGHT} Z`;
  return { line, area, last: coords[coords.length - 1] };
}

export function ObservationTrend({ series }: { series: TrendSeries }) {
  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  const { line, area, last: lastCoord } = sparkline(series.points.map((p) => p.value));
  const color = STATUS_COLOR[series.latestFlag ?? ""] ?? "var(--color-ink-faint)";
  const statusLabel = STATUS_LABEL[series.latestFlag ?? ""];

  return (
    <div className="card space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{series.name}</span>
        {series.category && <span className="text-xs text-ink-faint">{series.category}</span>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="data text-lg font-semibold">
              {last.value} <span className="font-sans text-sm font-normal text-ink-soft">{series.unit}</span>
            </span>
          </div>
          {statusLabel && (
            <div className="text-xs font-medium" style={{ color }}>
              {statusLabel}
            </div>
          )}
          <div className="data muted text-xs">
            {formatDate(first.date)}: {first.value} → {formatDate(last.date)}: {last.value}
          </div>
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-8 w-24 shrink-0"
          preserveAspectRatio="none"
          role="presentation"
        >
          <path d={area} style={{ fill: LINE_COLOR }} fillOpacity={0.2} stroke="none" />
          <path
            d={line}
            fill="none"
            style={{ stroke: LINE_COLOR }}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={lastCoord[0]}
            cy={lastCoord[1]}
            r={4}
            style={{ fill: color, stroke: "var(--color-surface)" }}
            strokeWidth={2}
          />
        </svg>
      </div>
    </div>
  );
}
