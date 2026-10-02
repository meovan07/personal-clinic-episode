import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, FolderPlus, Pencil, Plus, Syringe, Trash2, TriangleAlert } from "lucide-react";
import { deletePerson } from "@/app/actions";
import { ActionItems } from "@/components/ActionItems";
import { AiSummaryButton } from "@/components/AiSummaryButton";
import { AttentionList } from "@/components/AttentionList";
import { Badge } from "@/components/Badge";
import { ConfirmForm } from "@/components/ConfirmForm";
import { HealthSummary } from "@/components/HealthSummary";
import { MoreMenu } from "@/components/MoreMenu";
import { PageHeader } from "@/components/PageHeader";
import { ReadMore } from "@/components/ReadMore";
import { ResultRow } from "@/components/ResultRow";
import { Tabs } from "@/components/Tabs";
import { VaccinationSummary } from "@/components/VaccinationSummary";
import { VisitList } from "@/components/VisitList";
import { prepareCalendar, vietnamToday } from "@/lib/calendar";
import { loadCalendarEvents } from "@/lib/calendar-data";
import { createClient } from "@/lib/supabase/server";
import { age, formatDate, relativeAgo } from "@/lib/format";
import { CASE_STATUS, CASE_STATUS_TONE, SEX } from "@/lib/labels";
import { latestResults, OUT_OF_RANGE, type TestResult } from "@/lib/results";

