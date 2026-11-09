import { test } from "node:test";
import assert from "node:assert/strict";
import { fileResponseInit, isUuid } from "./public-file";

test("no row, or a row without a usable storage_path, is a 404", () => {
  assert.deepEqual(fileResponseInit(null), { status: 404 });
  assert.deepEqual(fileResponseInit(undefined), { status: 404 });
  assert.deepEqual(fileResponseInit("x"), { status: 404 });
  assert.deepEqual(fileResponseInit({ mime_type: "image/jpeg" }), { status: 404 });
  assert.deepEqual(fileResponseInit({ storage_path: "", mime_type: "image/jpeg" }), { status: 404 });
  assert.deepEqual(fileResponseInit({ storage_path: 5 }), { status: 404 });
});

test("a valid row gives the path and the exact headers", () => {
  assert.deepEqual(fileResponseInit({ storage_path: "a/b.jpg", mime_type: "image/jpeg" }), {
    status: 200,
    path: "a/b.jpg",
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

test("a missing or empty mime type falls back to application/octet-stream", () => {
  for (const row of [{ storage_path: "p" }, { storage_path: "p", mime_type: "" }, { storage_path: "p", mime_type: null }]) {
    const r = fileResponseInit(row);
    assert.equal(r.status, 200);
    if (r.status === 200) assert.equal(r.headers["Content-Type"], "application/octet-stream");
  }
});

test("isUuid accepts a uuid and nothing else", () => {
  assert.equal(isUuid("3b241101-e2bb-4255-8caf-4136c566a962"), true);
  assert.equal(isUuid("abc"), false);
  assert.equal(isUuid(""), false);
  assert.equal(isUuid("3b241101-e2bb-4255-8caf-4136c566a962/x"), false);
});
