// Turns what a lab printed into comparable values. Pure functions, no I/O.

export type CatalogEntry = { code: string; name_vi: string; aliases: string[]; standard_unit: string | null };
export type Conversion = { test_code: string; from_unit: string; factor: number };
export type Flag = "normal" | "high" | "low" | "abnormal";

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

export function nameKey(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/\s+/g, " ").trim();
}

export function unitKey(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[µμ]/g, "u").replace(/\s+/g, "");
}

// Flag markers labs print next to the value: "118 H", "3.2 L", "56*", "7.8 ↑".
const FLAG_MARKER = /\s*(?:\(?\s*(?:HH|LL|H|L)\s*\)?|\*+|↑|↓)$/i;

// Accepts "5.8", "5,8" (Vietnamese decimal comma), "1 234" and "118 H". Anything else ("<0.5", "Âm tính") is not a number.
export function parseNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  let t = s.trim().replace(FLAG_MARKER, "").replace(/\s/g, "");
  if (/^-?\d+,\d+$/.test(t)) t = t.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export function parseRange(text: string | null | undefined): { low: number | null; high: number | null } {
  const none = { low: null, high: null };
  if (!text) return none;
  const t = text
    .replace(/,(?=\d)/g, ".")
    .replace(/[()[\]]/g, " ") // some labs print "(≤ 40)"
    .replace(/\s+/g, " ")
    .trim();
  const between = t.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|~|đến|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (between) return { low: Number(between[1]), high: Number(between[2]) };
  const upper = t.match(/^(?:<|≤|<=)\s*(-?\d+(?:\.\d+)?)/);
  if (upper) return { low: null, high: Number(upper[1]) };
  const lower = t.match(/^(?:>|≥|>=)\s*(-?\d+(?:\.\d+)?)/);
  if (lower) return { low: Number(lower[1]), high: null };
  return none;
}

export function findTestCode(
  rawName: string,
  suggested: string | null,
  catalog: CatalogEntry[],
): string | null {
  if (suggested && catalog.some((c) => c.code === suggested)) return suggested;
  const k = nameKey(rawName);
  const hit = catalog.find((c) => nameKey(c.name_vi) === k || c.aliases.some((a) => nameKey(a) === k));
  return hit?.code ?? null;
}

function round(n: number): number {
  return Number(n.toPrecision(4));
}

export type NormalizedObservation = {
  test_code: string | null;
  raw_name: string;
  raw_value: string;
  raw_unit: string | null;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_range_text: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: Flag | null;
};

export function normalizeObservation(
  input: { raw_name: string; test_code: string | null; value: string; unit: string | null; ref_range: string | null; flag: Flag | null },
  catalog: CatalogEntry[],
  conversions: Conversion[],
): NormalizedObservation {
  const code = findTestCode(input.raw_name, input.test_code, catalog);
  const num = parseNumber(input.value);
  let { low, high } = parseRange(input.ref_range);
  let value = num;
  let unit = input.unit?.trim() || null;

  const standard = catalog.find((c) => c.code === code)?.standard_unit ?? null;
  if (code && standard && unit && unitKey(unit) !== unitKey(standard)) {
    const conv = conversions.find((c) => c.test_code === code && unitKey(c.from_unit) === unitKey(unit));
    if (conv) {
      const f = Number(conv.factor);
      value = value === null ? null : round(value * f);
      low = low === null ? null : round(low * f);
      high = high === null ? null : round(high * f);
      unit = standard;
    }
  }

  let flag: Flag | null = input.flag;
  if (value !== null && (low !== null || high !== null)) {
    flag = low !== null && value < low ? "low" : high !== null && value > high ? "high" : "normal";
  }

  return {
    test_code: code,
    raw_name: input.raw_name.trim(),
    raw_value: input.value.trim(),
    raw_unit: input.unit?.trim() || null,
    value,
    value_text: num === null ? input.value.trim() : null,
    unit,
    ref_range_text: input.ref_range?.trim() || null,
    ref_low: low,
    ref_high: high,
    flag,
  };
}
