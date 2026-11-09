import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanSpokenObservations,
  followUpFrom,
  normalizeConsultationSummary,
  parseSpeakerRoles,
  suggestedPerson,
} from "./consultation";
import { applySpeakerRoles, type PartSegment } from "./transcript";

test("R7 invalid roles are dropped", () => {
  const parsed = parseSpeakerRoles([
    { part_no: 1, speakers: [{ letter: "A", role: "Y tá" }, { letter: "B", role: "Bác sĩ" }] },
  ]);
  assert.deepEqual(parsed, { 1: { B: "Bác sĩ" } });
  const segs: PartSegment[] = [
    { part_no: 1, start: 0, end: 2, speaker: "A", text: "Anh uống thuốc đều chưa?" },
    { part_no: 1, start: 2, end: 4, speaker: "B", text: "Tôi uống đều rồi." },
  ];
  const out = applySpeakerRoles(segs, parsed);
  assert.equal(out[0].speaker, "Người nói");
  assert.equal(out[1].speaker, "Bác sĩ");
  assert.equal(out[0].text, "Anh uống thuốc đều chưa?");
  assert.equal(out[1].text, "Tôi uống đều rồi.");
});

test("R8 type is consultation_recording and summary has five sections", () => {
  const md = "### Lý do khám\nĐau đầu.\n\n### Thuốc\nParacetamol.";
  const out = normalizeConsultationSummary(md);
  const heads = ["### Lý do khám", "### Bác sĩ nói gì", "### Chẩn đoán", "### Dặn dò", "### Thuốc"];
  let last = -1;
  for (const h of heads) {
    const i = out.indexOf(h);
    assert.ok(i > last, `${h} missing or out of order`);
    last = i;
  }
  for (const h of ["### Bác sĩ nói gì", "### Chẩn đoán", "### Dặn dò"]) {
    const i = out.indexOf(h);
    const rest = out.slice(i + h.length).trimStart();
    assert.ok(rest.startsWith("Không nhắc đến."), `${h} not marked empty`);
  }
});

test("R8 follow-up is recording date plus days", () => {
  assert.equal(followUpFrom("2026-11-05", 14), "2026-11-19");
  assert.equal(followUpFrom("2026-11-20", 14), "2026-12-04");
});

test("R8 observation needs a test name and a number", () => {
  const out = cleanSpokenObservations([
    { raw_name: "đường huyết", value: "7,2", unit: null },
    { raw_name: "cholesterol", value: "5,1", unit: "mmol/L" },
    { raw_name: "đường", value: "hơi cao" },
    { raw_name: "", value: "6" },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].raw_name, "đường huyết");
  assert.equal(out[0].value, "7,2");
  assert.equal(out[0].unit, null);
  assert.equal(out[1].raw_name, "cholesterol");
  assert.equal(out[1].value, "5,1");
  assert.equal(out[1].unit, "mmol/L");
});

test("R9 person suggested unless confidence is low", () => {
  assert.equal(suggestedPerson({ matched_person_id: "thanh-id", person_match_confidence: "high" }), "thanh-id");
  assert.equal(suggestedPerson({ matched_person_id: "thanh-id", person_match_confidence: "low" }), null);
  assert.equal(suggestedPerson({ matched_person_id: "thanh-id", person_match_confidence: null }), null);
});
