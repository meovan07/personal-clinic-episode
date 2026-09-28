import Link from "next/link";
import { notFound } from "next/navigation";
import { addMedication, deleteDocument, deleteMedication, deleteVisit } from "@/app/actions";
import { ActionItems } from "@/components/ActionItems";
import { AiReadButton } from "@/components/AiReadButton";
import { ConfirmForm } from "@/components/ConfirmForm";
import { DocumentUploader } from "@/components/DocumentUploader";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { DOC_TYPE } from "@/lib/labels";

// AI extraction runs inside a server action on this page and can take a minute.
export const maxDuration = 300;

const FLAG_STYLE: Record<string, string> = {
  high: "text-red-600 font-semibold",
  low: "text-blue-600 font-semibold",
  abnormal: "text-red-600 font-semibold",
};
const FLAG_ARROW: Record<string, string> = { high: "↑", low: "↓", abnormal: "!" };

// Browsers other than Safari can't display HEIC, so those are shown as links.
const PREVIEWABLE = /^image\/(jpeg|png|gif|webp|avif)$/;

export default async function VisitPage({ params }: PageProps<"/visits/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: visit } = await supabase
    .from("visits")
    .select("*, people(full_name), cases(id, title)")
    .eq("id", id)
    .maybeSingle();
  if (!visit) notFound();

  const [docs, meds, actions, observations] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, title, doc_type, created_at, summary, extraction_status, extraction_error, document_files(id, page_no, storage_path, file_name, mime_type)",
      )
      .eq("visit_id", id)
      .order("created_at")
      .order("page_no", { referencedTable: "document_files" }),
    supabase.from("medications").select("*").eq("visit_id", id).order("created_at"),
    supabase.from("action_items").select("id, content, due_on, done, visit_id").eq("visit_id", id).order("created_at"),
    supabase
      .from("observations")
      .select("id, raw_name, value, value_text, unit, raw_value, raw_unit, ref_range_text, flag, test_catalog(name_vi)")
      .eq("visit_id", id)
      .order("created_at"),
  ]);

  const paths = (docs.data ?? []).flatMap((d) => d.document_files.map((f) => f.storage_path));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("documents").createSignedUrls(paths, 60 * 60);
    data?.forEach((s) => s.path && s.signedUrl && signed.set(s.path, s.signedUrl));
  }

  const details = [
    visit.department && ["Khoa", visit.department],
    visit.doctor && ["Bác sĩ", visit.doctor],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/people/${visit.person_id}`, label: visit.people.full_name }}
        title={`Khám ngày ${formatDate(visit.visit_date) || "(chưa rõ)"}`}
        subtitle={
          <>
            {visit.facility ?? "Chưa ghi nơi khám"}
            {visit.cases && (
              <>
                {" · "}
                <Link href={`/cases/${visit.cases.id}`} className="text-teal-700 hover:underline">
                  📁 {visit.cases.title}
                </Link>
              </>
            )}
          </>
        }
        actions={
          <Link href={`/visits/${id}/edit`} className="btn">
            Sửa
          </Link>
        }
      />

      {(details.length > 0 || visit.reason || visit.notes) && (
        <div className="card space-y-3">
          {details.map(([k, v]) => (
            <p key={k}>
              <span className="muted">{k}:</span> {v}
            </p>
          ))}
          {visit.reason && (
            <div>
              <div className="muted">Lý do khám</div>
              <p className="whitespace-pre-line">{visit.reason}</p>
            </div>
          )}
          {visit.notes && (
            <div>
              <div className="muted">Ghi chú</div>
              <p className="whitespace-pre-line">{visit.notes}</p>
            </div>
          )}
        </div>
      )}

      <section>
        <h2 className="section-title">Tài liệu</h2>
        <div className="space-y-3">
          {docs.data?.map((d) => (
            <div key={d.id} className="card">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{d.title ?? DOC_TYPE[d.doc_type]}</div>
                  <div className="muted">
                    {DOC_TYPE[d.doc_type]} · {d.document_files.length} trang
                  </div>
                </div>
                <ConfirmForm action={deleteDocument.bind(null, d.id, id)} message="Xóa tài liệu này và file gốc?">
                  <button className="text-sm text-slate-400 hover:text-red-600">Xóa</button>
                </ConfirmForm>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.document_files.map((f) => {
                  const url = signed.get(f.storage_path);
                  if (!url) return null;
                  return PREVIEWABLE.test(f.mime_type ?? "") ? (
                    <a key={f.id} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs, not optimizable */}
                      <img src={url} alt={f.file_name} className="h-32 w-24 rounded-lg border object-cover" />
                    </a>
                  ) : (
                    <a
                      key={f.id}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-32 w-24 flex-col items-center justify-center rounded-lg border bg-slate-50 p-2 text-center text-xs hover:border-teal-300"
                    >
                      <span className="text-2xl">{f.mime_type === "application/pdf" ? "📄" : "🖼"}</span>
                      <span className="mt-1 line-clamp-3 break-all">{f.file_name}</span>
                    </a>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                {d.extraction_status === "confirmed" ? (
                  <div className="space-y-2">
                    {d.summary && <p className="whitespace-pre-line text-sm">{d.summary}</p>}
                    <Link href={`/documents/${d.id}/review`} className="text-sm text-teal-700 hover:underline">
                      ✓ Đã xác nhận · Sửa kết quả
                    </Link>
                  </div>
                ) : d.extraction_status === "needs_review" ? (
                  <Link href={`/documents/${d.id}/review`} className="btn-primary">
                    AI đã đọc xong: kiểm tra & xác nhận →
                  </Link>
                ) : (
                  <>
                    {d.extraction_status === "failed" && (
                      <p className="mb-2 text-sm text-red-600">Lần đọc trước bị lỗi: {d.extraction_error}</p>
                    )}
                    <AiReadButton
                      documentId={d.id}
                      label={d.extraction_status === "pending" ? "🤖 Đọc lại bằng AI" : undefined}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
          <DocumentUploader visitId={id} />
        </div>
      </section>

      {(observations.data?.length ?? 0) > 0 && (
        <section>
          <h2 className="section-title">Kết quả xét nghiệm / chỉ số</h2>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Chỉ số</th>
                  <th className="px-4 py-2 font-medium">Kết quả</th>
                  <th className="px-4 py-2 font-medium">Tham chiếu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {observations.data?.map((o) => {
                  const converted = o.raw_unit && o.unit !== o.raw_unit;
                  return (
                    <tr key={o.id}>
                      <td className="px-4 py-2">
                        {o.test_catalog?.name_vi ?? o.raw_name}
                        {o.test_catalog && o.test_catalog.name_vi !== o.raw_name && (
                          <div className="text-xs text-slate-400">{o.raw_name}</div>
                        )}
                      </td>
                      <td className={`px-4 py-2 ${FLAG_STYLE[o.flag ?? ""] ?? ""}`}>
                        {o.value ?? o.value_text} {o.unit} {FLAG_ARROW[o.flag ?? ""]}
                        {converted && (
                          <div className="text-xs font-normal text-slate-400">
                            Gốc: {o.raw_value} {o.raw_unit}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{o.ref_range_text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Thuốc được kê</h2>
        <div className="card space-y-3">
          {meds.data?.length === 0 && <p className="muted">Chưa có thuốc.</p>}
          <ul className="divide-y divide-slate-100">
            {meds.data?.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2 py-2">
                <div>
                  <span className="font-medium">{m.name}</span> {m.dose && <span>{m.dose}</span>}
                  <div className="muted">
                    {[m.schedule, m.duration_days && `${m.duration_days} ngày`, m.notes].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <form action={deleteMedication.bind(null, m.id, id)}>
                  <button className="text-slate-400 hover:text-red-600" aria-label="Xóa">
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addMedication} className="grid gap-2 sm:grid-cols-5">
            <input type="hidden" name="visit_id" value={id} />
            <input name="name" required placeholder="Tên thuốc" className="input sm:col-span-2" />
            <input name="dose" placeholder="Liều (20mg)" className="input" />
            <input name="schedule" placeholder="Cách dùng (2 lần/ngày)" className="input" />
            <input name="duration_days" type="number" min={1} placeholder="Số ngày" className="input" />
            <div className="sm:col-span-5">
              <SubmitButton className="btn">+ Thêm thuốc</SubmitButton>
            </div>
          </form>
        </div>
      </section>

      <section>
        <h2 className="section-title">Bác sĩ dặn / việc cần làm</h2>
        <div className="card">
          <ActionItems items={actions.data ?? []} personId={visit.person_id} visitId={id} />
        </div>
      </section>

      <ConfirmForm
        action={deleteVisit.bind(null, id, visit.person_id)}
        message="Xóa lần khám này cùng toàn bộ tài liệu và thuốc? Không thể hoàn tác."
        className="border-t border-slate-200 pt-6"
      >
        <button className="btn-danger">Xóa lần khám</button>
      </ConfirmForm>
    </div>
  );
}
