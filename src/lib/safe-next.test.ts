import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./safe-next";

test("same-origin relative paths are kept", () => {
  assert.equal(safeNext("/visits/abc"), "/visits/abc");
  assert.equal(safeNext("/people/abc?tab=lan-kham"), "/people/abc?tab=lan-kham");
  assert.equal(safeNext("/cases/abc"), "/cases/abc");
});

test("anything else falls back to /", () => {
  for (const bad of [
    null,
    undefined,
    42,
    {},
    "",
    "visits/x",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/visits/x\nSet-Cookie: a=b",
    "/visits/x\ty",
    "/visits/\x00x",
    "/login",
    "/login?next=/visits/x",
  ]) {
    assert.equal(safeNext(bad), "/", JSON.stringify(bad));
  }
});
