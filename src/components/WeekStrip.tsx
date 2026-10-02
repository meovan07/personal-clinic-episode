import type { DatedEvent } from "@/lib/calendar";

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DOT: Record<DatedEvent["status"], string> = {
  past: "bg-flag-normal",
  upcoming: "bg-pen",
  overdue: "bg-stamp",
};

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The next seven days at a glance; a dot per thing happening that day. The full month is one tap away.
export function WeekStrip({ today, events }: { today: string; events: DatedEvent[] }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {days.map((day) => {
        const dayEvents = events.filter((e) => e.date === day);
        const isToday = day === today;
        return (
          <div
            key={day}
            className={`rounded-2xl py-2 ${isToday ? "bg-pine text-on-pine" : "bg-surface"}`}
            aria-label={`${day}: ${dayEvents.length} việc`}
          >
            <div className={`text-[11px] ${isToday ? "" : "text-ink-soft"}`}>
              {WEEKDAY[new Date(`${day}T00:00:00Z`).getUTCDay()]}
            </div>
            <div className="font-serif text-lg leading-tight tabular-nums">{Number(day.slice(8))}</div>
            <div className="mt-1 flex h-1.5 justify-center gap-0.5">
              {dayEvents.slice(0, 3).map((e, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${isToday ? "bg-on-pine" : DOT[e.status]}`} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
