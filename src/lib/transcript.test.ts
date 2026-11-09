import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applySpeakerRoles,
  capTranscript,
  failureLabel,
  joinParts,
  nextParts,
  partPathsToDelete,
  progressLabel,
  transcriptToggleLabel,
  type PartSegment,
  type PartStatus,
  type TranscriptPart,
} from "./transcript";

const part = (part_no: number, status: PartStatus, extra: Partial<TranscriptPart> = {}): TranscriptPart => ({
  part_no,
  start_sec: (part_no - 1) * 600,
  end_sec: part_no * 600,
  status,
  storage_path: `p/${part_no}.m4a`,
  segments: null,
  ...extra,
});
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test("R4 joined segment times are offset and ordered", () => {
  const seg = (start: number, text: string) => ({ start, end: start + 2, speaker: "A", text });
  const parts = [
    part(3, "done", { start_sec: 1202, segments: [seg(5, "c")] }),
    part(1, "done", { start_sec: 0, segments: [seg(1, "a")] }),
    part(2, "done", { start_sec: 600, segments: [seg(2, "b")] }),
  ];
  const { complete, segments } = joinParts(parts);
  assert.equal(complete, true);
  assert.deepEqual(segments.map((s) => s.part_no), [1, 2, 3]);
  assert.equal(segments[2].start, 1207);
});

test("R5 scheduler never runs more than 3", () => {
  const pending12 = range(1, 12).map((n) => part(n, "pending"));
  assert.deepEqual(nextParts(pending12, []), [1, 2, 3]);
  assert.deepEqual(nextParts(pending12, [1, 2, 3]), []);
  const c = range(1, 12).map((n) => part(n, n === 3 ? "done" : "pending"));
  assert.deepEqual(nextParts(c, [1, 2]), [4]);
  const d = range(1, 12).map((n) => part(n, n <= 11 ? "done" : "pending"));
  assert.deepEqual(nextParts(d, []), [12]);
});

test("R5 progress label counts done parts", () => {
  const parts = range(1, 12).map((n) => part(n, n <= 4 ? "done" : "pending"));
  assert.equal(progressLabel(parts), "Đang chép lời 4/12");
});

test("R6 timeout on part 7 keeps the other 11", () => {
  const parts = range(1, 12).map((n) =>
    n === 7
      ? part(n, "failed", { error: "timeout" })
      : part(n, "done", { segments: [{ start: 0, end: 1, speaker: "A", text: "x" }] }),
  );
  assert.equal(failureLabel(parts), "Chép lời lỗi 1/12 phần");
  assert.deepEqual(nextParts(parts, []), [7]);
  assert.equal(parts.filter((p) => p.status === "done").length, 11);
});

test("R7 applies roles per part, unmapped become Người nói", () => {
  const s = (part_no: number, speaker: string): PartSegment => ({
    part_no,
    start: 12,
    end: 15,
    speaker,
    text: "Dạo này anh ăn uống thế nào?",
  });
  const roles = {
    1: { A: "Bác sĩ", B: "Bệnh nhân" },
    2: { A: "Người nhà", B: "Bác sĩ" },
  };
  const out = applySpeakerRoles([s(1, "A"), s(1, "B"), s(1, "C"), s(2, "A"), s(2, "B")], roles);
  assert.deepEqual(out.map((o) => o.speaker), ["Bác sĩ", "Bệnh nhân", "Người nói", "Người nhà", "Bác sĩ"]);
  for (const o of out) {
    assert.equal(o.text, "Dạo này anh ăn uống thế nào?");
    assert.equal(o.start, 12);
    assert.equal(o.end, 15);
  }
});

test("R10 minutes label rounds up", () => {
  assert.equal(transcriptToggleLabel(1740), "Xem lời thoại (29 phút)");
  assert.equal(transcriptToggleLabel(1741), "Xem lời thoại (30 phút)");
  assert.equal(transcriptToggleLabel(1800), "Xem lời thoại (30 phút)");
});

test("R13 cap at 30,000 and note at 30,001", () => {
  const a = "x".repeat(30_000);
  assert.equal(capTranscript(a), a);
  const b = "x".repeat(30_001);
  const out = capTranscript(b);
  assert.ok(out.startsWith(a));
  assert.equal(out.slice(30_000).trim(), "[Đã cắt: còn 1 ký tự]");
});

test("R14 lists part paths only", () => {
  const parts = [{ storage_path: "p/1.m4a" }, { storage_path: "p/2.m4a" }, { storage_path: "p/3.m4a" }];
  const paths = partPathsToDelete(parts);
  assert.deepEqual(paths, ["p/1.m4a", "p/2.m4a", "p/3.m4a"]);
  assert.ok(!paths.includes("r/main.m4a"));
  assert.deepEqual(partPathsToDelete([]), []);
});
