import type { ResultRowData } from "@/components/ResultRow";
import { nameKey } from "@/lib/normalize";
import { explainResult } from "@/lib/test-info";

export type ObservationRow = {
  visit_id: string;
  test_code: string | null;
  raw_name: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  raw_unit: string | null;
  ref_range_text: string | null;
  flag: string | null;
  test_catalog: { name_vi: string; category: string | null } | null;
};

export type TestResult = ResultRowData & { key: string; category: string };

export const OUT_OF_RANGE = new Set(["high", "low", "abnormal"]);

/**
 * One row per test across visits: its latest value with the plain-language explanation, the previous value
 * from an earlier date, and the numeric history for a trend line (when measured on 2+ dates).
 * Tests outside the catalog are matched by their printed name.
 */
export function latestResults(rows: ObservationRow[], visitDates: Map<string, string | null>): TestResult[] {
  const byTest = new Map<string, { o: ObservationRow; date: string }[]>();
  for (const o of rows) {
    const date = visitDates.get(o.visit_id);
    if (!date) continue;
    const key = o.test_code ?? `raw:${nameKey(o.raw_name)}`;
    byTest.set(key, [...(byTest.get(key) ?? []), { o, date }]);
  }
  const show = (o: ObservationRow) => (o.value !== null ? String(o.value) : (o.value_text ?? ""));
  return [...byTest.entries()].map(([key, entries]) => {
    const dated = entries.sort((a, b) => a.date.localeCompare(b.date));
    const latest = dated.at(-1)!;
    const previous = [...dated].reverse().find((d) => d.date < latest.date);
    return {
      key,
      category: latest.o.test_catalog?.category ?? "Khác",
      name: latest.o.test_catalog?.name_vi ?? latest.o.raw_name,
      explanation: explainResult(latest.o.test_code, latest.o.flag, latest.o.test_catalog?.name_vi),
      value: show(latest.o),
      unit: latest.o.unit ?? latest.o.raw_unit,
      flag: latest.o.flag,
      date: latest.date,
      refRange: latest.o.ref_range_text,
      previous: previous ? { value: show(previous.o), date: previous.date } : null,
      points:
        new Set(dated.map((d) => d.date)).size >= 2
          ? dated.filter((d) => d.o.value !== null).map((d) => d.o.value as number)
          : undefined,
    };
  });
}