const TABS = [
  { id: "tong-quan", label: "Tổng quan" },
  { id: "chi-so", label: "Chỉ số" },
  { id: "lan-kham", label: "Lần khám" },
  { id: "tiem-chung", label: "Tiêm chủng" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Body systems in the order a reader cares about; tests outside the catalog go under "Khác".
const CATEGORY_ORDER = [
  "Chỉ số cơ thể",
  "Mỡ máu",
  "Đường huyết",
  "Chức năng gan",
  "Chức năng thận",
  "Công thức máu",
  "Miễn dịch",
  "Tuyến giáp",
  "Sắt",
  "Điện giải",
  "Vitamin",
  "Viêm",
  "Tiêu hóa",
  "Khác",
];

type Result = TestResult;

export default async function PersonPage({ params, searchParams }: PageProps<"/people/[id]">) {
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "tong-quan";
  const supabase = await createClient();
  const { data: person } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (!person) notFound();

  const [cases, visits, actions, summaries, vaccinations, calendarEvents] = await Promise.all([
    supabase.from("cases").select("*, visits(count)").eq("person_id", id).order("started_on", { ascending: false }),
    supabase
      .from("visits")
      .select("id, visit_date, facility, reason, cases(title), documents(count)")
      .eq("person_id", id)
      .order("visit_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("action_items")
      .select("id, content, due_on, done, visit_id, notes")
      .eq("person_id", id)
      .eq("done", false)
      .order("due_on", { ascending: true, nullsFirst: false }),
    supabase
      .from("ai_summaries")
      .select("id, content, generated_at")
      .eq("person_id", id)
      .order("generated_at", { ascending: false }),
    supabase
      .from("vaccinations")
      .select("id, vaccine_name, disease, given_on, next_due_on, typically_single_dose")
      .eq("person_id", id)
      .order("given_on", { ascending: true, nullsFirst: true }),
    loadCalendarEvents(supabase, id),
  ]);
  const today = vietnamToday();
  const calendar = prepareCalendar(calendarEvents, today);
  const [latestSummary, ...olderSummaries] = summaries.data ?? [];

  // Every result of this person, one row per test with its latest value, the previous one and the trend.
  const visitDates = new Map((visits.data ?? []).map((v) => [v.id, v.visit_date]));
  const { data: obsRows } = visitDates.size
    ? await supabase
        .from("observations")
        .select(
          "visit_id, test_code, raw_name, value, value_text, unit, raw_unit, ref_range_text, flag, test_catalog(name_vi, category)",
        )
        .in("visit_id", [...visitDates.keys()])
    : { data: [] };
  const results: Result[] = latestResults(obsRows ?? [], visitDates);
  const rank = (r: Result) => (OUT_OF_RANGE.has(r.flag ?? "") ? 0 : 1);
  const outOfRange = results.filter((r) => rank(r) === 0).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    rows: results
      .filter((r) => (CATEGORY_ORDER.includes(r.category) ? r.category : "Khác") === category)
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "vi")),
  })).filter((g) => g.rows.length > 0);

  const a = age(person.birth_date);
  const facts = [
    person.sex && SEX[person.sex],
    a !== null && `${a} tuổi`,
    person.birth_date && `sinh ${formatDate(person.birth_date)}`,
  ].filter(Boolean);
  const followed = (cases.data ?? []).filter((c) => c.status !== "da_khoi");
  const resolved = (cases.data ?? []).filter((c) => c.status === "da_khoi");
  const tabHref = (t: string) => (t === "tong-quan" ? `/people/${id}` : `/people/${id}?tab=${t}`);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/", label: "Trang chủ" }}
        title={person.full_name}
        subtitle={facts.join(" · ")}
        actions={
          <>
            <Link href={`/people/${id}/summary`} className="btn">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              Tóm tắt cho bác sĩ
            </Link>
            <MoreMenu>
              <Link href={`/visits/new?person=${id}`} className="menu-item">
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Thêm lần khám
              </Link>
              <Link href={`/cases/new?person=${id}`} className="menu-item">
                <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
                Thêm bệnh án
              </Link>
              <Link href={`/people/${id}/edit`} className="menu-item">
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
                Sửa hồ sơ
              </Link>
              <ConfirmForm
                action={deletePerson.bind(null, id)}
                message={`Xóa hồ sơ ${person.full_name} cùng TOÀN BỘ bệnh án, lần khám và tài liệu? Không thể hoàn tác.`}
              >
                <button type="button" className="menu-item text-stamp">
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  Xóa hồ sơ
                </button>
              </ConfirmForm>
            </MoreMenu>
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {person.allergies ? (
          <Badge tone="danger">
            <TriangleAlert className="mr-1 h-3.5 w-3.5" strokeWidth={2} />
            Dị ứng: {person.allergies}
          </Badge>
        ) : (
          <Badge>Chưa ghi nhận dị ứng</Badge>
        )}
        {person.blood_type && <Badge>Nhóm máu {person.blood_type}</Badge>}
        {person.chronic_conditions && <Badge tone="pen">Tiền sử: {person.chronic_conditions}</Badge>}
      </div>

      <Tabs active={tab} tabs={TABS.map((t) => ({ ...t, href: tabHref(t.id) }))} />

      {tab === "tong-quan" && (
        <div className="space-y-10">
          <section>
            <h2 className="section-title">Cần chú ý</h2>
            <AttentionList events={calendar.events} upcoming={calendar.upcoming} today={today} showPerson={false} />
          </section>

          {outOfRange.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="section-title mb-0">Chỉ số ngoài ngưỡng</h2>
                <Link href={tabHref("chi-so")} scroll={false} className="text-sm text-pen hover:underline">
                  Tất cả chỉ số
                </Link>
              </div>
              <div className="card divide-y divide-line py-1">
                {outOfRange.slice(0, 5).map((r) => (
                  <ResultRow key={r.key} r={r} />
                ))}
                {outOfRange.length > 5 && (
                  <Link
                    href={tabHref("chi-so")}
                    scroll={false}
                    className="flex items-center justify-between py-3 text-sm text-pen"
                  >
                    Còn {outOfRange.length - 5} chỉ số ngoài ngưỡng khác
                    <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                )}
              </div>
            </section>
          )}

          <section>
            <h2 className="section-title">Bệnh án đang theo dõi</h2>
            {followed.length === 0 ? (
              <p className="muted">Không có bệnh án nào đang điều trị hay theo dõi.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {followed.map((c) => (
                  <Link key={c.id} href={`/cases/${c.id}`} className="card card-interactive">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{c.title}</span>
                      <Badge tone={CASE_STATUS_TONE[c.status]}>{CASE_STATUS[c.status]}</Badge>
                    </div>
                    <div className="muted">
                      {c.started_on && `Từ ${formatDate(c.started_on)} · `}
                      {c.visits[0]?.count ?? 0} lần khám
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {resolved.length > 0 && (
              <p className="muted mt-2">
                Đã khỏi:{" "}
                {resolved.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link href={`/cases/${c.id}`} className="hover:text-pen">
                      {c.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </section>

          <section>
            <h2 className="section-title">Việc cần làm</h2>
            <div className="card">
              <ActionItems items={actions.data ?? []} personId={id} />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="section-title mb-0">Tóm tắt sức khỏe</h2>
              <AiSummaryButton personId={id} label={latestSummary ? "Tóm tắt lại" : "Tóm tắt bằng AI"} />
            </div>
            {latestSummary ? (
              <div className="card space-y-2">
                <ReadMore>
                  <HealthSummary content={latestSummary.content} />
                </ReadMore>
                <p className="muted text-xs">
                  AI viết {relativeAgo(latestSummary.generated_at, today)} · chỉ để tham khảo
                  {olderSummaries.length > 0 && ` · ${olderSummaries.length} bản trước`}
                </p>
              </div>
            ) : (
              <p className="muted">
                Chưa có tóm tắt. Bấm &quot;Tóm tắt bằng AI&quot; để AI đọc lịch sử khám và bệnh án.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "chi-so" &&
        (groups.length === 0 ? (
          <p className="muted">Chưa có kết quả xét nghiệm nào.</p>
        ) : (
          <div className="space-y-8">
            <p className="muted">
              {results.length} chỉ số · {outOfRange.length} ngoài ngưỡng. Mỗi chỉ số hiện kết quả mới nhất; giải thích
              chỉ để tham khảo, hỏi bác sĩ khi cần.
            </p>
            {groups.map((g) => (
              <section key={g.category}>
                <h2 className="section-title">{g.category}</h2>
                <div className="card divide-y divide-line py-1">
                  {g.rows.map((r) => (
                    <ResultRow key={r.key} r={r} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ))}

      {tab === "lan-kham" && (
        <div className="space-y-3">
          <Link href={`/visits/new?person=${id}`} className="btn">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Thêm lần khám
          </Link>
          <VisitList visits={visits.data ?? []} />
        </div>
      )}

      {tab === "tiem-chung" && (
        <div className="space-y-3">
          <div className="card">
            <VaccinationSummary doses={vaccinations.data ?? []} />
          </div>
          <Link href={`/people/${id}/vaccinations`} className="btn">
            <Syringe className="h-4 w-4" strokeWidth={1.75} />
            Mở sổ tiêm chủng ({vaccinations.data?.length ?? 0} mũi)
          </Link>
        </div>
      )}
    </div>
  );
}
