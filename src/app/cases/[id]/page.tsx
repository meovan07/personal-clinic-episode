import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import { deleteCase } from "@/app/actions";
import { ActionItems } from "@/components/ActionItems";
import { Badge } from "@/components/Badge";
import { ConfirmForm } from "@/components/ConfirmForm";
import { MoreMenu } from "@/components/MoreMenu";
import { PageHeader } from "@/components/PageHeader";
import { ResultRow } from "@/components/ResultRow";
import { VisitList } from "@/components/VisitList";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { CASE_STATUS, CASE_STATUS_TONE } from "@/lib/labels";
import { latestResults, OUT_OF_RANGE } from "@/lib/results";

// One illness over time: where it stands, the results that matter for it (with their trend), what to do next,
// and the visits that belong to it.
export default async function CasePage({ params }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase.from("cases").select("*, people(full_name)").eq("id", id).maybeSingle();
  if (!item) notFound();
  const { data: visits } = await supabase
    .from("visits")
    .select("id, visit_date, facility, reason, documents(count)")
    .eq("case_id", id)
    .order("visit_date", { ascending: false, nullsFirst: false });

  const visitDates = new Map((visits ?? []).map((v) => [v.id, v.visit_date]));
  const visitIds = [...visitDates.keys()];
  const [obs, todos] = visitIds.length
    ? await Promise.all([
        supabase
          .from("observations")
          .select(
            "visit_id, test_code, raw_name, value, value_text, unit, raw_unit, ref_range_text, flag, test_catalog(name_vi, category)",
          )
          .in("visit_id", visitIds),
        supabase
          .from("action_items")
          .select("id, content, due_on, done, visit_id, notes")
          .in("visit_id", visitIds)
          .eq("done", false)
          .order("due_on", { ascending: true, nullsFirst: false }),
      ])
    : [{ data: [] }, { data: [] }];

  // The results worth following for this illness: ones measured more than once (a trend) or out of range now.
  const results = latestResults(obs.data ?? [], visitDates)
    .filter((r) => (r.points?.length ?? 0) >= 2 || OUT_OF_RANGE.has(r.flag ?? ""))
    .sort(
      (a, b) =>
        Number(OUT_OF_RANGE.has(b.flag ?? "")) - Number(OUT_OF_RANGE.has(a.flag ?? "")) ||
        (b.points?.length ?? 0) - (a.points?.length ?? 0),
    );

  return (
    <div className="space-y-10">
      <PageHeader
        back={{ href: `/people/${item.person_id}`, label: item.people.full_name }}
        title={item.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={CASE_STATUS_TONE[item.status]}>{CASE_STATUS[item.status]}</Badge>
            {item.started_on && `Từ ${formatDate(item.started_on)}`}
            {item.ended_on && ` đến ${formatDate(item.ended_on)}`}
            {` · ${visits?.length ?? 0} lần khám`}
          </span>
        }
        actions={
          <>
            <Link href={`/visits/new?person=${item.person_id}&case=${id}`} className="btn">
              <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
              Thêm lần khám
            </Link>
            <MoreMenu>
              <Link href={`/cases/${id}/edit`} className="menu-item">
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
                Sửa bệnh án
              </Link>
              <ConfirmForm
                action={deleteCase.bind(null, id, item.person_id)}
                message="Xóa bệnh án này? Các lần khám vẫn được giữ lại (chỉ bỏ liên kết)."
              >
                <button type="button" className="menu-item text-stamp">
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  Xóa bệnh án
                </button>
              </ConfirmForm>
            </MoreMenu>
          </>
        }
      />

      {item.notes && <div className="card whitespace-pre-line">{item.notes}</div>}

      {results.length > 0 && (
        <section>
          <h2 className="section-title">Chỉ số theo dõi</h2>
          <div className="card divide-y divide-line py-1">
            {results.map((r) => (
              <ResultRow key={r.key} r={r} />
            ))}
          </div>
        </section>
      )}

      {(todos.data?.length ?? 0) > 0 && (
        <section>
          <h2 className="section-title">Việc cần làm</h2>
          <div className="card">
            <ActionItems items={todos.data ?? []} />
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Các lần khám</h2>
        <VisitList visits={visits ?? []} />
      </section>
    </div>
  );
}
