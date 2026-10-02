import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalKey, canonicalName, testNameKey } from "./names";

test("same place, doctor or department in different spellings share a key", () => {
  assert.equal(canonicalKey("BỆNH VIỆN ĐA KHOA GIA ĐÌNH"), canonicalKey("Bệnh viện Đa khoa Gia Đình"));
  assert.equal(canonicalKey("BV Đa khoa Gia Đình"), canonicalKey("Bệnh viện Đa khoa Gia Đình"));
  assert.equal(canonicalKey("THS.BS TRƯƠNG THỊ BÍCH NGỌC"), canonicalKey("ThS. BS. Trương Thị Bích Ngọc"));
  assert.equal(canonicalKey("Khoa xét nghiệm"), canonicalKey("Khoa Xét nghiệm"));
  assert.notEqual(canonicalKey("Vaxigrip"), canonicalKey("Vaxigrip Tetra"));
});

test("a new value reuses the existing spelling, preferring normal capitalization", () => {
  const existing = ["BỆNH VIỆN ĐA KHOA GIA ĐÌNH", "Bệnh viện Đa khoa Gia Đình", "VNVC"];
  assert.equal(canonicalName("BỆNH VIỆN ĐA KHOA GIA ĐÌNH", existing), "Bệnh viện Đa khoa Gia Đình");
  assert.equal(canonicalName("bv đa khoa gia đình", existing), "Bệnh viện Đa khoa Gia Đình");
  assert.equal(canonicalName("vnvc", existing), "VNVC");
});

test("a new value with no match is stored tidied", () => {
  assert.equal(canonicalName("BỆNH VIỆN C ĐÀ NẴNG", []), "Bệnh Viện C Đà Nẵng");
  assert.equal(canonicalName("  Phòng khám   Hòa Hảo ", []), "Phòng khám Hòa Hảo");
  assert.equal(canonicalName("", []), null);
});

test("test names differing only by a unit in brackets group together", () => {
  assert.equal(testNameKey("Mật độ (10^6/ml)"), testNameKey("Mật độ"));
  assert.equal(testNameKey("Kiêng xuất tinh (ngày)"), testNameKey("Kiêng xuất tinh"));
  assert.equal(testNameKey("Tổng số tinh trùng (10^6)"), testNameKey("Tổng số tinh trùng"));
  assert.notEqual(testNameKey("HBeAg (ECLIA-Roche)"), testNameKey("HBeAg định lượng (Abbott)"));
});

test("several places in one value: keep the one already known, else the first", async () => {
  const { onePlace } = await import("./names");
  const known = ["Trung tâm Xét nghiệm Y khoa Medilab"];
  assert.equal(
    onePlace("TRUNG TÂM XÉT NGHIỆM Y KHOA MEDILAB; CÔNG TY TNHH Y TẾ HÒA HẢO PHÒNG KHÁM ĐA KHOA HÒA HẢO", known),
    "Trung tâm Xét nghiệm Y khoa Medilab",
  );
  assert.equal(onePlace("PHÒNG KHÁM A; PHÒNG KHÁM B", []), "Phòng Khám A");
  assert.equal(onePlace("VNVC", ["VNVC"]), "VNVC");
});
