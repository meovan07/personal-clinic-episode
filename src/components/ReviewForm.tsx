"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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

function StringList({
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
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...items, ""])}>
        + Thêm
      </button>
    </div>
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
            <a key={i} href={p.url} target="_blank" rel="noreferrer" className="card block">
              📎 {p.name}
            </a>
          ),
        )}
      </div>

      <div className="space-y-6">
        {data.uncertain.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="mb-1 font-medium">⚠ AI chưa chắc chắn, hãy kiểm tra kỹ:</div>
            <ul className="list-disc pl-5">
              {data.uncertain.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
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
                  o.flag === "high" || o.flag === "low" || o.flag === "abnormal" ? "border-red-200" : ""
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
                    ×
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => set("observations", [...data.observations, emptyObs])}>
              + Thêm chỉ số
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
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => set("medications", [...data.medications, emptyMed])}>
              + Thêm thuốc
            </button>
          </div>
        </section>

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

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-slate-50 py-3">
          <button className="btn-primary" disabled={pending} onClick={save}>
            {pending ? "Đang lưu…" : "✓ Xác nhận & lưu"}
          </button>
          <Link href={`/visits/${visitId}`} className="btn">
            Để sau
          </Link>
        </div>
      </div>
    </div>
  );
}
