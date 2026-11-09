// Pure post-processing for consultation recordings: speaker-role parsing, summary sections, spoken values,
// follow-up dates, person suggestion. Spec: docs/features/audio-recordings/spec.md (R7-R9).

import { SPEAKER_ROLES } from "./transcript";

export const SUMMARY_SECTIONS = ["Lý do khám", "Bác sĩ nói gì", "Chẩn đoán", "Dặn dò", "Thuốc"] as const;
export const EMPTY_SECTION = "Không nhắc đến.";

export type SpokenObservation = { raw_name: string; value: string; unit?: string | null; [k: string]: unknown };

/** Keep only roles from SPEAKER_ROLES; anything else is dropped (the letter then shows as "Người nói"). */
export function parseSpeakerRoles(
  raw: { part_no: number; speakers: { letter: string; role: string }[] }[],
): Record<number, Record<string, string>> {
  const out: Record<number, Record<string, string>> = {};
  for (const part of raw) {
    const roles: Record<string, string> = {};
    for (const s of part.speakers) {
      if ((SPEAKER_ROLES as readonly string[]).includes(s.role)) roles[s.letter] = s.role;
    }
    out[part.part_no] = roles;
  }
  return out;
}

const fold = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Markdown with the five `### ` sections in order; missing ones get EMPTY_SECTION. Other content is dropped. */
export function normalizeConsultationSummary(markdown: string): string {
  const bodies = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^#{1,6}\s*(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      const name = SUMMARY_SECTIONS.find((n) => fold(n) === fold(m[1].replace(/[:*]/g, "")));
      current = name ?? null;
      if (name && !bodies.has(name)) bodies.set(name, []);
      else if (name) current = null; // duplicate heading: ignore the repeat
      continue;
    }
    if (current) bodies.get(current)!.push(line);
  }
  return SUMMARY_SECTIONS.map((name) => {
    const body = (bodies.get(name) ?? []).join("\n").trim();
    return `### ${name}\n${body || EMPTY_SECTION}`;
  }).join("\n\n");
}

/** Keep spoken values with a test name and a number; unit kept when given, else null. */
export function cleanSpokenObservations<T extends SpokenObservation>(obs: T[]): T[] {
  return obs
    .filter((o) => o.raw_name.trim() !== "" && /\d/.test(o.value))
    .map((o) => ({ ...o, unit: o.unit ?? null }));
}

/** YYYY-MM-DD plus `days`. */
export function followUpFrom(recordedOn: string, days: number): string {
  const [y, m, d] = recordedOn.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The matched person, unless the model's confidence is "low" or missing. */
export function suggestedPerson(match: { matched_person_id: string | null; person_match_confidence: "high" | "low" | null }): string | null {
  return match.person_match_confidence === "high" ? match.matched_person_id : null;
}
