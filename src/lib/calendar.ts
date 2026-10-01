// Health calendar: what happened (visits, vaccinations) and what's coming (to-dos, next doses),
// shown as month grids. Pure functions on "YYYY-MM-DD" strings, no I/O.

export type CalendarEventKind = "visit" | "vaccination" | "todo" | "dose_due";
export type CalendarStatus = "past" | "upcoming" | "overdue";

export type CalendarEvent = {
  date: string;
  kind: CalendarEventKind;
  title: string;
  href: string;
  personName: string;
};

export type DatedEvent = CalendarEvent & { status: CalendarStatus };

export type CalendarDay = {
  date: string;
  day: number;
  events: DatedEvent[];
  /** The most urgent status on the day: overdue > upcoming > past. */
  status: CalendarStatus | null;
  /** 1-4 shading level by number of events. */
  level: 0 | 1 | 2 | 3 | 4;
};

export type CalendarMonth = {
  year: number;
  /** 1-12 */
  month: number;
  /** Monday-first weeks; null pads the days before the 1st and after the last day. */
  weeks: (CalendarDay | null)[][];
};

/** What the server hands the calendar component: everything else is derived on the client. */
export type CalendarData = { today: string; events: DatedEvent[]; upcoming: DatedEvent[] };

/** Today in Vietnam, regardless of the server's timezone. */
export function vietnamToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

export function eventStatus(e: Pick<CalendarEvent, "date" | "kind">, today: string): CalendarStatus {
  // Things that were done are "past"; a visit dated in the future is an appointment, so "upcoming".
  if (e.kind === "visit" || e.kind === "vaccination") return e.date > today ? "upcoming" : "past";
  return e.date < today ? "overdue" : "upcoming";
}

const URGENCY: Record<CalendarStatus, number> = { overdue: 3, upcoming: 2, past: 1 };

export function prepareCalendar(events: CalendarEvent[], today: string, upcomingLimit = 6): CalendarData {
  const dated = events.map((e) => ({ ...e, status: eventStatus(e, today) }));
  const upcoming = dated
    .filter((e) => e.status !== "past")
    .sort((a, b) => URGENCY[b.status] - URGENCY[a.status] || a.date.localeCompare(b.date))
    .slice(0, upcomingLimit);
  return { today, events: dated, upcoming };
}

/** Shift a year/month by `delta` months. */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function buildMonth(year: number, month: number, events: DatedEvent[]): CalendarMonth {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const byDate = new Map<string, DatedEvent[]>();
  for (const e of events) if (e.date.startsWith(prefix)) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const cells: (CalendarDay | null)[] = Array(leading).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = prefix + String(day).padStart(2, "0");
    const dayEvents = byDate.get(date) ?? [];
    const status = dayEvents.reduce<CalendarStatus | null>(
      (best, e) => (!best || URGENCY[e.status] > URGENCY[best] ? e.status : best),
      null,
    );
    cells.push({ date, day, events: dayEvents, status, level: Math.min(dayEvents.length, 4) as CalendarDay["level"] });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, weeks };
}
