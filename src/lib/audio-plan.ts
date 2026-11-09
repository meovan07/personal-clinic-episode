// Pure planning for audio uploads (no browser APIs): format check, length cap, part plan, quiet-point pick.
// The WebCodecs side lives in src/lib/audio.ts. Spec: docs/features/audio-recordings/spec.md (R1, R2, R4, R9).

export const AUDIO_FORMAT_ERROR = "Không đọc được file ghi âm này (hỗ trợ m4a, mp3, wav, webm, ogg, aac).";
export const AUDIO_TOO_LONG_ERROR = "Bản ghi dài hơn 2 giờ, hãy cắt bớt.";
export const MAX_DURATION_SEC = 7200;
export const PART_SEC = 600;
export const CUT_WINDOW_SEC = 10;
export const QUIET_STEP_SEC = 0.5;
export const MAX_PART_BYTES = 24 * 1024 * 1024;

export type FileLike = { name: string; type: string };
export type PlannedPart = { part_no: number; start: number; end: number };

const AUDIO_MIME = new Set([
  "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
  "audio/webm", "audio/ogg", "audio/aac", "audio/x-aac",
]);
const AUDIO_EXT = new Set(["m4a", "mp3", "wav", "webm", "ogg", "aac"]);

/** True when the file looks like a supported recording (by MIME type or extension). */
export function isSupportedAudio(file: FileLike): boolean {
  const type = (file.type ?? "").trim().toLowerCase();
  if (AUDIO_MIME.has(type)) return true;
  if (type !== "" && type !== "application/octet-stream") return false;
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return false;
  return AUDIO_EXT.has(file.name.slice(dot + 1).toLowerCase());
}

/** null when the file is a supported recording, else AUDIO_FORMAT_ERROR. */
export function checkAudioFile(file: FileLike): string | null {
  return isSupportedAudio(file) ? null : AUDIO_FORMAT_ERROR;
}

/** null when the original's duration is readable and ≤ 2 h; AUDIO_TOO_LONG_ERROR when longer; AUDIO_FORMAT_ERROR when unreadable. */
export function checkDuration(durationSec: number | null | undefined): string | null {
  if (durationSec == null || !Number.isFinite(durationSec) || durationSec <= 0) return AUDIO_FORMAT_ERROR;
  if (durationSec > MAX_DURATION_SEC) return AUDIO_TOO_LONG_ERROR;
  return null;
}

/**
 * Parts of at most PART_SEC each, contiguous from 0 to durationSec. `quietAt(markSec)` returns the cut for each
 * fixed mark (600, 1200, …); when `bitrateKbps` would make a part exceed MAX_PART_BYTES, extra cuts are added.
 * Throws AUDIO_TOO_LONG_ERROR past 2 h.
 */
export function planParts(
  durationSec: number,
  opts: { bitrateKbps?: number; quietAt?: (markSec: number) => number } = {},
): PlannedPart[] {
  if (durationSec > MAX_DURATION_SEC) throw new Error(AUDIO_TOO_LONG_ERROR);
  const cuts = [0];
  for (let mark = PART_SEC; mark < durationSec; mark += PART_SEC) {
    cuts.push(opts.quietAt ? opts.quietAt(mark) : mark);
  }
  cuts.push(durationSec);
  const kbps = opts.bitrateKbps;
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    let n = 1;
    if (kbps && kbps > 0) {
      const bytes = ((end - start) * kbps * 1000) / 8;
      n = Math.max(1, Math.ceil(bytes / MAX_PART_BYTES));
    }
    const len = (end - start) / n;
    for (let k = 0; k < n; k++) ranges.push([k === 0 ? start : start + len * k, k === n - 1 ? end : start + len * (k + 1)]);
  }
  return ranges.map(([start, end], i) => ({ part_no: i + 1, start, end }));
}

/**
 * Start time of the quietest QUIET_STEP_SEC block lying fully inside [markSec − 10, markSec + 10].
 * `loudness[i]` covers [originSec + i·step, originSec + (i+1)·step).
 */
export function pickQuietPoint(loudness: number[], originSec: number, markSec: number, stepSec = QUIET_STEP_SEC): number {
  const lo = markSec - CUT_WINDOW_SEC;
  const hi = markSec + CUT_WINDOW_SEC;
  const eps = 1e-9;
  let best = -1;
  for (let i = 0; i < loudness.length; i++) {
    const start = originSec + i * stepSec;
    const end = originSec + (i + 1) * stepSec;
    if (start < lo - eps || end > hi + eps) continue;
    if (best < 0 || loudness[i] < loudness[best]) best = i;
  }
  return best < 0 ? markSec : originSec + best * stepSec;
}

/** Each recording becomes its own group; everything else stays together (spec R1, grill R11). */
export function splitAudioFiles<T extends FileLike>(files: T[]): { audioGroups: T[][]; other: T[] } {
  const audioGroups: T[][] = [];
  const other: T[] = [];
  for (const f of files) {
    if (isSupportedAudio(f)) audioGroups.push([f]);
    else other.push(f);
  }
  return { audioGroups, other };
}

/** Recording date (YYYY-MM-DD, Vietnam time) from File.lastModified. */
export function recordedOn(lastModifiedMs: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(lastModifiedMs));
}
