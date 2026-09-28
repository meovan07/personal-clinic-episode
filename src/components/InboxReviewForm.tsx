"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Paperclip, Plus, TriangleAlert, X } from "lucide-react";
import { confirmInboxItem, discardInboxItem, type CaseChoice, type VisitChoice } from "@/app/actions";
import { ConfirmForm } from "@/components/ConfirmForm";
import { StringList, VaccinationFields } from "@/components/ReviewForm";
import type { ExtractionResult, InboxExtractionResult } from "@/lib/ai/extract";
import { DOC_TYPE } from "@/lib/labels";
import { formatDate } from "@/lib/format";

type Obs = ExtractionResult["observations"][number];
type Med = ExtractionResult["medications"][number];
type Preview = { url: string; name: string; mime: string | null };
type PersonOpt = { id: string; full_name: string };
type CaseOpt = { id: string; person_id: string; title: string; status: string };
type SuggestedVisit = {
  id: string;
  visit_date: string | null;
  facility: string | null;
  department: string | null;
  doctor: string | null;
  case_id: string | null;
  cases: { title: string } | null;
} | null;

const FLAGS: Record<string, string> = { normal: "Bình thường", high: "Cao", low: "Thấp", abnormal: "Bất thường" };
const emptyObs: Obs = { raw_name: "", test_code: null, value: "", unit: null, ref_range: null, flag: null };
const emptyMed: Med = { name: "", dose: null, schedule: null, duration_days: null, notes: null };
const nul = (v: string) => (v.trim() === "" ? null : v);

