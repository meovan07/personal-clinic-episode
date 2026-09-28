"use client";

import { useRef, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import {
  createDocument,
  createVisit,
  findDuplicateFiles,
  readDocumentWithAI,
  saveVisit,
  type UploadedFile,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { extension, sha256 } from "@/lib/hash";
import { formatBytes } from "@/lib/format";
import type { Tables } from "@/lib/database.types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

// redirect() throws a special error Next handles as navigation; anything else is a real failure.
function isRedirectThrow(e: unknown) {
  return e instanceof Error && e.message.includes("NEXT_REDIRECT");
}

// "Thêm lần khám": upload comes first. Picking a photo doesn't just attach it - it creates
// the visit right away, uploads, and has AI read it, then fills the fields below (date,
// facility, department, doctor) with what it found, so there's nothing left to type by
// hand. The user only reviews/corrects before the final Lưu, instead of retyping what a
// photo of the same visit already says.
export function NewVisitForm({
  personId,
  cases,
  defaultCaseId,
}: {
  personId: string;
  cases: Pick<Tables<"cases">, "id" | "title">[];
  defaultCaseId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addPicked(picked: File[]) {
    if (picked.length === 0) return;
    setError(null);
    setFiles((f) => [...f, ...picked]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function fillIfEmpty(name: string, value: string | null) {
    if (!value || !formRef.current) return;
    const el = formRef.current.elements.namedItem(name) as HTMLInputElement | null;
    if (el && !el.value) el.value = value;
  }

  async function readAndFill() {
    if (!formRef.current || files.length === 0) return;
    setError(null);
    const fd = new FormData(formRef.current);
    const supabase = createClient();
    const uploaded: UploadedFile[] = [];
    try {
      // Reuse the visit from a previous failed attempt instead of creating a duplicate.
      let newVisitId = visitId;
      if (!newVisitId) {
        setBusy("Đang lưu lần khám…");
        newVisitId = await createVisit(fd);
        setVisitId(newVisitId);
      }

      setBusy("Đang kiểm tra…");
      const hashes = await Promise.all(files.map(sha256));
      if (new Set(hashes).size !== hashes.length) throw new Error("Bạn đã chọn cùng một file hai lần.");
      const dups = await findDuplicateFiles(hashes);
      if (dups.length > 0) {
        throw new Error(`File đã được tải lên trước đó: ${dups.map((d) => d.file_name).join(", ")}`);
      }

      for (const [i, file] of files.entries()) {
        setBusy(`Đang tải ${i + 1}/${files.length}…`);
        const path = `${newVisitId}/${crypto.randomUUID()}.${extension(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw new Error(upErr.message);
        uploaded.push({
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          sha256: hashes[i],
        });
      }

      setBusy("Đang lưu tài liệu…");
      const documentId = await createDocument({ visitId: newVisitId, title: null, docType: "other", files: uploaded });

      setBusy("AI đang đọc… (khoảng 30-60 giây)");
      const { error: readError, visitFields } = await readDocumentWithAI(documentId);
      if (readError) throw new Error(readError);

      if (visitFields) {
        fillIfEmpty("visit_date", visitFields.visit_date);
        fillIfEmpty("facility", visitFields.facility);
        fillIfEmpty("department", visitFields.department);
        fillIfEmpty("doctor", visitFields.doctor);
      }
      setFilled(true);
    } catch (err) {
      if (uploaded.length > 0) {
        await supabase.storage.from("documents").remove(uploaded.map((f) => f.storage_path));
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!formRef.current) return;
    setError(null);
    const fd = new FormData(formRef.current);
    if (visitId) fd.set("id", visitId);
    try {
      setBusy("Đang lưu…");
      await saveVisit(fd);
    } catch (e) {
      if (!isRedirectThrow(e)) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(null);
      } else throw e;
    }
  }

  const primaryAction = files.length > 0 && !filled ? readAndFill : save;
  const primaryLabel =
    files.length > 0 && !filled ? (
      <>
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        Đọc bằng AI &amp; điền thông tin
      </>
    ) : (
      "Lưu"
    );

  return (
    <form
      ref={formRef}
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        primaryAction();
      }}
    >
      <input type="hidden" name="person_id" value={personId} />

      <div className="space-y-3 rounded-lg border-2 border-dashed border-line-strong bg-surface p-4">
        <span className="label">Ảnh / PDF tài liệu (không bắt buộc) — AI sẽ đọc và tự điền các ô bên dưới</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          disabled={!!visitId}
          onChange={(e) => addPicked(Array.from(e.target.files ?? []))}
        />
        {files.length === 0 ? (
          <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Chụp / chọn ảnh
          </button>
        ) : (
          <>
            <ul className="muted space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    Trang {i + 1}: {f.name} ({formatBytes(f.size)})
                  </span>
                  {!visitId && (
                    <button
                      type="button"
                      className="shrink-0 text-ink-faint hover:text-stamp"
                      aria-label="Xóa"
                      onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!visitId && (
              <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Chụp/chọn thêm trang
              </button>
            )}
            {filled && <p className="text-sm text-pine">✓ AI đã đọc xong và điền thông tin bên dưới — kiểm tra lại rồi lưu.</p>}
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ngày khám">
          <input type="date" name="visit_date" className="input" />
        </Field>
        <Field label="Thuộc bệnh án">
          <select name="case_id" className="input" defaultValue={defaultCaseId ?? ""}>
            <option value="">— Không (khám lẻ / khám định kỳ)</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Nơi khám">
        <input name="facility" className="input" placeholder="VD: BV Bạch Mai, Medlatec…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Khoa">
          <input name="department" className="input" />
        </Field>
        <Field label="Bác sĩ">
          <input name="doctor" className="input" />
        </Field>
      </div>
      <Field label="Lý do khám / triệu chứng">
        <textarea name="reason" rows={2} className="input" />
      </Field>
      <Field label="Ghi chú (bác sĩ dặn, kết luận…)">
        <textarea name="notes" rows={4} className="input" />
      </Field>

      {error && <p className="text-sm text-stamp">{error}</p>}

      <button type="submit" className="btn-primary" disabled={!!busy}>
        {busy ?? primaryLabel}
      </button>
    </form>
  );
}
