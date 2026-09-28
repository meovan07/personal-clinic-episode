"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createInboxItem, findDuplicateFiles, processInboxItem, type UploadedFile } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { extension, sha256 } from "@/lib/hash";

// Global "+" button: pick a photo/PDF, AI figures out who it belongs to and which bệnh án it continues.
// See /inbox/[id]/review for the confirm step.
export function QuickAddButton() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    setError(null);
    if (files.length === 0) return;
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
      router.push(`/inbox/${id}/review`);
    } catch (e) {
      if (uploaded.length > 0) {
        await supabase.storage.from("documents").remove(uploaded.map((f) => f.storage_path));
      }
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
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
        onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
      />
      <div className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2">
        {(busy || error) && (
          <div
            className={`max-w-[80vw] rounded-lg border px-3 py-2 text-sm shadow-lg sm:max-w-xs ${
              error ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {error ?? busy}
          </div>
        )}
        <button
          type="button"
          aria-label="Thêm tài liệu"
          disabled={!!busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-3xl leading-none text-white shadow-lg hover:bg-teal-700 disabled:opacity-60"
        >
          +
        </button>
      </div>
    </>
  );
}
