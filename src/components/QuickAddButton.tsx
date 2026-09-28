"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createInboxItem, findDuplicateFiles, processInboxItem, type UploadedFile } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { extension, sha256 } from "@/lib/hash";
import { formatBytes } from "@/lib/format";

// Global "+" button: pick photos/PDFs, AI figures out who they belong to and which bệnh án they continue.
// See /inbox/[id]/review for the confirm step.
//
// On a phone, choosing "Camera" from the file picker opens the native camera and returns exactly one
// photo per trip (the `multiple` attribute only helps when picking several existing photos from the
// gallery). So picks are accumulated locally and only uploaded once the user is done adding pages,
// letting a multi-page document be captured as several camera trips.
export function QuickAddButton() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addPicked(picked: File[]) {
    if (picked.length === 0) return;
    setError(null);
    setFiles((f) => [...f, ...picked]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function reset() {
    setFiles([]);
    setError(null);
  }

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
        const names = dups.map((d) => `${d.file_name}${d.pending ? " (đang chờ xác nhận)" : ""}`).join(", ");
        throw new Error(`File đã được tải lên trước đó: ${names}`);
      }

      for (const [i, file] of files.entries()) {
        setBusy(`Đang tải ${i + 1}/${files.length}…`);
        // Storage keys must be ASCII; the original (Vietnamese) name is kept only in the database.
        const path = `inbox/${crypto.randomUUID()}.${extension(file.name)}`;
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
      const { id } = await createInboxItem(uploaded);

      setBusy("AI đang đọc… (khoảng 30-60 giây)");
      // Errors here are stored on the inbox row; the review page surfaces them with a retry button.
      await processInboxItem(id);
      setFiles([]);
      router.push(`/inbox/${id}/review`);
    } catch (e) {
      if (uploaded.length > 0) {
        await supabase.storage.from("documents").remove(uploaded.map((f) => f.storage_path));
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  // These pages already have their own sticky bottom action bar; avoid stacking a second floating control.
  if (pathname.endsWith("/review")) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => addPicked(Array.from(e.target.files ?? []))}
      />

      {files.length === 0 ? (
        <div className="fixed bottom-20 right-4 z-20 flex flex-col items-end gap-2 sm:bottom-5 sm:right-5">
          {error && (
            <div className="max-w-[80vw] rounded-lg border border-stamp/30 bg-stamp-tint px-3 py-2 text-sm text-stamp shadow-lg sm:max-w-xs">
              {error}
            </div>
          )}
          <button
            type="button"
            aria-label="Thêm tài liệu"
            onClick={() => inputRef.current?.click()}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-pine text-white shadow-lg hover:bg-pine-dark"
          >
            <Plus className="h-7 w-7" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-16 z-20 space-y-3 rounded-t-2xl border-t border-line bg-surface p-4 shadow-[0_-4px_16px_rgba(28,36,32,0.12)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-96 sm:rounded-2xl sm:border">
          <p className="label">Nhiều trang của cùng một tài liệu? Chụp/chọn thêm rồi tải lên cùng lúc.</p>
          <ul className="muted max-h-40 space-y-1 overflow-auto">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  Trang {i + 1}: {f.name} ({formatBytes(f.size)})
                </span>
                <button
                  type="button"
                  className="shrink-0 text-ink-faint hover:text-stamp"
                  aria-label="Xóa"
                  disabled={!!busy}
                  onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
          {error && <p className="text-sm text-stamp">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!!busy} onClick={upload}>
              {busy ?? `Tải lên ${files.length} file`}
            </button>
            <button type="button" className="btn" disabled={!!busy} onClick={() => inputRef.current?.click()}>
              + Chụp/chọn thêm
            </button>
            <button type="button" className="btn" disabled={!!busy} onClick={reset}>
              Hủy
            </button>
          </div>
        </div>
      )}
    </>
  );
}
