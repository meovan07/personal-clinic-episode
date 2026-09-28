import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePerson } from "@/app/actions";
import { ActionItems } from "@/components/ActionItems";
import { ConfirmForm } from "@/components/ConfirmForm";
import { PageHeader } from "@/components/PageHeader";
import { VisitList } from "@/components/VisitList";
import { createClient } from "@/lib/supabase/server";
import { age, formatDate } from "@/lib/format";
import { CASE_STATUS, CASE_STATUS_STYLE, SEX } from "@/lib/labels";

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: person } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (!person) notFound();

  const [cases, visits, actions] = await Promise.all([
    supabase.from("cases").select("*, visits(count)").eq("person_id", id).order("started_on", { ascending: false }),
    supabase
      .from("visits")
      .select("id, visit_date, facility, reason, cases(title), documents(count)")
      .eq("person_id", id)
      .order("visit_date", { ascending: false }),
    supabase
      .from("action_items")
      .select("id, content, due_on, done, visit_id")
      .eq("person_id", id)
      .order("done")
      .order("created_at", { ascending: false }),
  ]);

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
              + Lần khám
            </Link>
            <Link href={`/people/${id}/edit`} className="btn">
              Sửa
            </Link>
          </>
        }
      />

      {(person.allergies || person.chronic_conditions || person.notes) && (
        <div className="card space-y-2">
          {person.allergies && (
            <p>
              <span className="font-medium text-red-600">⚠ Dị ứng:</span> {person.allergies}
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
          <h2 className="section-title mb-0">Bệnh án</h2>
          <Link href={`/cases/new?person=${id}`} className="btn">
            + Bệnh án
          </Link>
        </div>
        {cases.data?.length === 0 && <p className="muted">Chưa có bệnh án. Lần khám lẻ vẫn có thể lưu không cần bệnh án.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {cases.data?.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="card hover:border-teal-300">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{c.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${CASE_STATUS_STYLE[c.status]}`}>
                  {CASE_STATUS[c.status]}
                </span>
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
        className="border-t border-slate-200 pt-6"
      >
        <button className="btn-danger">Xóa hồ sơ</button>
      </ConfirmForm>
    </div>
  );
}