export function InboxReviewForm({
  inboxId,
  initial,
  people,
  cases,
  catalog,
  previews,
  suggestedPersonId,
  suggestedCaseId,
  suggestedIsNewCase,
  suggestedNewCaseTitle,
  suggestedVisit,
}: {
  inboxId: string;
  initial: InboxExtractionResult;
  people: PersonOpt[];
  cases: CaseOpt[];
  catalog: { code: string; name_vi: string }[];
  previews: Preview[];
  suggestedPersonId: string | null;
  suggestedCaseId: string | null;
  suggestedIsNewCase: boolean;
  suggestedNewCaseTitle: string | null;
  suggestedVisit: SuggestedVisit;
}) {
  const [data, setData] = useState<ExtractionResult>(initial);
  const [personId, setPersonId] = useState(suggestedPersonId ?? people[0]?.id ?? "");
  const [useExistingVisit, setUseExistingVisit] = useState(!!suggestedVisit);
  const [caseMode, setCaseMode] = useState<"none" | "existing" | "new">(
    suggestedIsNewCase ? "new" : suggestedCaseId ? "existing" : "none",
  );
  const [caseExistingId, setCaseExistingId] = useState(suggestedCaseId ?? "");
  const [newCaseTitle, setNewCaseTitle] = useState(suggestedNewCaseTitle ?? "");
  const [visitDate, setVisitDate] = useState(initial.document_date ?? "");
  const [facility, setFacility] = useState(initial.facility ?? "");
  const [department, setDepartment] = useState(initial.department ?? "");
  const [doctor, setDoctor] = useState(initial.doctor ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ExtractionResult>(key: K, value: ExtractionResult[K]) => setData((d) => ({ ...d, [key]: value }));
  const setObs = (i: number, patch: Partial<Obs>) =>
    set("observations", data.observations.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const setMed = (i: number, patch: Partial<Med>) =>
    set("medications", data.medications.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const personCases = useMemo(() => cases.filter((c) => c.person_id === personId), [cases, personId]);
  const canMergeVisit = !!suggestedVisit && personId === suggestedPersonId;
  const merging = canMergeVisit && useExistingVisit;
  const lowConfidence = initial.person_match_confidence === "low" || !suggestedPersonId;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const visit: VisitChoice = merging
          ? { type: "existing", id: suggestedVisit!.id }
          : { type: "new", visit_date: nul(visitDate), facility: nul(facility), department: nul(department), doctor: nul(doctor) };
        const caseChoice: CaseChoice = merging
          ? { type: "none" }
          : caseMode === "existing" && caseExistingId
            ? { type: "existing", id: caseExistingId }
            : caseMode === "new"
              ? { type: "new", title: newCaseTitle.trim() || "Bệnh án mới" }
              : { type: "none" };
        await confirmInboxItem(inboxId, { personId, case: caseChoice, visit, reviewed: data });
      } catch (e) {
        // redirect() throws a special error that Next handles; anything else is a real failure.
        if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) setError(e.message);
        else throw e;
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto">
        {previews.map((p, i) =>
          p.mime === "application/pdf" ? (
            <iframe key={i} src={p.url} title={p.name} className="h-[70vh] w-full rounded-lg border bg-white" />
          ) : /^image\/(jpeg|png|gif|webp|avif)$/.test(p.mime ?? "") ? (
            <a key={i} href={p.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs, not optimizable */}
              <img src={p.url} alt={p.name} className="w-full rounded-lg border bg-white" />
            </a>
          ) : (
            <a key={i} href={p.url} target="_blank" rel="noreferrer" className="card flex items-center gap-2">
              <Paperclip className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {p.name}
            </a>
          ),
        )}
      </div>

      <div className="space-y-6">
        {lowConfidence && (
          <div className="flex gap-3 rounded-lg border border-flag-low/30 bg-flag-low-tint p-4 text-sm text-ink">
            <TriangleAlert className="h-5 w-5 shrink-0 text-flag-low" strokeWidth={1.75} />
            AI chưa chắc chắn tài liệu này của ai, hãy kiểm tra kỹ mục &quot;Người bệnh&quot; bên dưới.
          </div>
        )}
        {data.uncertain.length > 0 && (
          <div className="flex gap-3 rounded-lg border border-flag-low/30 bg-flag-low-tint p-4 text-sm text-ink">
            <TriangleAlert className="h-5 w-5 shrink-0 text-flag-low" strokeWidth={1.75} />
            <div>
              <div className="mb-1 font-medium">AI chưa chắc chắn, hãy kiểm tra kỹ:</div>
              <ul className="list-disc pl-5">
                {data.uncertain.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <section className="card space-y-3">
          <label className="block">
            <span className="label">Người bệnh</span>
            <select
              className="input"
              value={personId}
              onChange={(e) => {
                setPersonId(e.target.value);
                setUseExistingVisit(false);
                setCaseMode("none");
                setCaseExistingId("");
              }}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>

          {canMergeVisit ? (
            <div className="rounded-lg border border-line bg-paper-dim p-3 text-sm">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={useExistingVisit}
                  onChange={(e) => setUseExistingVisit(e.target.checked)}
                />
                <span>
                  Gộp vào lần khám ngày {formatDate(suggestedVisit!.visit_date) || "(chưa rõ)"}
                  {suggestedVisit!.facility && ` tại ${suggestedVisit!.facility}`}
                  {suggestedVisit!.cases && ` · Bệnh án: ${suggestedVisit!.cases.title}`}
                  {!suggestedVisit!.cases && " · Khám lẻ"}
                  <br />
                  <span className="muted">Bỏ chọn để tạo lần khám mới thay vào đó.</span>
                </span>
              </label>
            </div>
          ) : null}

          {!merging && (
            <>
              <label className="block">
                <span className="label">Bệnh án</span>
                <select
                  className="input"
                  value={caseMode === "existing" ? caseExistingId : caseMode}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "none" || v === "new") {
                      setCaseMode(v);
                      setCaseExistingId("");
                    } else {
                      setCaseMode("existing");
                      setCaseExistingId(v);
                    }
                  }}
                >
                  <option value="none">— Không (khám lẻ)</option>
                  <option value="new">+ Tạo bệnh án mới</option>
                  {personCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              {caseMode === "new" && (
                <input
                  className="input"
                  placeholder="Tên bệnh án, VD: Viêm dạ dày"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Ngày khám</span>
                  <input type="date" className="input" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                </label>
                <label className="block">
                  <span className="label">Nơi khám</span>
                  <input className="input" value={facility} onChange={(e) => setFacility(e.target.value)} />
                </label>
                <label className="block">
                  <span className="label">Khoa</span>
                  <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} />
                </label>
                <label className="block">
                  <span className="label">Bác sĩ</span>
                  <input className="input" value={doctor} onChange={(e) => setDoctor(e.target.value)} />
                </label>
              </div>
            </>
          )}
        </section>

        <section className="card space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Loại tài liệu</span>
              <select
                className="input"
                value={data.document_type}
                onChange={(e) => set("document_type", e.target.value as ExtractionResult["document_type"])}
              >
                {Object.entries(DOC_TYPE).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label">Tóm tắt</span>
            <textarea className="input" rows={3} value={data.summary} onChange={(e) => set("summary", e.target.value)} />
          </label>
          <div>
            <span className="label">Chẩn đoán</span>
            <StringList items={data.diagnoses} onChange={(v) => set("diagnoses", v)} placeholder="VD: Viêm dạ dày (K29)" />
          </div>
        </section>

        <section>
          <h2 className="section-title">Chỉ số ({data.observations.length})</h2>
          <div className="space-y-2">
            {data.observations.map((o, i) => (
              <div
                key={i}
                className={`card grid grid-cols-2 gap-2 sm:grid-cols-6 ${
                  o.flag === "high" || o.flag === "low" || o.flag === "abnormal" ? "border-stamp/30" : ""
                }`}
              >
                <input
                  className="input col-span-2 sm:col-span-3"
                  value={o.raw_name}
                  placeholder="Tên xét nghiệm"
                  aria-label="Tên xét nghiệm"
                  onChange={(e) => setObs(i, { raw_name: e.target.value })}
                />
                <select
                  className="input col-span-2 sm:col-span-3"
                  value={o.test_code ?? ""}
                  aria-label="Nhóm chỉ số"
                  onChange={(e) => setObs(i, { test_code: nul(e.target.value) })}
                >
                  <option value="">— Chưa khớp danh mục</option>
                  {catalog.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name_vi}
                    </option>
                  ))}
                </select>
                <input
                  className="input sm:col-span-2"
                  value={o.value}
                  placeholder="Kết quả"
                  aria-label="Kết quả"
                  onChange={(e) => setObs(i, { value: e.target.value })}
                />
                <input
                  className="input"
                  value={o.unit ?? ""}
                  placeholder="Đơn vị"
                  aria-label="Đơn vị"
                  onChange={(e) => setObs(i, { unit: nul(e.target.value) })}
                />
                <input
                  className="input sm:col-span-2"
                  value={o.ref_range ?? ""}
                  placeholder="Tham chiếu"
                  aria-label="Khoảng tham chiếu"
                  onChange={(e) => setObs(i, { ref_range: nul(e.target.value) })}
                />
                <div className="flex gap-2">
                  <select
                    className="input"
                    value={o.flag ?? ""}
                    aria-label="Đánh giá"
                    onChange={(e) => setObs(i, { flag: (nul(e.target.value) as Obs["flag"]) ?? null })}
                  >
                    <option value="">—</option>
                    {Object.entries(FLAGS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn"
                    aria-label="Xóa chỉ số"
                    onClick={() => set("observations", data.observations.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => set("observations", [...data.observations, emptyObs])}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Thêm chỉ số
            </button>
          </div>
        </section>

        <section>
          <h2 className="section-title">Thuốc ({data.medications.length})</h2>
          <div className="space-y-2">
            {data.medications.map((m, i) => (
              <div key={i} className="card grid grid-cols-2 gap-2 sm:grid-cols-6">
                <input
                  className="input col-span-2 sm:col-span-3"
                  value={m.name}
                  placeholder="Tên thuốc"
                  aria-label="Tên thuốc"
                  onChange={(e) => setMed(i, { name: e.target.value })}
                />
                <input
                  className="input sm:col-span-1"
                  value={m.dose ?? ""}
                  placeholder="Liều"
                  aria-label="Liều"
                  onChange={(e) => setMed(i, { dose: nul(e.target.value) })}
                />
                <input
                  className="input sm:col-span-2"
                  type="number"
                  min={1}
                  value={m.duration_days ?? ""}
                  placeholder="Số ngày"
                  aria-label="Số ngày"
                  onChange={(e) => setMed(i, { duration_days: e.target.value ? Number(e.target.value) : null })}
                />
                <input
                  className="input col-span-2 sm:col-span-5"
                  value={m.schedule ?? ""}
                  placeholder="Cách dùng"
                  aria-label="Cách dùng"
                  onChange={(e) => setMed(i, { schedule: nul(e.target.value) })}
                />
                <button
                  type="button"
                  className="btn"
                  aria-label="Xóa thuốc"
                  onClick={() => set("medications", data.medications.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => set("medications", [...data.medications, emptyMed])}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Thêm thuốc
            </button>
          </div>
        </section>

        <VaccinationFields
          documentType={data.document_type}
          items={data.vaccinations}
          onChange={(v) => set("vaccinations", v)}
        />

        <section className="card space-y-3">
          <div>
            <span className="label">Bác sĩ dặn (sẽ thành việc cần làm)</span>
            <StringList items={data.doctor_advice} onChange={(v) => set("doctor_advice", v)} placeholder="VD: Giảm cân 3-5kg" />
          </div>
          <label className="block">
            <span className="label">Ngày tái khám</span>
            <input
              type="date"
              className="input"
              value={data.follow_up_date ?? ""}
              onChange={(e) => set("follow_up_date", nul(e.target.value))}
            />
          </label>
        </section>

        {error && <p className="text-sm text-stamp">{error}</p>}
        <div className="sticky bottom-16 flex flex-wrap gap-2 border-t border-line bg-paper py-3 sm:bottom-0">
          <button className="btn-primary" disabled={pending} onClick={save}>
            {pending ? (
              "Đang lưu…"
            ) : (
              <>
                <Check className="h-4 w-4" strokeWidth={2} />
                Xác nhận & lưu
              </>
            )}
          </button>
          <ConfirmForm action={discardInboxItem.bind(null, inboxId)} message="Bỏ tài liệu này? File gốc sẽ bị xóa.">
            <button className="btn" type="button">
              Bỏ tài liệu này
            </button>
          </ConfirmForm>
          <Link href="/" className="btn">
            Để sau
          </Link>
        </div>
      </div>
    </div>
  );
}
