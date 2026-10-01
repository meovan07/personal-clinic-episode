import assert from "node:assert/strict";
import { test } from "node:test";
import { addMonths, buildMonth, eventStatus, prepareCalendar, vietnamToday, type CalendarEvent } from "./calendar";

const ev = (date: string, kind: CalendarEvent["kind"], title: string = kind): CalendarEvent => ({
  date,
  kind,
  title,
  href: "/",
  personName: "A",
});

test("vietnamToday uses UTC+7, not the server clock", () => {
  // 20:00 UTC on 30 Sep is already 1 Oct in Vietnam.
  assert.equal(vietnamToday(new Date("2026-09-30T20:00:00Z")), "2026-10-01");
});

test("eventStatus: done things are past, due things are upcoming or overdue", () => {
  assert.equal(eventStatus({ date: "2026-09-01", kind: "visit" }, "2026-10-01"), "past");
  assert.equal(eventStatus({ date: "2026-11-01", kind: "visit" }, "2026-10-01"), "upcoming");
  assert.equal(eventStatus({ date: "2026-09-01", kind: "todo" }, "2026-10-01"), "overdue");
  assert.equal(eventStatus({ date: "2026-10-01", kind: "dose_due" }, "2026-10-01"), "upcoming");
});

test("addMonths crosses year boundaries both ways", () => {
  assert.deepEqual(addMonths(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(addMonths(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(addMonths(2026, 10, -13), { year: 2025, month: 9 });
});

test("buildMonth pads to Monday-first full weeks", () => {
  // October 2026 starts on a Thursday and has 31 days.
  const m = buildMonth(2026, 10, []);
  assert.ok(m.weeks.every((w) => w.length === 7));
  assert.deepEqual(m.weeks[0].slice(0, 4).map((d) => d?.day ?? null), [null, null, null, 1]);
  assert.equal(m.weeks.flat().filter(Boolean).length, 31);
  assert.equal(buildMonth(2028, 2, []).weeks.flat().filter(Boolean).length, 29); // leap year
});

test("a day shows its most urgent status and a capped shading level, only for its own month", () => {
  const { events } = prepareCalendar(
    [
      ev("2026-09-29", "visit"),
      ev("2026-09-29", "todo"),
      ...Array.from({ length: 5 }, () => ev("2026-09-30", "visit")),
      ev("2026-10-02", "visit"),
    ],
    "2026-10-01",
  );
  const days = buildMonth(2026, 9, events).weeks.flat();
  const day = (n: number) => days.find((d) => d?.day === n)!;
  assert.equal(day(29).status, "overdue");
  assert.equal(day(29).level, 2);
  assert.equal(day(30).status, "past");
  assert.equal(day(30).level, 4);
  assert.equal(days.reduce((n, d) => n + (d?.events.length ?? 0), 0), 7);
});

test("upcoming lists overdue first, then soonest, and excludes the past", () => {
  const { upcoming } = prepareCalendar(
    [
      ev("2026-12-01", "dose_due", "later"),
      ev("2026-10-05", "todo", "soon"),
      ev("2026-09-01", "todo", "overdue"),
      ev("2026-09-02", "visit", "done"),
    ],
    "2026-10-01",
  );
  assert.deepEqual(
    upcoming.map((e) => e.title),
    ["overdue", "soon", "later"],
  );
});
