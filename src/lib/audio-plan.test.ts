import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_ACCEPT,
  AUDIO_FORMAT_ERROR,
  AUDIO_TOO_LONG_ERROR,
  checkAudioFile,
  checkDuration,
  pickQuietPoint,
  planParts,
  recordedOn,
  splitAudioFiles,
} from "./audio-plan";

const FORMAT_MSG = "Không đọc được file ghi âm này (hỗ trợ m4a, mp3, wav, webm, ogg, aac).";
const LONG_MSG = "Bản ghi dài hơn 2 giờ, hãy cắt bớt.";

test("R1 format check accepts the six formats and rejects amr", () => {
  const ok = [
    { name: "a.m4a", type: "audio/mp4" },
    { name: "a2.m4a", type: "" },
    { name: "b.mp3", type: "audio/mpeg" },
    { name: "c.wav", type: "audio/wav" },
    { name: "d.webm", type: "audio/webm" },
    { name: "e.ogg", type: "audio/ogg" },
    { name: "f.aac", type: "audio/aac" },
  ];
  for (const f of ok) assert.equal(checkAudioFile(f), null, f.name);
  const err = checkAudioFile({ name: "ghi-am.amr", type: "audio/amr" });
  assert.equal(err, AUDIO_FORMAT_ERROR);
  assert.equal(err, FORMAT_MSG);
});

test("R1 splits audio from photos, one group per audio", () => {
  const f = (name: string) => ({ name, type: "" });
  const a = splitAudioFiles([f("kham-tim.m4a"), f("anh-1.jpg"), f("anh-2.jpg")]);
  assert.deepEqual(a.audioGroups.map((g) => g.map((x) => x.name)), [["kham-tim.m4a"]]);
  assert.deepEqual(a.other.map((x) => x.name), ["anh-1.jpg", "anh-2.jpg"]);
  const b = splitAudioFiles([f("sang.m4a"), f("chieu.mp3")]);
  assert.equal(b.audioGroups.length, 2);
  assert.ok(b.audioGroups.every((g) => g.length === 1));
  const c = splitAudioFiles([f("toa.jpg"), f("kq.pdf")]);
  assert.equal(c.audioGroups.length, 0);
  assert.equal(c.other.length, 2);
});

test("R2 accepts 2:00:00 and rejects 2:00:01", () => {
  assert.equal(checkDuration(7200), null);
  const err = checkDuration(7201);
  assert.equal(err, AUDIO_TOO_LONG_ERROR);
  assert.equal(err, LONG_MSG);
});

test("R2 unreadable duration gives the R1 message", () => {
  for (const d of [NaN, null, Infinity]) {
    const err = checkDuration(d);
    assert.equal(err, AUDIO_FORMAT_ERROR);
    assert.equal(err, FORMAT_MSG);
  }
});

test("R4 part count at 9:59, 10:00 and 10:01", () => {
  const p599 = planParts(599);
  assert.equal(p599.length, 1);
  assert.equal(p599[0].start, 0);
  assert.equal(p599[0].end, 599);
  const p600 = planParts(600);
  assert.equal(p600.length, 1);
  assert.equal(p600[0].start, 0);
  assert.equal(p600[0].end, 600);
  assert.equal(planParts(601).length, 2);
});

test("R4 2:00:00 makes 12 contiguous parts of 10 min or less", () => {
  const parts = planParts(7200);
  assert.equal(parts.length, 12);
  assert.equal(parts[0].start, 0);
  assert.equal(parts[11].end, 7200);
  for (let i = 0; i < parts.length; i++) {
    assert.ok(parts[i].end - parts[i].start <= 600);
    if (i > 0) assert.equal(parts[i].start, parts[i - 1].end);
  }
});

test("R4 part over 24 MB is cut shorter at an extra point", () => {
  const parts = planParts(1200, { bitrateKbps: 400 });
  assert.ok(parts.length > 2);
  for (const p of parts) {
    assert.ok(((p.end - p.start) * 400 * 1000) / 8 <= 24 * 1024 * 1024);
  }
});

test("R4 cut picks quietest 0.5 s in the window", () => {
  const loud = new Array(40).fill(5);
  loud[28] = 1;
  assert.ok(Math.abs(pickQuietPoint(loud, 590, 600) - 604.0) <= 0.5);
});

test("R4 window edge: +10 s accepted, +10.5 s ignored", () => {
  const a = new Array(40).fill(5);
  a[39] = 1;
  assert.equal(pickQuietPoint(a, 590, 600), 609.5);
  const b = new Array(44).fill(5);
  b[0] = 0; // 589.0-589.5
  b[43] = 0; // 610.5-611.0
  b[12] = 1; // 595.0-595.5
  assert.equal(pickQuietPoint(b, 589, 600), 595.0);
});

test("R4 window uses fixed marks, not the previous cut", () => {
  const l = new Array(60).fill(5); // origin 1185
  l[2] = 0; // 1186.0-1186.5 (outside 1190-1210)
  l[40] = 1; // 1205.0-1205.5
  assert.equal(pickQuietPoint(l, 1185, 1200), 1205.0);
});

test("R9 recording date comes from lastModified", () => {
  assert.equal(recordedOn(Date.UTC(2026, 10, 5, 2, 30)), "2026-11-05");
});

test("R4 planParts rejects unreadable durations", () => {
  for (const d of [NaN, 0, -5, Infinity]) {
    assert.throws(() => planParts(d), (e: unknown) => e instanceof Error && e.message === AUDIO_FORMAT_ERROR);
  }
});

test("R1 mixed pick gives audio items and one photo group", () => {
  const files = [
    { name: "kham-tim.m4a", type: "audio/mp4" },
    { name: "anh-1.jpg", type: "image/jpeg" },
    { name: "toa.pdf", type: "application/pdf" },
  ];
  const r = splitAudioFiles(files);
  assert.deepEqual(r.audioGroups, [[files[0]]]);
  assert.deepEqual(r.other, [files[1], files[2]]);
});

test("picker accept lists Apple MPEG-4 audio explicitly", () => {
  const accept = AUDIO_ACCEPT.split(",");
  for (const t of ["audio/*", "audio/mp4", "audio/x-m4a", ".m4a", ".mp3", ".wav", ".webm", ".ogg", ".aac"]) {
    assert.ok(accept.includes(t), t);
  }
});
