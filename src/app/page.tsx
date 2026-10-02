import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  ChevronRight,
  Clock,
  ListChecks,
  PartyPopper,
  Sparkles,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { ActionItems } from "@/components/ActionItems";
import { Badge } from "@/components/Badge";
import { DueChip } from "@/components/DueChip";
import { HealthCalendar } from "@/components/HealthCalendar";
import { InstallHint } from "@/components/InstallHint";
import { VisitList } from "@/components/VisitList";
import { WeekStrip } from "@/components/WeekStrip";
import { prepareCalendar, vietnamToday, type DatedEvent } from "@/lib/calendar";
import { loadCalendarEvents } from "@/lib/calendar-data";
import { createClient } from "@/lib/supabase/server";
import { age, formatDate, relativeAgo, relativeDue } from "@/lib/format";

const INBOX_STATUS: Record<string, { label: string; icon: LucideIcon }> = {
  processing: { label: "Đang xử lý…", icon: Clock },
  needs_review: { label: "AI đã đọc xong, cần xác nhận", icon: Sparkles },
  failed: { label: "Lỗi khi đọc, bấm để thử lại", icon: TriangleAlert },
};

const ATTENTION_ICON: Partial<Record<DatedEvent["kind"], LucideIcon>> = {
  todo: ListChecks,
  dose_due: CalendarClock,
};

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function initial(name: string) {
  return name.trim().split(/\s+/).at(-1)?.charAt(0).toUpperCase() || "?";
}

// Home: what needs attention now first, then each person at a glance, this week, to-dos, and the latest visits.
// Everything else (the full calendar, all visits) is one tap away.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [member, people, visits, todos, inbox, calendarEvents] = await Promise.all([
    supabase.from("members").select("display_name").eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("people")
      .select("id, full_name, birth_date, cases(title, status), visits(visit_date)")
      .order("created_at"),
    supabase
      .from("visits")
      .select("id, visit_date, facility, reason, cases(title), people(full_name), documents(count)")
      .order("visit_date", { ascending: false, nullsFirst: false })
      .limit(3),
    supabase
      .from("action_items")
      .select("id, content, due_on, done, visit_id, notes, people(full_name)")
      .eq("done", false)
      .order("due_on", { ascending: true, nullsFirst: false }),
    supabase.from("inbox_items").select("id, status, inbox_files(file_name)").order("created_at"),
    loadCalendarEvents(supabase),
  ]);

  const today = vietnamToday();
  const calendar = prepareCalendar(calendarEvents, today);
  const weekEnd = addDays(today, 7);
  // Overdue things and anything due in the next 7 days; visits and given doses are history, not tasks.
  const attention = calendar.events
    .filter((e) => (e.kind === "todo" || e.kind === "dose_due") && (e.status === "overdue" || e.date <= weekEnd))
    .filter((e) => e.status !== "past")
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextLater = calendar.upcoming.find((e) => e.date > weekEnd);
  const datedTodos = (todos.data ?? []).filter((t) => t.due_on);
  const advice = (todos.data ?? []).filter((t) => !t.due_on);
  const weekday = WEEKDAY[new Date(`${today}T00:00:00Z`).getUTCDay()];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl">Chào {member.data?.display_name ?? "bạn"}</h1>
        <p className="muted mt-1">
          {weekday}, {formatDate(today)}
        </p>
      </header>

      <InstallHint />

      {inbox.data && inbox.data.length > 0 && (
        <section>
          <h2 className="section-title">Tài liệu chờ xác nhận</h2>
          <div className="space-y-2">
            {inbox.data.map((item) => {
              const status = INBOX_STATUS[item.status];
              const Icon = status?.icon;
              return (
                <Link
                  key={item.id}
                  href={`/inbox/${item.id}/review`}
                  className="card card-interactive flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">{item.inbox_files.map((f) => f.file_name).join(", ")}</span>
                  <span className="muted flex items-center gap-1.5 whitespace-nowrap">
                    {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />}
                    {status?.label ?? item.status}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Cần chú ý</h2>
        {attention.length === 0 ? (
          <div className="card flex items-start gap-3">
            <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-flag-normal" strokeWidth={1.75} />
            <div>
              <p>Không có việc gì gấp trong 7 ngày tới.</p>
              {nextLater && (
                <p className="muted mt-0.5">
                  Tiếp theo: {nextLater.title} · {nextLater.personName} ({relativeDue(nextLater.date, today).label.toLowerCase()})
                </p>
              )}
            </div>
          </div>
        ) : (
          <ul className="card divide-y divide-line py-1">
            {attention.map((e, i) => {
              const Icon = ATTENTION_ICON[e.kind] ?? ListChecks;
              return (
                <li key={i}>
                  <Link href={e.href} className="flex items-center gap-3 py-3 hover:text-pen">
                    <Icon
                      className={`h-5 w-5 shrink-0 ${e.status === "overdue" ? "text-stamp" : "text-flag-low"}`}
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block">{e.title}</span>
                      <span className="muted">{e.personName}</span>
                    </span>
                    <DueChip date={e.date} today={today} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="section-title mb-0">Hai bạn</h2>
          <Link href="/people/new" className="btn px-3" aria-label="Thêm người">
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
        {people.data?.length === 0 && <p className="muted">Bắt đầu bằng cách thêm hồ sơ cho bạn và người yêu.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {people.data?.map((p) => {
            const lastVisit = p.visits
              .map((v) => v.visit_date)
              .filter((d): d is string => !!d)
              .sort()
              .at(-1);
            const followed = p.cases.filter((c) => c.status !== "da_khoi");
            const overdue = calendar.events.filter((e) => e.personName === p.full_name && e.status === "overdue");
            const a = age(p.birth_date);
            return (
              <Link key={p.id} href={`/people/${p.id}`} className="card card-interactive block">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pine-tint font-serif text-lg text-pine">
                    {initial(p.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-medium">{p.full_name}</div>
                    <div className="muted">
                      {a !== null && `${a} tuổi`}
                      {lastVisit && ` · khám gần nhất ${relativeAgo(lastVisit, today)}`}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {followed.map((c) => (
                    <Badge key={c.title} tone="pen">
                      {c.title}
                    </Badge>
                  ))}
                  {overdue.length > 0 && <Badge tone="danger">{overdue.length} việc quá hạn</Badge>}
                  {followed.length === 0 && overdue.length === 0 && <Badge tone="pine">Không có gì đang theo dõi</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">7 ngày tới</h2>
        <WeekStrip today={today} events={calendar.events} />
        <details className="group mt-3">
          <summary className="btn cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Xem lịch tháng</span>
            <span className="hidden group-open:inline">Ẩn lịch tháng</span>
          </summary>
          <div className="mt-3">
            <HealthCalendar data={calendar} />
          </div>
        </details>
      </section>

      {datedTodos.length > 0 && (
        <section>
          <h2 className="section-title">Lịch hẹn và việc có hạn</h2>
          <div className="card">
            <ActionItems items={datedTodos} showPerson />
          </div>
        </section>
      )}

      {advice.length > 0 && (
        <section>
          <h2 className="section-title">Lời dặn của bác sĩ</h2>
          <div className="card">
            <ActionItems items={advice} showPerson />
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="section-title mb-0">Lần khám gần đây</h2>
          <Link href="/visits" className="text-sm text-pen hover:underline">
            Xem tất cả
          </Link>
        </div>
        <VisitList visits={visits.data ?? []} showPerson />
      </section>
    </div>
  );
}

