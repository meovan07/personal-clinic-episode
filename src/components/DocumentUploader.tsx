"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDocument, findDuplicateFiles, type UploadedFile } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { DOC_TYPE } from "@/lib/labels";
import { formatBytes } from "@/lib/format";
import { extension, sha256 } from "@/lib/hash";

export function DocumentUploader({ visitId }: { visitId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("lab_result");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    setError(null);
    const supabase = createClient();
    const uploaded: UploadedFile[] = [];
    try {
      setBusy("Đang kiểm tra…");
      const hashes = await Promise.all(files.map(sha256));
      if (new Set(hashes).size !== hashes.length) throw new Error("Bạn đã chọn cùng một file hai lần.");
      const dups = await findDuplicateFiles(hashes);
      if (dups.length > 0) {
        throw new Error(`File đã được tải lên trước đó: ${dups.map((d) => d.file_name).join(", ")}`);
      }

      for (const [i, file] of files.entries()) {
        setBusy(`Đang tải ${i + 1}/${files.length}…`);
        // Storage keys must be ASCII, so the original (Vietnamese) name is kept only in the database.
        const path = `${visitId}/${crypto.randomUUID()}.${extension(file.name)}`;
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

      setBusy("Đang lưu…");
      await createDocument({ visitId, title: title.trim() || null, docType, files: uploaded });
      setFiles([]);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      if (uploaded.length > 0) {
        await supabase.storage.from("documents").remove(uploaded.map((f) => f.storage_path));
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-slate-300 bg-white p-4">
      <div>
        <span className="label">Tải tài liệu lên (ảnh, PDF). Nhiều trang của cùng một phiếu thì chọn cùng lúc.</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-teal-700"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      {files.length > 0 && (
        <>
          <ul className="muted">
            {files.map((f, i) => (
              <li key={i}>
                Trang {i + 1}: {f.name} ({formatBytes(f.size)})
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Loại tài liệu</span>
              <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {Object.entries(DOC_TYPE).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Tên (không bắt buộc)</span>
              <input
                className="input"
                value={title}
                placeholder="VD: Xét nghiệm máu tổng quát"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          </div>
          <button className="btn-primary" disabled={!!busy} onClick={upload}>
            {busy ?? `Tải lên ${files.length} file`}
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
