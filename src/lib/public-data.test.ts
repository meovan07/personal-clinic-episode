import { test } from "node:test";
import assert from "node:assert/strict";
import { toPublicCase, toPublicPerson, toPublicVisit } from "./public-data";

const obs = {
  visit_id: "v1",
  test_code: "GLU",
  raw_name: "Glucose",
  value: 5.1,
  value_text: null,
  unit: "mmol/L",
  raw_unit: "mmol/l",
  ref_range_text: "3.9-6.4",
  flag: "normal",
  test_catalog: { name_vi: "Đường huyết", category: "Đường huyết" },
};

test("every mapper returns null for null or a non-object", () => {
  for (const map of [toPublicPerson, toPublicVisit, toPublicCase]) {
    assert.equal(map(null), null);
    assert.equal(map("x"), null);
  }
});

test("a full person feed maps unchanged", () => {
  const json = {
    id: "p1",
    full_name: "An",
    birth_date: "1990-01-02",
    sex: "female",
    blood_type: "O+",
    allergies: "none",
    chronic_conditions: null,
    cases: [{ id: "c1", person_id: "p1", title: "Gan", status: "dang_theo_doi", started_on: "2026-01-01", ended_on: null, visits: [{ count: 2 }] }],
    visits: [{ id: "v1", person_id: "p1", visit_date: "2026-02-01", facility: "BV", reason: null, cases: { title: "Gan" }, documents: [{ count: 1 }] }],
    observations: [obs],
    latest_summary: { id: "s1", content: "ok", generated_at: "2026-03-01T00:00:00Z" },
    older_summary_count: 2,
    vaccinations: [{ id: "x1", person_id: "p1", vaccine_name: "Vaxigrip", disease: "Cúm", dose_label: "1", given_on: "2026-01-05", next_due_on: null }],
    todos: [{ id: "a1", person_id: "p1", visit_id: "v1", content: "Tái khám", due_on: "2026-05-01" }],
  };
  assert.deepEqual(toPublicPerson(json), json);
});

test("a person without a summary or lists gets null and empty arrays", () => {
  const p = toPublicPerson({ id: "p1", full_name: "An", latest_summary: null });
  assert.equal(p?.latest_summary, null);
  assert.equal(p?.older_summary_count, 0);
  assert.equal(p?.blood_type, null);
  assert.deepEqual([p?.cases, p?.visits, p?.observations, p?.vaccinations, p?.todos], [[], [], [], [], []]);
});

test("a full visit feed maps unchanged", () => {
  const json = {
    id: "v1",
    person_id: "p1",
    case_id: "c1",
    visit_date: "2026-02-01",
    facility: "BV",
    department: "Gan",
    doctor: "BS A",
    reason: "Khám",
    notes: null,
    people: { full_name: "An" },
    cases: { id: "c1", title: "Gan" },
    documents: [{ id: "d1", title: "KQ", doc_type: "lab", created_at: "2026-02-01T00:00:00Z", summary: "tốt", document_files: [{ id: "f1", page_no: 1, file_name: "a.jpg", mime_type: "image/jpeg" }] }],
    medications: [{ id: "m1", visit_id: "v1", name: "Thuốc", dose: "1v", schedule: "sáng", duration_days: 7, notes: null }],
    action_items: [{ id: "a1", content: "Tái khám", due_on: null, done: false, visit_id: "v1", notes: null }],
    observations: [{ id: "o1", test_code: "GLU", raw_name: "Glucose", value: 5.1, value_text: null, unit: "mmol/L", raw_value: "5.1", raw_unit: "mmol/l", ref_range_text: null, flag: null, test_catalog: { name_vi: "Đường huyết" } }],
    vaccinations: [{ id: "x1", vaccine_name: "Vaxigrip", disease: null, dose_label: null, given_on: null, next_due_on: null }],
  };
  assert.deepEqual(toPublicVisit(json), json);
});

test("an empty visit has empty arrays everywhere", () => {
  for (const extra of [{}, { documents: [], medications: [], action_items: [], observations: [], vaccinations: [] }]) {
    const v = toPublicVisit({ id: "v1", person_id: "p1", ...extra });
    assert.deepEqual([v?.documents, v?.medications, v?.action_items, v?.observations, v?.vaccinations], [[], [], [], [], []]);
    assert.equal(v?.case_id, null);
    assert.equal(v?.cases, null);
    assert.equal(v?.notes, null);
  }
});

test("a case with no visits has no visits, results or to-dos", () => {
  const c = toPublicCase({ id: "c1", person_id: "p1", title: "Gan", status: "dang_theo_doi", people: { full_name: "An" }, visits: [] });
  assert.deepEqual([c?.visits, c?.observations, c?.action_items], [[], [], []]);
  assert.equal(c?.ended_on, null);
  assert.equal(c?.notes, null);
  assert.equal(toPublicCase({ id: "c1" })?.visits.length, 0);
});
