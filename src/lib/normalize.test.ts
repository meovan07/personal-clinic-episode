import assert from "node:assert/strict";
import { test } from "node:test";
import { findTestCode, normalizeObservation, parseNumber, parseRange } from "./normalize";

const catalog = [
  { code: "GLUCOSE", name_vi: "Glucose (đường huyết)", aliases: ["glucose", "đường huyết lúc đói"], standard_unit: "mmol/L" },
  { code: "CREA", name_vi: "Creatinin", aliases: ["creatinin"], standard_unit: "µmol/L" },
  { code: "HBSAG", name_vi: "HBsAg", aliases: ["hbsag"], standard_unit: null },
];
const conversions = [
  { test_code: "GLUCOSE", from_unit: "mg/dL", factor: 0.0555 },
  { test_code: "CREA", from_unit: "mg/dL", factor: 88.4 },
];

test("parseNumber handles decimal commas and flag markers", () => {
  assert.equal(parseNumber("5,8"), 5.8);
  assert.equal(parseNumber("118 H"), 118);
  assert.equal(parseNumber("7,8 H"), 7.8);
  assert.equal(parseNumber("56*"), 56);
  assert.equal(parseNumber("3.2 (L)"), 3.2);
  assert.equal(parseNumber("<0.5"), null);
  assert.equal(parseNumber("Âm tính"), null);
});

test("parseRange reads the formats labs print", () => {
  assert.deepEqual(parseRange("3,9 - 6,4"), { low: 3.9, high: 6.4 });
  assert.deepEqual(parseRange("< 3.4"), { low: null, high: 3.4 });
  assert.deepEqual(parseRange("≥ 1.0"), { low: 1, high: null });
  assert.deepEqual(parseRange("(≤ 37 )"), { low: null, high: 37 });
  assert.deepEqual(parseRange("(7.0 - 50)"), { low: 7, high: 50 });
  assert.deepEqual(parseRange("Âm tính"), { low: null, high: null });
});

test("findTestCode trusts valid AI codes and falls back to aliases", () => {
  assert.equal(findTestCode("Đường huyết lúc đói", null, catalog), "GLUCOSE");
  assert.equal(findTestCode("DUONG HUYET LUC DOI", "NOT_A_CODE", catalog), "GLUCOSE");
  assert.equal(findTestCode("Pro-BNP", null, catalog), null);
});

test("converts mg/dL to the standard unit and recomputes the flag", () => {
  const o = normalizeObservation(
    { raw_name: "Glucose (đói)", test_code: "GLUCOSE", value: "118 H", unit: "mg/dL", ref_range: "70 - 100", flag: null },
    catalog,
    conversions,
  );
  assert.equal(o.value, 6.549);
  assert.equal(o.unit, "mmol/L");
  assert.equal(o.ref_high, 5.55);
  assert.equal(o.flag, "high");
  assert.equal(o.raw_value, "118 H");
  assert.equal(o.raw_unit, "mg/dL");
});

test("treats µmol/L and umol/L as the same unit", () => {
  const o = normalizeObservation(
    { raw_name: "Creatinin", test_code: null, value: "80", unit: "umol/L", ref_range: "62 - 106", flag: null },
    catalog,
    conversions,
  );
  assert.equal(o.value, 80);
  assert.equal(o.flag, "normal");
});

test("keeps qualitative results as text with the AI flag", () => {
  const o = normalizeObservation(
    { raw_name: "HBsAg", test_code: "HBSAG", value: "Âm tính", unit: null, ref_range: "Âm tính", flag: "normal" },
    catalog,
    conversions,
  );
  assert.equal(o.value, null);
  assert.equal(o.value_text, "Âm tính");
  assert.equal(o.flag, "normal");
});
