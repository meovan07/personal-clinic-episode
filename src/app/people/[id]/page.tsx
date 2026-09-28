import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderPlus, Pencil, Syringe, TriangleAlert } from "lucide-react";
import { deletePerson } from "@/app/actions";
import { ActionItems } from "@/components/ActionItems";
import { AiSummaryButton } from "@/components/AiSummaryButton";
import { Badge } from "@/components/Badge";
import { ConfirmForm } from "@/components/ConfirmForm";
import { ObservationTrend, type TrendSeries } from "@/components/ObservationTrend";
import { PageHeader } from "@/components/PageHeader";
import { VaccinationSummary } from "@/components/VaccinationSummary";
import { VisitList } from "@/components/VisitList";
import { createClient } from "@/lib/supabase/server";
import { age, formatDate } from "@/lib/format";
import { CASE_STATUS, CASE_STATUS_TONE, SEX } from "@/lib/labels";

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: person } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (!person) notFound();

  const [cases, visits, actions, summaries, vaccinations] = await Promise.all([
    supabase.from("cases").select("*, visits(count)").eq("person_id", id).order("started_on", { ascending: false }),
    supabase
      .from("visits")
      .select("id, visit_date, facility, reason, cases(title), documents(count)")
      .eq("person_id", id)
      .order("visit_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("action_items")
      .select("id, content, due_on, done, visit_id")
      .eq("person_id", id)
      .order("done")
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_summaries")
      .select("id, content, generated_at")
      .eq("person_id", id)
      .order("generated_at", { ascending: false }),
    supabase
      .from("vaccinations")
      .select("id, vaccine_name, disease, given_on, next_due_on")
      .eq("person_id", id)
      .order("given_on", { ascending: true, nullsFirst: true }),
  ]);
  const [latestSummary, ...olderSummaries] = summaries.data ?? [];

  // Chart the value of each lab test across visits, so trends (e.g. men gan, mỡ máu) are visible at a glance.
  const visitDates = new Map((visits.data ?? []).map((v) => [v.id, v.visit_date]));
  const visitIds = [...visitDates.keys()];
  const { data: obsRows } = visitIds.length
    ? await supabase
        .from("observations")
        .select("visit_id, test_code, value, unit, flag, test_catalog(name_vi, category)")
        .in("visit_id", visitIds)
        .not("value", "is", null)
        .not("test_code", "is", null)
    : { data: [] };
  const seriesByCode = new Map<string, TrendSeries & { dated: { date: string; value: number; flag: string | null }[] }>();
  for (const o of obsRows ?? []) {
    const date = visitDates.get(o.visit_id);
    if (!date || o.value === null || !o.test_code) continue;
    const existing = seriesByCode.get(o.test_code);
    const point = { date, value: o.value, flag: o.flag };
    if (existing) existing.dated.push(point);
    else
      seriesByCode.set(o.test_code, {
        code: o.test_code,
        name: o.test_catalog?.name_vi ?? o.test_code,
        category: o.test_catalog?.category ?? null,
        unit: o.unit,
        latestFlag: null,
        points: [],
        dated: [point],
      });
  }
  const ABNORMAL_FIRST: Record<string, number> = { high: 0, abnormal: 0, low: 1, normal: 2 };
  const trends: TrendSeries[] = [...seriesByCode.values()]
    .map((s) => {
      const dated = s.dated.sort((a, b) => a.date.localeCompare(b.date));
      return { ...s, points: dated.map(({ date, value }) => ({ date, value })), latestFlag: dated.at(-1)?.flag ?? null };
    })
    .filter((s) => s.points.length >= 2)
    .sort((a, b) => (ABNORMAL_FIRST[a.latestFlag ?? "normal"] ?? 2) - (ABNORMAL_FIRST[b.latestFlag ?? "normal"] ?? 2));

  const a = age(person.birth_date);
  const facts = [
    person.sex && SEX[person.sex],
    person.birth_date && `${formatDate(person.birth_date)}${a !== null ? ` (${a} tuổi)` : ""}`,
    person.blood_type && `Nhóm máu ${person.blood_type}`,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/", label: "Trang chủ" }}
        title={person.full_name}
        subtitle={facts.join(" · ")}
        actions={
          <>
            <Link href={`/visits/new?person=${id}`} className="btn-primary">
              Lần khám
            </Link>
            <Link href={`/people/${id}/edit`} className="btn">
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
              Sửa
            </Link>
          </>
        }
      />

      {(person.allergies || person.chronic_conditions || person.notes) && (
        <div className="card space-y-2">
          {person.allergies && (
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-stamp" strokeWidth={1.75} />
              <span>
                <span className="font-medium text-stamp">Dị ứng:</span> {person.allergies}
              </span>
            </p>
          )}
          {person.chronic_conditions && (
            <p>
              <span className="font-medium">Tiền sử:</span> {person.chronic_conditions}
            </p>
          )}
          {person.notes && <p className="muted whitespace-pre-line">{person.notes}</p>}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title mb-0">Tóm tắt sức khỏe</h2>
          <AiSummaryButton personId={id} label={latestSummary ? "Tóm tắt lại" : "Tóm tắt bằng AI"} />
        </div>
        {latestSummary ? (
          <div className="card space-y-2">
            <p className="whitespace-pre-line">{latestSummary.content}</p>
            <p className="muted text-xs">Tạo lúc {formatDate(latestSummary.generated_at)}</p>
            {olderSummaries.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-pen">Xem {olderSummaries.length} bản tóm tắt trước</summary>
                <div className="mt-2 space-y-3 border-t border-line pt-2">
                  {olderSummaries.map((s) => (
                    <div key={s.id}>
                      <p className="muted text-xs">{formatDate(s.generated_at)}</p>
                      <p className="whitespace-pre-line">{s.content}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <p className="muted">Chưa có tóm tắt. Bấm &quot;Tóm tắt bằng AI&quot; để AI đọc lịch sử khám và bệnh án.</p>
        )}
      </section>

      {trends.length > 0 && (
        <section>
          <h2 className="section-title">Biểu đồ chỉ số xét nghiệm</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trends.map((s) => (
              <ObservationTrend key={s.code} series={s} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title mb-0">Bệnh án</h2>
          <Link href={`/cases/new?person=${id}`} className="btn">
            <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
            Bệnh án
          </Link>
        </div>
        {cases.data?.length === 0 && <p className="muted">Chưa có bệnh án. Lần khám lẻ vẫn có thể lưu không cần bệnh án.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {cases.data?.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="card card-interactive">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{c.title}</span>
                <Badge tone={CASE_STATUS_TONE[c.status]}>{CASE_STATUS[c.status]}</Badge>
              </div>
              <div className="muted">
                {c.started_on && `Từ ${formatDate(c.started_on)}`}
                {c.ended_on && ` đến ${formatDate(c.ended_on)}`} · {c.visits[0]?.count ?? 0} lần khám
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title mb-0">Tiêm chủng</h2>
          <Link href={`/people/${id}/vaccinations`} className="btn">
            <Syringe className="h-4 w-4" strokeWidth={1.75} />
            Sổ tiêm chủng ({vaccinations.data?.length ?? 0} mũi)
          </Link>
        </div>
        <div className="card">
          <VaccinationSummary doses={vaccinations.data ?? []} />
        </div>
      </section>

      <section>
        <h2 className="section-title">Việc cần làm</h2>
        <div className="card">
          <ActionItems items={actions.data ?? []} personId={id} />
        </div>
      </section>

      <section>
        <h2 className="section-title">Lịch sử khám</h2>
        <VisitList visits={visits.data ?? []} />
      </section>

      <ConfirmForm
        action={deletePerson.bind(null, id)}
        message={`Xóa hồ sơ ${person.full_name} cùng TOÀN BỘ bệnh án, lần khám và tài liệu? Không thể hoàn tác.`}
        className="border-t border-line pt-6"
      >
        <button className="btn-danger">Xóa hồ sơ</button>
      </ConfirmForm>
    </div>
  );
}
