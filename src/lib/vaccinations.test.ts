import assert from "node:assert/strict";
import { test } from "node:test";
import { groupBySeries, isSameDose, pendingDoses } from "./vaccinations";

const dose = (vaccine_name: string, disease: string | null, given_on: string | null, next_due_on: string | null = null) => ({
  vaccine_name,
  disease,
  given_on,
  next_due_on,
});

test("isSameDose matches the same shot re-read from another photo", () => {
  assert.equal(isSameDose(dose("Vaxigrip Tetra", "Cúm", "2025-10-01"), dose("VAXIGRIP  tetra", null, "2025-10-01")), true);
  assert.equal(isSameDose(dose("Vaxigrip Tetra", "Cúm", "2025-10-01"), dose("Influvac", "cum", "2025-10-01")), true);
  assert.equal(isSameDose(dose("Vaxigrip Tetra", "Cúm", "2025-10-01"), dose("Vaxigrip Tetra", "Cúm", "2024-10-01")), false);
  assert.equal(isSameDose(dose("Gardasil 9", "HPV", "2025-10-01"), dose("Vaxigrip Tetra", "Cúm", "2025-10-01")), false);
  assert.equal(isSameDose(dose("Gardasil 9", "HPV", null), dose("Gardasil 9", "HPV", null)), false);
});

test("pendingDoses drops appointments already covered by a later dose of the series", () => {
  const doses = [
    dose("Gardasil 9", "HPV", "2025-01-10", "2025-03-10"),
    dose("Gardasil 9", "HPV", "2025-03-12", "2025-07-10"),
    dose("Vaxigrip Tetra", "Cúm", "2025-10-01", "2026-10-01"),
    dose("Engerix-B", "Viêm gan B", "2024-01-01", null),
  ];
  assert.deepEqual(
    pendingDoses(doses).map((d) => d.next_due_on),
    ["2025-07-10", "2026-10-01"],
  );
});

test("groupBySeries groups doses by disease, newest series activity first", () => {
  const doses = [
    dose("Gardasil 9", "HPV", "2025-01-10", "2025-03-10"),
    dose("Gardasil 9", "HPV", "2025-03-12", "2025-07-10"),
    dose("Vaxigrip Tetra", "Cúm", "2025-10-01", "2026-10-01"),
  ];
  const groups = groupBySeries(doses);
  assert.deepEqual(
    groups.map((g) => [g.title, g.doses.length]),
    [
      ["Cúm", 1],
      ["HPV", 2],
    ],
  );
});
