"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FileUp, Plus, Sparkles, X } from "lucide-react";
import { createInboxItem, processInboxItem, type UploadedFile } from "@/app/actions";
import { openAssistant } from "@/components/AssistantChat";
import { createClient } from "@/lib/supabase/client";
import { hashAndCheckDuplicates, rollbackUpload, uploadToStorage } from "@/lib/upload";
import { formatBytes } from "@/lib/format";

// Global "+" button. It opens a small menu: ask the AI assistant (chat panel), or upload photos/PDFs that
// the AI reads to figure out who they belong to and which bệnh án they continue (confirmed at /inbox/[id]/review).
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // The menu closes on Esc or a tap anywhere else.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onPointer(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  const menuItem =
    "flex items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-surface py-2.5 pl-3.5 pr-4 text-sm font-medium text-ink shadow-lg hover:bg-paper-dim";

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
    let uploaded: UploadedFile[] = [];
    try {
      setBusy("Đang kiểm tra…");
      const hashes = await hashAndCheckDuplicates(files);

      uploaded = await uploadToStorage(supabase, files, hashes, "inbox", (i, total) =>
        setBusy(`Đang tải ${i + 1}/${total}…`),
      );

      setBusy("Đang lưu…");
      const { id } = await createInboxItem(uploaded);

      setBusy("AI đang đọc… (khoảng 30-60 giây)");
      // Errors here are stored on the inbox row; the review page surfaces them with a retry button.
      await processInboxItem(id);
      setFiles([]);
      router.push(`/inbox/${id}/review`);
    } catch (e) {
      await rollbackUpload(supabase, uploaded);
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

      {/* Dims the page while the menu is open so its two choices stand out; a tap on it closes the menu. */}
      {menuOpen && <div aria-hidden className="anim-fade fixed inset-0 z-20 bg-ink/15" />}

      {files.length === 0 ? (
        <div
          ref={menuRef}
          className="hide-with-keyboard fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2 sm:bottom-5 sm:right-5"
        >
          {error && (
            <div className="max-w-[80vw] rounded-lg border border-stamp/30 bg-stamp-tint px-3 py-2 text-sm text-stamp shadow-lg sm:max-w-xs">
              {error}
            </div>
          )}
          {menuOpen && (
            <div role="menu" aria-label="Thêm" className="flex flex-col items-end gap-2">
              <button
                type="button"
                role="menuitem"
                className={`${menuItem} anim-rise`}
                style={{ animationDelay: "40ms" }}
                onClick={() => {
                  setMenuOpen(false);
                  openAssistant();
                }}
              >
                <Sparkles className="h-4 w-4 text-pine" strokeWidth={1.75} />
                Hỏi trợ lý AI
              </button>
              <button
                type="button"
                role="menuitem"
                className={`${menuItem} anim-rise`}
                onClick={() => {
                  setMenuOpen(false);
                  inputRef.current?.click();
                }}
              >
                <FileUp className="h-4 w-4 text-pine" strokeWidth={1.75} />
                Tải ảnh / PDF kết quả khám
              </button>
            </div>
          )}
          <button
            type="button"
            aria-label={menuOpen ? "Đóng" : "Thêm"}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-pine text-on-pine shadow-lg transition-transform hover:bg-pine-dark active:scale-95 motion-reduce:transition-none"
          >
            <Plus
              className={`h-7 w-7 transition-transform duration-200 motion-reduce:transition-none ${menuOpen ? "rotate-45" : ""}`}
              strokeWidth={2}
            />
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
