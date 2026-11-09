"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDocument, type UploadedFile } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { DOC_TYPE } from "@/lib/labels";
import { formatBytes } from "@/lib/format";
import { splitAudioFiles } from "@/lib/audio-plan";
import {
  AUDIO_UPLOADS,
  UPLOAD_ACCEPT,
  hashAndCheckDuplicates,
  recordingFiles,
  rollbackUpload,
  uploadRecording,
  uploadToStorage,
} from "@/lib/upload";

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
    let uploaded: UploadedFile[] = [];
    try {
      setBusy("Đang kiểm tra…");
      const hashes = await hashAndCheckDuplicates(files);

      // Flag off: `photos` is `files`, so this is the original flow. Flag on: each recording is its own document.
      const split = AUDIO_UPLOADS ? splitAudioFiles(files) : null;
      const photos = split ? split.other : files;
      const photoHashes = split ? photos.map((f) => hashes[files.indexOf(f)]) : hashes;
      for (const [audio] of split?.audioGroups ?? []) {
        const rec = await uploadRecording(supabase, audio, hashes[files.indexOf(audio)], visitId, setBusy);
        uploaded = recordingFiles(rec);
        setBusy("Đang lưu…");
        await createDocument({
          visitId,
          title: title.trim() || null,
          docType: "consultation_recording",
          files: [rec.file],
          parts: rec.parts,
          recordedOn: rec.recorded_on,
        });
        uploaded = [];
        setFiles((fs) => fs.filter((f) => f !== audio));
      }

      if (photos.length > 0) {
        uploaded = await uploadToStorage(supabase, photos, photoHashes, visitId, (i, total) =>
          setBusy(`Đang tải ${i + 1}/${total}…`),
        );

        setBusy("Đang lưu…");
        await createDocument({ visitId, title: title.trim() || null, docType, files: uploaded });
      }
      setFiles([]);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      await rollbackUpload(supabase, uploaded);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-dashed border-line-strong bg-surface p-4">
      <div>
        <span className="label">{AUDIO_UPLOADS
            ? "Tải tài liệu lên (ảnh, PDF, ghi âm). Nhiều trang của cùng một phiếu thì chọn cùng lúc."
            : "Tải tài liệu lên (ảnh, PDF). Nhiều trang của cùng một phiếu thì chọn cùng lúc."}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-pine-tint file:px-3 file:py-2 file:text-pine"
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
      {error && <p className="text-sm text-stamp">{error}</p>}
    </div>
  );
}
