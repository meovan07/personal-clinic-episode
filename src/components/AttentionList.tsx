import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, ListChecks, PartyPopper } from "lucide-react";
import { DueChip } from "@/components/DueChip";
import type { DatedEvent } from "@/lib/calendar";
import { relativeDue } from "@/lib/format";

const ICON: Partial<Record<DatedEvent["kind"], LucideIcon>> = { todo: ListChecks, dose_due: CalendarClock };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Overdue to-dos and doses, and anything due in the next 7 days. */
export function attentionEvents(events: DatedEvent[], today: string): DatedEvent[] {
  const weekEnd = addDays(today, 7);
  return events
    .filter((e) => (e.kind === "todo" || e.kind === "dose_due") && e.status !== "past")
    .filter((e) => e.status === "overdue" || e.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// "Cần chú ý": what needs doing now, overdue in red and the coming week in amber, or a calm note when nothing does.
export function AttentionList({
  events,
  upcoming,
  today,
  showPerson = true,
}: {
  events: DatedEvent[];
  /** Everything ahead, to say what comes next when nothing is urgent. */
  upcoming: DatedEvent[];
  today: string;
  showPerson?: boolean;
}) {
  const items = attentionEvents(events, today);
  if (items.length === 0) {
    const next = upcoming.find((e) => e.kind === "todo" || e.kind === "dose_due");
    return (
      <div className="card flex items-start gap-3">
        <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-flag-normal" strokeWidth={1.75} />
        <div>
          <p>Không có việc gì gấp trong 7 ngày tới.</p>
          {next && (
            <p className="muted mt-0.5">
              Tiếp theo: {next.title}
              {showPerson && ` · ${next.personName}`} ({relativeDue(next.date, today).label.toLowerCase()})
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <ul className="card divide-y divide-line py-1">
      {items.map((e, i) => {
        const Icon = ICON[e.kind] ?? ListChecks;
        return (
          <li key={i}>
            <Link href={e.href} className="flex items-center gap-3 py-3 hover:text-pen">
              <Icon
                className={`h-5 w-5 shrink-0 ${e.status === "overdue" ? "text-stamp" : "text-flag-low"}`}
                strokeWidth={1.75}
              />
              <span className="min-w-0 flex-1">
                <span className="block">{e.title}</span>
                {showPerson && <span className="muted">{e.personName}</span>}
              </span>
              <DueChip date={e.date} today={today} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
