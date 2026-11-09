// Shared client-side upload pipeline: hash, check for duplicates, then push to storage.
// Used by every place that lets the user attach photos/PDFs (QuickAddButton, DocumentUploader,
// NewVisitForm) so the hashing/dedupe/rollback behavior stays identical across all of them.
import { findDuplicateFiles, type UploadedFile } from "@/app/actions";
import type { createClient } from "@/lib/supabase/client";
import { cleanFileName } from "@/lib/format";
import { extension, sha256 } from "@/lib/hash";
import { recordedOn } from "@/lib/audio-plan";

// Audio uploads are off unless NEXT_PUBLIC_AUDIO_UPLOADS=1 (read at build time).
export const AUDIO_UPLOADS = process.env.NEXT_PUBLIC_AUDIO_UPLOADS === "1";
export const UPLOAD_ACCEPT = AUDIO_UPLOADS ? "image/*,application/pdf,audio/*" : "image/*,application/pdf";

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

export type UploadedPart = { part_no: number; start_sec: number; end_sec: number; storage_path: string };

/**
 * One recording: compress + split in the browser, upload the recording and every part. `hash` is the sha256 of the
 * ORIGINAL file (so the duplicate check keeps working). On any failure everything uploaded so far is removed.
 */
export async function uploadRecording(
  supabase: SupabaseBrowserClient,
  file: File,
  hash: string,
  pathPrefix: string,
  onProgress: (step: string) => void,
): Promise<{ file: UploadedFile; parts: UploadedPart[]; recorded_on: string }> {
  const uploaded: UploadedFile[] = [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    // Loaded on demand so the audio library stays out of the bundle's first load.
    const { prepareRecording } = await import("@/lib/audio");
    const prepared = await prepareRecording(file, `ghi-am-${today}`, onProgress);
    const put = async (f: File, path: string) => {
      const { error } = await supabase.storage.from("documents").upload(path, f, { contentType: f.type || undefined });
      if (error) throw new Error("Tải lên lỗi, thử lại.");
      uploaded.push({ storage_path: path, file_name: f.name, mime_type: f.type, size_bytes: f.size, sha256: "" });
    };
    onProgress("Đang tải bản ghi");
    const recPath = `${pathPrefix}/${crypto.randomUUID()}.${extension(prepared.recording.name)}`;
    await put(prepared.recording, recPath);
    const parts: UploadedPart[] = [];
    for (const p of prepared.parts) {
      onProgress(`Đang tải phần ${p.part_no}/${prepared.parts.length}`);
      const path = `${pathPrefix}/parts/${crypto.randomUUID()}.${extension(p.file.name)}`;
      await put(p.file, path);
      parts.push({ part_no: p.part_no, start_sec: p.start, end_sec: p.end, storage_path: path });
    }
    return {
      file: {
        storage_path: recPath,
        file_name: prepared.recording.name,
        mime_type: prepared.recording.type,
        size_bytes: prepared.recording.size,
        sha256: hash,
      },
      parts,
      recorded_on: recordedOn(file.lastModified),
    };
  } catch (e) {
    await rollbackUpload(supabase, uploaded);
    throw e;
  }
}

/** Every storage object of an uploaded recording, for rollbackUpload when saving it fails. */
export function recordingFiles(rec: { file: UploadedFile; parts: UploadedPart[] }): UploadedFile[] {
  return [rec.file, ...rec.parts.map((p) => ({ ...rec.file, storage_path: p.storage_path }))];
}
