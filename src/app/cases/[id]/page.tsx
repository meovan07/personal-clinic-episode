import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Pencil } from "lucide-react";
import { deleteCase } from "@/app/actions";
import { Badge } from "@/components/Badge";
import { ConfirmForm } from "@/components/ConfirmForm";
import { PageHeader } from "@/components/PageHeader";
import { VisitList } from "@/components/VisitList";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { CASE_STATUS, CASE_STATUS_TONE } from "@/lib/labels";

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

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/people/${item.person_id}`, label: item.people.full_name }}
        title={item.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={CASE_STATUS_TONE[item.status]}>{CASE_STATUS[item.status]}</Badge>
            {item.started_on && `Từ ${formatDate(item.started_on)}`}
            {item.ended_on && ` đến ${formatDate(item.ended_on)}`}
          </span>
        }
        actions={
          <>
            <Link href={`/visits/new?person=${item.person_id}&case=${id}`} className="btn-primary">
              <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
              Lần khám
            </Link>
            <Link href={`/cases/${id}/edit`} className="btn">
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
              Sửa
            </Link>
          </>
        }
      />
      {item.notes && <div className="card whitespace-pre-line">{item.notes}</div>}
      <section>
        <h2 className="section-title">Các lần khám</h2>
        <VisitList visits={visits ?? []} />
      </section>
      <ConfirmForm
        action={deleteCase.bind(null, id, item.person_id)}
        message="Xóa bệnh án này? Các lần khám vẫn được giữ lại (chỉ bỏ liên kết)."
        className="border-t border-line pt-6"
      >
        <button className="btn-danger">Xóa bệnh án</button>
      </ConfirmForm>
    </div>
  );
}
