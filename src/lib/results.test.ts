import { test } from "node:test";
import assert from "node:assert/strict";
import { latestResults, type ObservationRow } from "./results";

const obs = (visit_id: string, value: number, flag: string | null, code = "ALT"): ObservationRow => ({
  visit_id,
  test_code: code,
  raw_name: "ALT",
  value,
  value_text: null,
  unit: "U/L",
  raw_unit: null,
  ref_range_text: "≤ 40",
  flag,
  test_catalog: { name_vi: "ALT (GPT)", category: "Chức năng gan" },
});

test("latest value, previous from an earlier date, trend oldest first", () => {
  const dates = new Map([
    ["v1", "2025-03-22"],
    ["v2", "2026-09-26"],
    ["v0", "2023-10-29"],
  ]);
  const [r] = latestResults([obs("v2", 63, "high"), obs("v1", 28, "normal"), obs("v0", 35, "normal")], dates);
  assert.equal(r.value, "63");
  assert.equal(r.flag, "high");
  assert.deepEqual(r.previous, { value: "28", date: "2025-03-22" });
  assert.deepEqual(r.points, [35, 28, 63]);
  assert.match(r.explanation ?? "", /^Men gan/);
});

test("one date only: no trend; visits without a date are skipped", () => {
  const dates = new Map<string, string | null>([
    ["v1", "2026-09-26"],
    ["v2", null],
  ]);
  const [r] = latestResults([obs("v1", 63, "high"), obs("v2", 70, "high")], dates);
  assert.equal(r.points, undefined);
  assert.equal(r.previous, null);
  assert.equal(r.value, "63");
});

test("tests outside the catalog are grouped by printed name", () => {
  const raw = (visit_id: string, name: string): ObservationRow => ({
    ...obs(visit_id, 1, null),
    test_code: null,
    raw_name: name,
    test_catalog: null,
  });
  const dates = new Map([
    ["v1", "2026-09-26"],
    ["v2", "2025-01-01"],
  ]);
  const results = latestResults([raw("v1", "Testosteron"), raw("v2", "TESTOSTERON")], dates);
  assert.equal(results.length, 1);
  assert.equal(results[0].category, "Khác");
});
