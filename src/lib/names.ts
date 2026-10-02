import { nameKey } from "@/lib/normalize";
import { tidyName } from "@/lib/format";

// Names copied from documents vary as printed ("BỆNH VIỆN ĐA KHOA GIA ĐÌNH" vs "Bệnh viện Đa khoa Gia Đình",
// "THS.BS TRƯƠNG THỊ BÍCH NGỌC" vs "ThS. BS. Trương Thị Bích Ngọc"). These helpers decide when two spellings are the
// same thing, so a new value reuses the spelling already in the records instead of adding a variant.

const ABBREVIATIONS: Record<string, string> = {
  bv: "benh vien",
  bvdk: "benh vien da khoa",
  pk: "phong kham",
  pkdk: "phong kham da khoa",
  tt: "trung tam",
  dk: "da khoa",
  tp: "thanh pho",
};
// Academic and professional titles in front of a doctor's name.
const TITLES = new Set([
  "ths",
  "ts",
  "bs",
  "bsck",
  "bscki",
  "bsckii",
  "ck1",
  "ck2",
  "cki",
  "ckii",
  "pgs",
  "gs",
  "ds",
  "dd",
]);

/** Comparison key: no diacritics, capitals or punctuation, abbreviations spelled out, titles dropped. */
export function canonicalKey(value: string): string {
  return nameKey(value)
    .replace(/[.,;:/\\()_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !TITLES.has(w))
    .map((w) => ABBREVIATIONS[w] ?? w)
    .join(" ")
    .trim();
}

/** Test names that differ only by a unit or count in brackets ("Mật độ (10^6/ml)", "Kiêng xuất tinh (ngày)"). */
export function testNameKey(rawName: string): string {
  return nameKey(rawName.replace(/\s*\((?:[^()]*\d[^()]*|%|ngày|ml)\)\s*$/i, ""));
}

/**
 * The spelling to store for a new value: an existing value with the same key wins (the one with normal
 * capitalization, then the most used); otherwise the value itself, with all-capitals text tidied.
 */
export function canonicalName(value: string | null | undefined, existing: Iterable<string>): string | null {
  const v = value?.replace(/\s+/g, " ").trim();
  if (!v) return null;
  const key = canonicalKey(v);
  const counts = new Map<string, number>();
  for (const e of existing) if (e && canonicalKey(e) === key) counts.set(e, (counts.get(e) ?? 0) + 1);
  const best = [...counts.entries()].sort(
    ([a, na], [b, nb]) => Number(b !== b.toUpperCase()) - Number(a !== a.toUpperCase()) || nb - na,
  )[0]?.[0];
  return best ?? tidyName(v);
}

/**
 * A document can print several places ("Medilab; Phòng khám Hòa Hảo…"). A visit happens in one: keep the part
 * already in the records, otherwise the first.
 */
export function onePlace(value: string | null | undefined, existing: Iterable<string>): string | null {
  const parts = (value ?? "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return canonicalName(value, existing);
  const known = new Set([...existing].map(canonicalKey));
  return canonicalName(parts.find((p) => known.has(canonicalKey(p))) ?? parts[0], existing);
}
