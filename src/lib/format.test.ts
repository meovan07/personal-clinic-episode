import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeDue, tidyName } from "./format";

test("relativeDue: overdue, today, soon, later", () => {
  const today = "2026-10-02";
  assert.deepEqual(relativeDue("2026-09-29", today), { label: "Quá hạn 3 ngày", tone: "danger" });
  assert.deepEqual(relativeDue("2026-02-16", today), { label: "Quá hạn 8 tháng", tone: "danger" });
  assert.deepEqual(relativeDue("2026-10-02", today), { label: "Hôm nay", tone: "low" });
  assert.deepEqual(relativeDue("2026-10-03", today), { label: "Ngày mai", tone: "low" });
  assert.deepEqual(relativeDue("2026-10-07", today), { label: "Còn 5 ngày", tone: "low" });
  assert.deepEqual(relativeDue("2026-10-30", today), { label: "Còn 4 tuần", tone: "neutral" });
  assert.deepEqual(relativeDue("2027-02-01", today), { label: "Còn 4 tháng", tone: "neutral" });
  assert.deepEqual(relativeDue("2030-09-06", today), { label: "06/09/2030", tone: "neutral" });
});

test("tidyName: capitals become normal case, abbreviations stay", () => {
  assert.equal(tidyName("TRUNG TÂM XÉT NGHIỆM Y KHOA MEDILAB"), "Trung Tâm Xét Nghiệm Y Khoa Medilab");
  assert.equal(tidyName("BỆNH VIỆN PHỤ SẢN - NHI ĐÀ NẴNG"), "Bệnh Viện Phụ Sản - Nhi Đà Nẵng");
  assert.equal(tidyName("VNVC"), "VNVC");
  assert.equal(tidyName("CÔNG TY TNHH Y TẾ HÒA HẢO"), "Công Ty TNHH Y Tế Hòa Hảo");
  assert.equal(tidyName("Bệnh viện Đa khoa Gia Đình"), "Bệnh viện Đa khoa Gia Đình");
  assert.equal(tidyName(null), "");
});
