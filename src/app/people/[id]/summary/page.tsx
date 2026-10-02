import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { age, formatDate, today } from "@/lib/format";
import { CASE_STATUS, SEX } from "@/lib/labels";
import { groupBySeries, pendingDoses } from "@/lib/vaccinations";

// Medications prescribed this recently are listed; older prescriptions are history, not "current".
const MEDICATION_WINDOW_DAYS = 180;
const RECENT_VISITS = 5;

const FLAG_MARK: Record<string, string> = { high: "↑ Cao", low: "↓ Thấp", abnormal: "! Bất thường" };

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-2 border-b border-line-strong pb-1 text-sm font-bold uppercase tracking-wide text-pine">
        {title}
      </h2>
      {children}
    </section>
  );
}

// A one-page, printable summary to hand to a new doctor. Facts only, straight from the records.
export default async function DoctorSummaryPage({ params }: PageProps<"/people/[id]/summary">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: person } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (!person) notFound();

  const now = today();
  const [cases, visits, observations, medications, vaccinations] = await Promise.all([
    supabase
      .from("cases")
      .select("id, title, status, started_on, ended_on")
      .eq("person_id", id)
      .order("started_on", { ascending: false, nullsFirst: false }),
    supabase
      .from("visits")
      .select("id, visit_date, facility, department, reason, cases(title)")
      .eq("person_id", id)
      .not("visit_date", "is", null)
      .order("visit_date", { ascending: false }),
    supabase
      .from("observations")
      .select(
        "test_code, raw_name, value, value_text, unit, ref_range_text, flag, test_catalog(name_vi, category), visits!inner(visit_date, person_id)",
      )
      .eq("visits.person_id", id)
      .not("visits.visit_date", "is", null),
    supabase
      .from("medications")
      .select("name, dose, schedule, duration_days, visits!inner(visit_date, person_id, facility)")
      .eq("visits.person_id", id)
      .gte("visits.visit_date", addDays(now, -MEDICATION_WINDOW_DAYS)),
    supabase
      .from("vaccinations")
      .select("vaccine_name, disease, dose_label, given_on, next_due_on")
      .eq("person_id", id)
      .order("given_on", { ascending: true, nullsFirst: true }),
  ]);

  const activeCases = (cases.data ?? []).filter((c) => c.status !== "da_khoi");
  const resolvedCases = (cases.data ?? []).filter((c) => c.status === "da_khoi");

  // Latest result per test (mapped tests by code, unmapped ones by printed name), with the one before it.
  type Result = NonNullable<typeof observations.data>[number] & { date: string };
  const byTest = new Map<string, Result[]>();
  for (const o of observations.data ?? []) {
    const date = o.visits.visit_date;
    if (!date) continue;
    const key = o.test_code ?? `raw:${o.raw_name.toLowerCase()}`;
    byTest.set(key, [...(byTest.get(key) ?? []), { ...o, date }]);
  }
  const latest = [...byTest.values()].map((results) => {
    const sorted = results.sort((a, b) => b.date.localeCompare(a.date));
    const last = sorted[0];
    // Two documents from the same day often repeat a test; "previous" means an earlier date.
    const previous = sorted.find((r) => r.date < last.date);
    return { last, previous };
  });
  // Keep it to one page: every catalog test, but uncatalogued tests (e.g. a full semen analysis)
  // only when abnormal. The rest stays in the app.
  const isAbnormal = (flag: string | null) => !!flag && flag !== "normal";
  const shown = latest.filter((r) => r.last.test_code || isAbnormal(r.last.flag));
  const hiddenCount = latest.length - shown.length;
  const byCategory = new Map<string, typeof latest>();
  for (const r of shown) {
    const category = r.last.test_catalog?.category ?? "Khác (bất thường)";
    byCategory.set(category, [...(byCategory.get(category) ?? []), r]);
  }
  const categories = [...byCategory.entries()].sort(([a], [b]) =>
    a.startsWith("Khác") ? 1 : b.startsWith("Khác") ? -1 : a.localeCompare(b, "vi"),
  );

  const meds = (medications.data ?? [])
    .map((m) => {
      const start = m.visits.visit_date!;
      const end = m.duration_days ? addDays(start, m.duration_days) : null;
      return { ...m, start, current: end !== null && end >= now };
    })
    .sort((a, b) => Number(b.current) - Number(a.current) || b.start.localeCompare(a.start));

  const series = groupBySeries(vaccinations.data ?? []);
  const upcoming = pendingDoses(vaccinations.data ?? []);
  const recentVisits = (visits.data ?? []).slice(0, RECENT_VISITS);

  const a = age(person.birth_date);
  const identity = [
    person.sex && SEX[person.sex],
    person.birth_date && `Sinh ${formatDate(person.birth_date)}${a !== null ? ` (${a} tuổi)` : ""}`,
    person.blood_type && `Nhóm máu ${person.blood_type}`,
  ].filter(Boolean);

  const fmt = (v: { value: number | null; value_text: string | null; unit: string | null }) =>
    [v.value ?? v.value_text, v.unit].filter((x) => x !== null && x !== "").join(" ");

  return (
    <div className="space-y-5 print:space-y-4 print:text-[11px] print:leading-snug">
      <div className="print:hidden">
        <PageHeader
          back={{ href: `/people/${id}`, label: person.full_name }}
          title="Tóm tắt cho bác sĩ"
          subtitle="Một trang để đưa bác sĩ khi khám ở nơi mới. In ra giấy hoặc lưu thành PDF."
          actions={<PrintButton />}
        />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink pb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Tóm tắt y tế cá nhân</p>
          <h1 className="text-2xl font-bold print:text-xl">{person.full_name}</h1>
          {identity.length > 0 && <p className="text-ink-soft">{identity.join(" · ")}</p>}
        </div>
        <p className="text-xs text-ink-soft">Cập nhật {formatDate(now)}</p>
      </header>

      <div className="flex items-start gap-2 rounded-lg border-2 border-stamp px-3 py-2">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-stamp" strokeWidth={2} />
        <p>
          <span className="font-bold text-stamp">Dị ứng: </span>
          {person.allergies || "Không ghi nhận"}
        </p>
      </div>

      {person.chronic_conditions && (
        <Section title="Tiền sử / bệnh mãn tính">
          <p className="whitespace-pre-line">{person.chronic_conditions}</p>
        </Section>
      )}

      <Section title="Bệnh đang điều trị / theo dõi">
        {activeCases.length === 0 ? (
          <p className="text-ink-soft">Không có.</p>
        ) : (
          <ul className="list-disc space-y-0.5 pl-5">
            {activeCases.map((c) => (
              <li key={c.id}>
                <span className="font-medium">{c.title}</span> ({CASE_STATUS[c.status].toLowerCase()}
                {c.started_on && `, từ ${formatDate(c.started_on)}`})
              </li>
            ))}
          </ul>
        )}
        {resolvedCases.length > 0 && (
          <p className="mt-1 text-ink-soft">
            Đã khỏi:{" "}
            {resolvedCases.map((c) => `${c.title}${c.ended_on ? ` (${formatDate(c.ended_on)})` : ""}`).join("; ")}
          </p>
        )}
      </Section>

      <Section title={`Thuốc được kê (${MEDICATION_WINDOW_DAYS / 30} tháng gần nhất)`}>
        {meds.length === 0 ? (
          <p className="text-ink-soft">Không có đơn thuốc nào trong thời gian này.</p>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[28rem] text-left print:min-w-0">
              <thead className="text-xs text-ink-soft">
                <tr>
                  <th className="py-1 pr-2 font-medium">Thuốc</th>
                  <th className="py-1 pr-2 font-medium">Cách dùng</th>
                  <th className="py-1 font-medium">Kê ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {meds.map((m, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-1 pr-2">
                      <span className="font-medium">{m.name}</span>
                      {m.current && <span className="ml-1.5 text-xs font-semibold text-pine">đang dùng</span>}
                    </td>
                    <td className="py-1 pr-2">
                      {[m.dose, m.schedule, m.duration_days && `${m.duration_days} ngày`].filter(Boolean).join(" · ")}
                    </td>
                    <td className="whitespace-nowrap py-1 text-xs tabular-nums">{formatDate(m.start)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Kết quả xét nghiệm gần nhất">
        {categories.length === 0 ? (
          <p className="text-ink-soft">Chưa có kết quả xét nghiệm.</p>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[28rem] text-left print:min-w-0">
              <thead className="text-xs text-ink-soft">
                <tr>
                  <th className="py-1 pr-2 font-medium">Chỉ số</th>
                  <th className="py-1 pr-2 font-medium">Gần nhất</th>
                  <th className="py-1 pr-2 font-medium">Tham chiếu</th>
                  <th className="py-1 font-medium">Lần trước</th>
                </tr>
              </thead>
              {categories.map(([category, rows]) => (
                <tbody key={category} className="break-inside-avoid">
                  <tr>
                    <td colSpan={4} className="pt-2 text-xs font-semibold text-ink-soft">
                      {category}
                    </td>
                  </tr>
                  {rows.map(({ last, previous }) => {
                    const abnormal = last.flag && FLAG_MARK[last.flag];
                    return (
                      <tr key={`${last.test_code}-${last.raw_name}`} className="border-t border-line align-top">
                        <td className="py-1 pr-2">{last.test_catalog?.name_vi ?? last.raw_name}</td>
                        <td className={`py-1 pr-2 ${abnormal ? "font-bold text-stamp" : ""}`}>
                          {fmt(last)}
                          {abnormal && <span className="ml-1 text-xs">{FLAG_MARK[last.flag!]}</span>}
                          <div className="text-xs tabular-nums font-normal text-ink-soft">{formatDate(last.date)}</div>
                        </td>
                        <td className="py-1 pr-2 text-ink-soft">
                          <span className="line-clamp-2" title={last.ref_range_text ?? undefined}>
                            {last.ref_range_text}
                          </span>
                        </td>
                        <td className="py-1 text-ink-soft">
                          {previous ? (
                            <>
                              {fmt(previous)}
                              <div className="text-xs tabular-nums">{formatDate(previous.date)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
        {hiddenCount > 0 && (
          <p className="mt-1 text-xs text-ink-soft">
            Ngoài ra còn {hiddenCount} chỉ số khác trong giới hạn bình thường, xem đầy đủ trong ứng dụng.
          </p>
        )}
      </Section>

      <Section title="Tiêm chủng">
        {series.length === 0 ? (
          <p className="text-ink-soft">Chưa có dữ liệu tiêm chủng.</p>
        ) : (
          <ul className="space-y-0.5">
            {series.map((s) => {
              const last = s.doses.at(-1);
              return (
                <li key={s.key}>
                  <span className="font-medium">{s.title}</span>: {s.doses.length} mũi
                  {last?.given_on && `, gần nhất ${formatDate(last.given_on)}`}
                </li>
              );
            })}
          </ul>
        )}
        {upcoming.length > 0 && (
          <p className="mt-1 text-ink-soft">
            Mũi tiếp theo:{" "}
            {upcoming.map((d) => `${d.disease ?? d.vaccine_name} (${formatDate(d.next_due_on)})`).join("; ")}
          </p>
        )}
      </Section>

      <Section title={`${RECENT_VISITS} lần khám gần nhất`}>
        {recentVisits.length === 0 ? (
          <p className="text-ink-soft">Chưa có lần khám.</p>
        ) : (
          <ul className="space-y-0.5">
            {recentVisits.map((v) => (
              <li key={v.id}>
                <span className="text-xs tabular-nums">{formatDate(v.visit_date)}</span>{" "}
                {[v.facility, v.department].filter(Boolean).join(" – ") || "Không rõ nơi khám"}
                {(v.cases?.title || v.reason) && <span className="text-ink-soft"> · {v.cases?.title ?? v.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="border-t border-line pt-2 text-xs text-ink-faint">
        Bản tóm tắt do người bệnh tự tổng hợp từ giấy tờ khám chữa bệnh, không thay thế bệnh án chính thức.
      </p>
    </div>
  );
}
