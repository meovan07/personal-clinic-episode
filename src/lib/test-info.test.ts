import { test } from "node:test";
import assert from "node:assert/strict";
import { explainResult, TEST_INFO } from "./test-info";

test("explains a flagged result with what it measures and what the flag means", () => {
  assert.equal(
    explainResult("GGT", "high"),
    "Men gan liên quan đường mật. Cao: thường gặp khi uống rượu bia, gan nhiễm mỡ hoặc tắc mật.",
  );
  assert.equal(
    explainResult("HBSAG", "abnormal"),
    "Dấu hiệu đang nhiễm virus viêm gan B. Bất thường: dương tính, tức là đang mang virus viêm gan B.",
  );
});

test("normal or unknown flag: only what it measures; unknown test: nothing", () => {
  assert.equal(explainResult("LDL", "normal"), 'Mỡ "xấu", bám vào thành mạch.');
  assert.equal(explainResult("HDL", "high"), 'Mỡ "tốt", giúp dọn mỡ thừa.');
  assert.equal(explainResult("TESTOSTERONE", "high"), null);
  assert.equal(explainResult(null, null), null);
});

test("all 48 catalog codes have a non-empty explanation", () => {
  for (const [code, info] of Object.entries(TEST_INFO)) assert.ok(info.what.length > 5, code);
  assert.equal(Object.keys(TEST_INFO).length, 48);
});

test("doesn't repeat the test name as its own explanation", () => {
  assert.equal(explainResult("WEIGHT", null, "Cân nặng"), null);
  assert.equal(
    explainResult("BMI", "high", "BMI"),
    "Chỉ số khối cơ thể, tính từ cân nặng và chiều cao. Cao: thừa cân hoặc béo phì.",
  );
});
