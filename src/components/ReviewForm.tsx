"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Paperclip, Plus, TriangleAlert, X } from "lucide-react";
import { confirmExtraction } from "@/app/actions";
import type { ExtractionResult } from "@/lib/ai/extract";
import { DOC_TYPE } from "@/lib/labels";

type Obs = ExtractionResult["observations"][number];
type Med = ExtractionResult["medications"][number];
type Preview = { url: string; name: string; mime: string | null };

const FLAGS: Record<string, string> = { normal: "Bình thường", high: "Cao", low: "Thấp", abnormal: "Bất thường" };
const emptyObs: Obs = { raw_name: "", test_code: null, value: "", unit: null, ref_range: null, flag: null };
const emptyMed: Med = { name: "", dose: null, schedule: null, duration_days: null, notes: null };

const nul = (v: string) => (v.trim() === "" ? null : v);

export function StringList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="input"
            value={v}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button type="button" className="btn" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Xóa">
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...items, ""])}>
        <Plus className="h-4 w-4" strokeWidth={1.75} />
        Thêm
      </button>
    </div>
  );
}

type Vax = ExtractionResult["vaccinations"][number];
const emptyVax: Vax = {
  vaccine_name: "",
  disease: null,
  dose_label: null,
  given_on: null,
  next_due_on: null,
  lot_number: null,
  facility: null,
  typically_single_dose: null,
};

// Tri-state select for typically_single_dose: the AI's general knowledge of the vaccine
// itself, not a claim about this specific patient - "unsure" is a real, valid answer.
function SingleDoseSelect({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <label className="col-span-2 sm:col-span-6">
      <span className="label">Số mũi cần thiết (theo kiến thức chung, không riêng cho người này)</span>
      <select
        className="input"
        value={value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")}
      >
        <option value="">Chưa rõ</option>
        <option value="true">Thường chỉ cần 1 mũi</option>
        <option value="false">Thường cần nhiều mũi / nhắc lại định kỳ</option>
      </select>
    </label>
  );
}

// Only shown for vaccination records (or when AI found doses anyway), so lab results don't get an empty section.
export function VaccinationFields({
  documentType,
  items,
  onChange,
}: {
  documentType: ExtractionResult["document_type"];
  items: Vax[];
  onChange: (items: Vax[]) => void;
}) {
  if (documentType !== "vaccination_record" && items.length === 0) return null;
  const setVax = (i: number, patch: Partial<Vax>) => onChange(items.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <section>
      <h2 className="section-title">Tiêm chủng ({items.length})</h2>
      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="card grid grid-cols-2 gap-2 sm:grid-cols-6">
            <input
              className="input col-span-2 sm:col-span-3"
              value={v.vaccine_name}
              placeholder="Tên vắc xin"
              aria-label="Tên vắc xin"
              onChange={(e) => setVax(i, { vaccine_name: e.target.value })}
            />
            <input
              className="input sm:col-span-2"
              value={v.disease ?? ""}
              placeholder="Phòng bệnh"
              aria-label="Phòng bệnh"
              onChange={(e) => setVax(i, { disease: nul(e.target.value) })}
            />
            <input
              className="input"
              value={v.dose_label ?? ""}
              placeholder="Mũi"
              aria-label="Mũi"
              onChange={(e) => setVax(i, { dose_label: nul(e.target.value) })}
            />
            <label className="col-span-1 sm:col-span-2">
              <span className="label">Ngày tiêm</span>
              <input
                type="date"
                className="input"
                value={v.given_on ?? ""}
                onChange={(e) => setVax(i, { given_on: nul(e.target.value) })}
              />
            </label>
            <label className="col-span-1 sm:col-span-2">
              <span className="label">Hẹn mũi tiếp</span>
              <input
                type="date"
                className="input"
                value={v.next_due_on ?? ""}
                onChange={(e) => setVax(i, { next_due_on: nul(e.target.value) })}
              />
            </label>
            <div className="col-span-2 flex items-end gap-2 sm:col-span-2">
              <input
                className="input"
                value={v.lot_number ?? ""}
                placeholder="Số lô"
                aria-label="Số lô"
                onChange={(e) => setVax(i, { lot_number: nul(e.target.value) })}
              />
              <button
                type="button"
                className="btn"
                aria-label="Xóa mũi tiêm"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <SingleDoseSelect
              value={v.typically_single_dose}
              onChange={(typically_single_dose) => setVax(i, { typically_single_dose })}
            />
          </div>
        ))}
        <button type="button" className="btn" onClick={() => onChange([...items, emptyVax])}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Thêm mũi tiêm
        </button>
      </div>
    </section>
  );
}

export function ReviewForm({
  documentId,
  visitId,
  initial,
  previews,
  catalog,
}: {
  documentId: string;
  visitId: string;
  initial: ExtractionResult;
  previews: Preview[];
  catalog: { code: string; name_vi: string }[];
}) {
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ExtractionResult>(key: K, value: ExtractionResult[K]) => setData((d) => ({ ...d, [key]: value }));
  const setObs = (i: number, patch: Partial<Obs>) =>
    set("observations", data.observations.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const setMed = (i: number, patch: Partial<Med>) =>
    set("medications", data.medications.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await confirmExtraction(documentId, data);
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
            <label className="block">
              <span className="label">Nơi khám</span>
              <input className="input" value={data.facility ?? ""} onChange={(e) => set("facility", nul(e.target.value))} />
            </label>
            <label className="block">
              <span className="label">Khoa</span>
              <input className="input" value={data.department ?? ""} onChange={(e) => set("department", nul(e.target.value))} />
            </label>
            <label className="block">
              <span className="label">Bác sĩ</span>
              <input className="input" value={data.doctor ?? ""} onChange={(e) => set("doctor", nul(e.target.value))} />
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
                  inputMode="numeric"
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
        <div className="sticky bottom-16 flex gap-2 border-t border-line bg-paper py-3 sm:bottom-0">
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
          <Link href={`/visits/${visitId}`} className="btn">
            Để sau
          </Link>
        </div>
      </div>
    </div>
  );
}
