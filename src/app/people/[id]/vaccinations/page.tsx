import Link from "next/link";
import { notFound } from "next/navigation";
import { addVaccination, deleteVaccination } from "@/app/actions";
import { ConfirmForm } from "@/components/ConfirmForm";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { UpcomingDoses } from "@/components/UpcomingDoses";
import { createClient } from "@/lib/supabase/server";
import { formatDate, today } from "@/lib/format";
import { pendingDoses, seriesKey } from "@/lib/vaccinations";

export default async function VaccinationsPage({ params }: PageProps<"/people/[id]/vaccinations">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: person }, { data: doses }] = await Promise.all([
    supabase.from("people").select("full_name").eq("id", id).maybeSingle(),
    supabase
      .from("vaccinations")
      .select("*")
      .eq("person_id", id)
      .order("given_on", { ascending: true, nullsFirst: true }),
  ]);
  if (!person) notFound();

  // One block per disease (series), newest series activity first, doses oldest-first inside.
  const groups = new Map<string, { key: string; title: string; doses: NonNullable<typeof doses> }>();
  for (const d of doses ?? []) {
    const key = seriesKey(d);
    const g = groups.get(key);
    if (g) g.doses.push(d);
    else groups.set(key, { key, title: d.disease ?? d.vaccine_name, doses: [d] });
  }
  const series = [...groups.values()].sort((a, b) =>
    (b.doses.at(-1)?.given_on ?? "").localeCompare(a.doses.at(-1)?.given_on ?? ""),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/people/${id}`, label: person.full_name }}
        title="Sổ tiêm chủng"
        subtitle={`${doses?.length ?? 0} mũi đã ghi · Tải ảnh phiếu tiêm lên bằng nút "+" để AI tự điền.`}
      />

      <section>
        <h2 className="section-title">Mũi tiếp theo</h2>
        <div className="card">
          <UpcomingDoses doses={pendingDoses(doses ?? [])} />
        </div>
      </section>

      <section>
        <h2 className="section-title">Lịch sử tiêm</h2>
        {series.length === 0 && <p className="muted">Chưa có mũi tiêm nào.</p>}
        <div className="space-y-3">
          {series.map((s) => (
            <div key={s.key} className="card">
              <div className="mb-2 font-semibold">
                {s.title} <span className="muted font-normal">· {s.doses.length} mũi</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {s.doses.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <span className="font-medium">{d.dose_label ?? "Mũi tiêm"}</span>
                      {" · "}
                      {formatDate(d.given_on) || "Chưa rõ ngày"}
                      <div className="muted flex flex-wrap gap-x-2 [&>*+*]:before:mr-2 [&>*+*]:before:content-['·']">
                        <span>{d.vaccine_name}</span>
                        {d.facility && <span>{d.facility}</span>}
                        {d.lot_number && <span>Lô {d.lot_number}</span>}
                        {d.next_due_on && <span>Hẹn mũi sau {formatDate(d.next_due_on)}</span>}
                        {d.visit_id && (
                          <Link href={`/visits/${d.visit_id}`} className="hover:text-teal-700">
                            xem phiếu gốc
                          </Link>
                        )}
                      </div>
                      {d.notes && <p className="muted whitespace-pre-line">{d.notes}</p>}
                    </div>
                    <ConfirmForm
                      action={deleteVaccination.bind(null, d.id, id)}
                      message={`Xóa mũi ${d.dose_label ?? ""} ${d.vaccine_name} (${formatDate(d.given_on) || "chưa rõ ngày"})?`}
                    >
                      <button className="text-sm text-slate-400 hover:text-red-600">Xóa</button>
                    </ConfirmForm>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Thêm mũi tiêm</h2>
        <form action={addVaccination} className="card grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="person_id" value={id} />
          <label className="block sm:col-span-3">
            <span className="label">Tên vắc xin *</span>
            <input name="vaccine_name" required className="input" placeholder="VD: Vaxigrip Tetra" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Phòng bệnh</span>
            <input name="disease" className="input" placeholder="VD: Cúm" />
          </label>
          <label className="block">
            <span className="label">Mũi</span>
            <input name="dose_label" className="input" placeholder="Mũi 1" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Ngày tiêm</span>
            <input type="date" name="given_on" className="input" defaultValue={today()} />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Hẹn mũi tiếp</span>
            <input type="date" name="next_due_on" className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Số lô</span>
            <input name="lot_number" className="input" />
          </label>
          <label className="block sm:col-span-3">
            <span className="label">Nơi tiêm</span>
            <input name="facility" className="input" placeholder="VD: VNVC, trạm y tế phường…" />
          </label>
          <label className="block sm:col-span-3">
            <span className="label">Ghi chú</span>
            <input name="notes" className="input" placeholder="VD: sốt nhẹ sau tiêm" />
          </label>
          <div className="sm:col-span-6">
            <SubmitButton className="btn">+ Thêm mũi tiêm</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
