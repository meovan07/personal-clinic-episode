import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPACT_AFTER, KEEP_RECENT, compactionRange } from "./memory";

// Alternating user/assistant turns, n messages long.
const turns = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? "user" : "assistant"));

test("no compaction while the unsummarized part is short", () => {
  assert.equal(compactionRange(turns(COMPACT_AFTER), 0), null);
  assert.equal(compactionRange(turns(40), 40 - COMPACT_AFTER), null);
});

test("keeps about KEEP_RECENT messages and cuts at the start of a user message", () => {
  const roles = turns(COMPACT_AFTER + 2); // 26 messages, last is an assistant reply
  const range = compactionRange(roles, 0)!;
  assert.equal(range.from, 0);
  assert.equal(roles[range.to], "user");
  assert.ok(roles.length - range.to >= KEEP_RECENT);
});

test("never splits a question from its answer", () => {
  // 25 messages ending with a user question: 25 - 10 = 15 is an assistant reply, so the cut moves back to 14.
  const range = compactionRange(turns(25), 0)!;
  assert.deepEqual(range, { from: 0, to: 14 });
});

test("continues from where the previous summary stopped", () => {
  const first = compactionRange(turns(26), 0)!;
  assert.equal(compactionRange(turns(30), first.to), null);
  const second = compactionRange(turns(42), first.to)!;
  assert.equal(second.from, first.to);
  assert.equal(turns(42)[second.to], "user");
});
