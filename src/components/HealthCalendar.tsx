"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, ChevronLeft, ChevronRight, ListChecks, Stethoscope, Syringe } from "lucide-react";
import { Badge } from "@/components/Badge";
import {
  addMonths,
  buildMonth,
  type CalendarData,
  type CalendarDay,
  type CalendarEventKind,
  type CalendarMonth,
  type CalendarStatus,
  type DatedEvent,
} from "@/lib/calendar";
import { formatDate } from "@/lib/format";

const KIND: Record<CalendarEventKind, { label: string; icon: LucideIcon }> = {
  visit: { label: "Lần khám", icon: Stethoscope },
  vaccination: { label: "Đã tiêm", icon: Syringe },
  todo: { label: "Việc cần làm", icon: ListChecks },
  dose_due: { label: "Hẹn tiêm", icon: CalendarClock },
};

const DAY_COLOR: Record<CalendarStatus, string> = {
  past: "bg-flag-normal text-paper hover:opacity-85",
  upcoming: "bg-pen text-paper hover:opacity-85",
  overdue: "bg-stamp text-on-stamp hover:bg-stamp-dark",
};

const STATUS_BADGE: Record<CalendarStatus, { label: string; tone: "pine" | "pen" | "danger" }> = {
  past: { label: "Đã làm", tone: "pine" },
  upcoming: { label: "Sắp tới", tone: "pen" },
  overdue: { label: "Quá hạn", tone: "danger" },
};

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function EventList({ events, showDate }: { events: DatedEvent[]; showDate: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {events.map((e, i) => {
        const kind = KIND[e.kind];
        return (
          <li key={i}>
            <Link href={e.href} className="flex items-start justify-between gap-3 py-2 hover:text-pen">
              <span className="flex min-w-0 items-start gap-2">
                <kind.icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block">{e.title}</span>
                  <span className="muted">
                    {kind.label} · {e.personName}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={STATUS_BADGE[e.status].tone}>{STATUS_BADGE[e.status].label}</Badge>
                {showDate && <span className="text-xs tabular-nums text-ink-soft">{formatDate(e.date)}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MonthGrid({
  month,
  today,
  isCurrent,
  selected,
  onSelect,
}: {
  month: CalendarMonth;
  today: string;
  isCurrent: boolean;
  selected: string | null;
  onSelect: (day: CalendarDay) => void;
}) {
  return (
    <div>
      <h3 className={`mb-2 text-center text-sm font-semibold ${isCurrent ? "text-pine" : "text-ink-soft"}`}>
        Tháng {month.month}/{month.year}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[11px] font-medium text-ink-faint">
            {w}
          </span>
        ))}
        {month.weeks.flat().map((day, i) =>
          day ? (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={`${formatDate(day.date)}${day.events.length ? `, ${day.events.length} mục` : ""}`}
              aria-pressed={selected === day.date}
              className={`relative flex aspect-square items-center justify-center rounded-md text-sm transition-colors ${
                day.status ? `${DAY_COLOR[day.status]} font-semibold` : "text-ink hover:bg-paper-dim"
              } ${day.date === today ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : ""} ${
                selected === day.date ? "outline outline-2 outline-offset-2 outline-pen" : ""
              }`}
            >
              {day.day}
              {day.events.length > 1 && (
                <span className="absolute right-0.5 top-0 text-[9px] font-bold leading-tight">{day.events.length}</span>
              )}
            </button>
          ) : (
            <span key={`pad-${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

// Month calendar: green = done (visits, vaccinations), blue = coming up, red = overdue.
// Shows last / this / next month on wide screens and one month on phones, with ‹ › to move.
export function HealthCalendar({ data }: { data: CalendarData }) {
  const [offset, setOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayYear = Number(data.today.slice(0, 4));
  const todayMonth = Number(data.today.slice(5, 7));
  const months = useMemo(
    () =>
      [-1, 0, 1].map((d) => {
        const { year, month } = addMonths(todayYear, todayMonth, offset + d);
        return buildMonth(year, month, data.events);
      }),
    [todayYear, todayMonth, offset, data.events],
  );
  const selectedEvents = selectedDate ? data.events.filter((e) => e.date === selectedDate) : [];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn px-2" onClick={() => setOffset((o) => o - 1)} aria-label="Tháng trước">
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="text-sm text-pen hover:underline disabled:text-ink-faint disabled:no-underline"
          onClick={() => setOffset(0)}
          disabled={offset === 0}
        >
          Hôm nay
        </button>
        <button type="button" className="btn px-2" onClick={() => setOffset((o) => o + 1)} aria-label="Tháng sau">
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {months.map((m, i) => (
          // Phones only show the middle month; the arrows move one month at a time either way.
          <div key={`${m.year}-${m.month}`} className={i === 1 ? "" : "hidden sm:block"}>
            <MonthGrid
              month={m}
              today={data.today}
              isCurrent={m.year === todayYear && m.month === todayMonth}
              selected={selectedDate}
              onSelect={(day) => setSelectedDate(selectedDate === day.date ? null : day.date)}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-flag-normal" /> Đã khám / đã tiêm
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-pen" /> Sắp tới
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-stamp" /> Quá hạn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded ring-2 ring-ink" /> Hôm nay
        </span>
      </div>

      <div className="border-t border-line pt-3">
        {selectedDate ? (
          <>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">{formatDate(selectedDate)}</h3>
              <button type="button" className="text-sm text-pen hover:underline" onClick={() => setSelectedDate(null)}>
                Xem việc sắp tới
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="muted">Không có gì trong ngày này.</p>
            ) : (
              <EventList events={selectedEvents} showDate={false} />
            )}
          </>
        ) : (
          <>
            <h3 className="mb-1 font-semibold">Sắp tới</h3>
            {data.upcoming.length === 0 ? (
              <p className="muted">Không có việc hay lịch hẹn nào sắp tới.</p>
            ) : (
              <EventList events={data.upcoming} showDate />
            )}
            <p className="muted mt-1 text-xs">Bấm vào một ngày để xem chi tiết.</p>
          </>
        )}
      </div>
    </div>
  );
}
