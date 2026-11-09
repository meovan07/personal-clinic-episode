// Pure transcript helpers: joining parts, speaker roles, scheduling, labels, caps.
// Spec: docs/features/audio-recordings/spec.md (R4-R7, R10, R13, R14).

export const SPEAKER_ROLES = ["Bác sĩ", "Bệnh nhân", "Người nhà", "Khác"] as const;
export const UNKNOWN_SPEAKER = "Người nói";
export const TRANSCRIPT_CAP = 30_000;

export type PartStatus = "pending" | "done" | "failed";
export type Segment = { start: number; end: number; speaker: string; text: string };
export type PartSegment = Segment & { part_no: number };
export type TranscriptPart = {
  part_no: number;
  start_sec: number;
  end_sec: number;
  status: PartStatus;
  storage_path: string;
  segments: Segment[] | null;
  error?: string | null;
};

/** Segments of all parts in part order, times offset by each part's start. `complete` is false while any part isn't done. */
export function joinParts(parts: TranscriptPart[]): { complete: boolean; segments: PartSegment[] } {
  const sorted = [...parts].sort((a, b) => a.part_no - b.part_no);
  const segments: PartSegment[] = [];
  for (const part of sorted) {
    if (part.status !== "done" || !part.segments) continue;
    for (const seg of part.segments) {
      segments.push({ ...seg, start: seg.start + part.start_sec, end: seg.end + part.start_sec, part_no: part.part_no });
    }
  }
  const complete = sorted.every((p) => p.status === "done" && p.segments !== null);
  return { complete, segments };
}

/** Replace speaker letters with roles per part; unmapped or invalid roles become UNKNOWN_SPEAKER. Text and times unchanged. */
export function applySpeakerRoles(segments: PartSegment[], roles: Record<number, Record<string, string>>): Segment[] {
  return segments.map(({ part_no, ...seg }) => {
    const role = roles[part_no]?.[seg.speaker];
    const valid = role !== undefined && (SPEAKER_ROLES as readonly string[]).includes(role);
    return { ...seg, speaker: valid ? role : UNKNOWN_SPEAKER };
  });
}

/** Part numbers to start now: pending or failed, not running, keeping at most `max` running. */
export function nextParts(parts: TranscriptPart[], running: number[], max = 3): number[] {
  const slots = Math.max(0, max - running.length);
  return parts
    .filter((p) => (p.status === "pending" || p.status === "failed") && !running.includes(p.part_no))
    .map((p) => p.part_no)
    .sort((a, b) => a - b)
    .slice(0, slots);
}

/** "Đang chép lời n/N", n = parts done. */
export function progressLabel(parts: TranscriptPart[]): string {
  const done = parts.filter((p) => p.status === "done").length;
  return `Đang chép lời ${done}/${parts.length}`;
}

/** "Chép lời lỗi k/N phần", or null when no part failed. */
export function failureLabel(parts: TranscriptPart[]): string | null {
  const failed = parts.filter((p) => p.status === "failed").length;
  return failed === 0 ? null : `Chép lời lỗi ${failed}/${parts.length} phần`;
}

/** "Xem lời thoại (n phút)", minutes rounded up. */
export function transcriptToggleLabel(durationSec: number): string {
  return `Xem lời thoại (${Math.ceil(durationSec / 60)} phút)`;
}

/** "m:ss" or "h:mm:ss" for a time in seconds. */
export function formatTime(sec: number): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** First TRANSCRIPT_CAP characters, followed by "[Đã cắt: còn N ký tự]" when cut. */
export function capTranscript(text: string): string {
  if (text.length <= TRANSCRIPT_CAP) return text;
  return `${text.slice(0, TRANSCRIPT_CAP)}\n[Đã cắt: còn ${text.length - TRANSCRIPT_CAP} ký tự]`;
}

/** Storage paths of the temporary part files (never the recording itself). */
export function partPathsToDelete(parts: Pick<TranscriptPart, "storage_path">[]): string[] {
  return parts.map((p) => p.storage_path);
}
