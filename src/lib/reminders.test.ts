import { test } from "node:test";
import assert from "node:assert/strict";
import type { CalendarEvent } from "./calendar";
import { morningDigest } from "./reminders";

const ev = (date: string, kind: CalendarEvent["kind"], title: string, personName = "Hồ Thị Mai"): CalendarEvent => ({
  date,
  kind,
  title,
  href: `/x/${title}`,
  personName,
});

test("nothing due today or tomorrow → no notification", () => {
  assert.equal(
    morningDigest([ev("2026-10-05", "todo", "Tái khám"), ev("2026-10-01", "todo", "Quá hạn")], "2026-10-02"),
    null,
  );
});

test("visits and given doses never trigger a reminder", () => {
  assert.equal(
    morningDigest([ev("2026-10-02", "visit", "Medilab"), ev("2026-10-02", "vaccination", "Cúm")], "2026-10-02"),
    null,
  );
});

test("one item: says when and what, opens that item", () => {
  const m = morningDigest([ev("2026-10-03", "dose_due", "Mũi tiếp theo: Cúm")], "2026-10-02");
  assert.equal(m?.title, "Ngày mai: Mũi tiếp theo: Cúm");
  assert.equal(m?.body, "Hồ Thị Mai");
  assert.equal(m?.url, "/x/Mũi tiếp theo: Cúm");
  assert.equal(m?.tag, "reminders-2026-10-02");
});

test("several items across both days: one line each, today first, opens home", () => {
  const m = morningDigest(
    [ev("2026-10-03", "todo", "Xét nghiệm mỡ máu", "Đỗ Quốc Hưng"), ev("2026-10-02", "todo", "Tái khám")],
    "2026-10-02",
  );
  assert.equal(m?.title, "2 việc hôm nay và ngày mai");
  assert.equal(m?.body, "Hôm nay · Hồ Thị Mai: Tái khám\nNgày mai · Đỗ Quốc Hưng: Xét nghiệm mỡ máu");
  assert.equal(m?.url, "/");
});

test("several items on the same day: the day goes in the title", () => {
  const m = morningDigest([ev("2026-10-02", "todo", "A"), ev("2026-10-02", "todo", "B", "Đỗ Quốc Hưng")], "2026-10-02");
  assert.equal(m?.title, "2 việc hôm nay");
  assert.equal(m?.body, "Đỗ Quốc Hưng: B\nHồ Thị Mai: A");
});

test("month boundary: 31/10 → tomorrow is 01/11", () => {
  assert.equal(morningDigest([ev("2026-11-01", "todo", "Tái khám")], "2026-10-31")?.title, "Ngày mai: Tái khám");
});
