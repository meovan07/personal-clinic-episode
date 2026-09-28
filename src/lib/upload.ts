// Shared client-side upload pipeline: hash, check for duplicates, then push to storage.
// Used by every place that lets the user attach photos/PDFs (QuickAddButton, DocumentUploader,
// NewVisitForm) so the hashing/dedupe/rollback behavior stays identical across all of them.
import { findDuplicateFiles, type UploadedFile } from "@/app/actions";
import type { createClient } from "@/lib/supabase/client";
import { extension, sha256 } from "@/lib/hash";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export async function hashAndCheckDuplicates(files: File[]): Promise<string[]> {
  const hashes = await Promise.all(files.map(sha256));
  if (new Set(hashes).size !== hashes.length) throw new Error("Bạn đã chọn cùng một file hai lần.");
  const dups = await findDuplicateFiles(hashes);
  if (dups.length > 0) {
    const names = dups.map((d) => `${d.file_name}${d.pending ? " (đang chờ xác nhận)" : ""}`).join(", ");
    throw new Error(`File đã được tải lên trước đó: ${names}`);
  }
  return hashes;
}

export async function uploadToStorage(
  supabase: SupabaseBrowserClient,
  files: File[],
  hashes: string[],
  pathPrefix: string,
  onProgress: (index: number, total: number) => void,
): Promise<UploadedFile[]> {
  const uploaded: UploadedFile[] = [];
  for (const [i, file] of files.entries()) {
    onProgress(i, files.length);
    // Storage keys must be ASCII; the original (Vietnamese) name is kept only in the database.
    const path = `${pathPrefix}/${crypto.randomUUID()}.${extension(file.name)}`;
    const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || undefined });
    if (error) throw new Error(error.message);
    uploaded.push({
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      sha256: hashes[i],
    });
  }
  return uploaded;
}

export async function rollbackUpload(supabase: SupabaseBrowserClient, uploaded: UploadedFile[]) {
  if (uploaded.length > 0) {
    await supabase.storage.from("documents").remove(uploaded.map((f) => f.storage_path));
  }
}
