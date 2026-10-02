import type { CalendarEvent } from "@/lib/calendar";

export type PushMessage = { title: string; body: string; url: string; tag: string };

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The morning notification: to-dos and vaccine doses due today or tomorrow, as one message
 * (null when there's nothing). Past or overdue items aren't repeated every day.
 */
export function morningDigest(events: CalendarEvent[], today: string): PushMessage | null {
  const tomorrow = addDays(today, 1);
  const due = events
    .filter((e) => (e.kind === "todo" || e.kind === "dose_due") && (e.date === today || e.date === tomorrow))
    .sort((a, b) => a.date.localeCompare(b.date) || a.personName.localeCompare(b.personName));
  if (due.length === 0) return null;

  const when = (e: CalendarEvent) => (e.date === today ? "Hôm nay" : "Ngày mai");
  const onlyToday = due.every((e) => e.date === today);
  const onlyTomorrow = due.every((e) => e.date === tomorrow);
  const title =
    due.length === 1
      ? `${when(due[0])}: ${due[0].title}`
      : onlyToday
        ? `${due.length} việc hôm nay`
        : onlyTomorrow
          ? `${due.length} việc ngày mai`
          : `${due.length} việc hôm nay và ngày mai`;
  const body =
    due.length === 1
      ? due[0].personName
      : due.map((e) => `${onlyToday || onlyTomorrow ? "" : `${when(e)} · `}${e.personName}: ${e.title}`).join("\n");
  return { title, body, url: due.length === 1 ? due[0].href : "/", tag: `reminders-${today}` };
}
