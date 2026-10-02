// Shared client-side upload pipeline: hash, check for duplicates, then push to storage.
// Used by every place that lets the user attach photos/PDFs (QuickAddButton, DocumentUploader,
// NewVisitForm) so the hashing/dedupe/rollback behavior stays identical across all of them.
import { findDuplicateFiles, type UploadedFile } from "@/app/actions";
import type { createClient } from "@/lib/supabase/client";
import { cleanFileName } from "@/lib/format";
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

const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.82;

/**
 * Photos are shrunk before upload (longest side 2000 px, JPEG): faster uploads and AI reads, less storage, still sharp
 * enough to read a lab sheet. Camera names like IMG_1234.HEIC become "anh-2026-10-02-1.jpg". PDFs and anything the
 * browser can't decode (e.g. HEIC outside Safari) are uploaded as they are, with a cleaned name.
 */
export async function prepareForUpload(file: File, index: number): Promise<File> {
  const today = new Date().toISOString().slice(0, 10);
  const isImage = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
  if (!isImage) return new File([file], cleanFileName(file.name), { type: file.type });
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    const name = `anh-${today}-${index + 1}.jpg`;
    // Keep the original when re-encoding wouldn't make it smaller (already small JPEGs) and it's a format every browser shows.
    if (!blob || (blob.size >= file.size && /^image\/(jpeg|png|webp)$/.test(file.type))) {
      return new File([file], cleanFileName(file.name), { type: file.type });
    }
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return new File([file], cleanFileName(file.name), { type: file.type });
  }
}

export async function uploadToStorage(
  supabase: SupabaseBrowserClient,
  files: File[],
  hashes: string[],
  pathPrefix: string,
  onProgress: (index: number, total: number) => void,
): Promise<UploadedFile[]> {
  const uploaded: UploadedFile[] = [];
  for (const [i, original] of files.entries()) {
    onProgress(i, files.length);
    // The duplicate check used the original's hash (hashes[i]), so re-uploading the same photo is still caught.
    const file = await prepareForUpload(original, i);
    // Storage keys are random; the cleaned, readable name is kept in the database.
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
