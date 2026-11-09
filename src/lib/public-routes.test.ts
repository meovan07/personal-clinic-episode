import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicPath } from "./public-routes";

const ID = "3f2b8c1e-5a4d-4e7b-9c10-0a1b2c3d4e5f";

test("public routes (spec R1) are open to signed-out visitors", () => {
  assert.equal(isPublicPath(`/people/${ID}`, ""), true);
  assert.equal(isPublicPath(`/people/${ID}`, "?tab=tong-quan"), true);
  assert.equal(isPublicPath(`/people/${ID}`, "tab=lan-kham"), true);
  assert.equal(isPublicPath(`/visits/${ID}`, ""), true);
  assert.equal(isPublicPath(`/cases/${ID}`, ""), true);
  assert.equal(isPublicPath(`/api/public-file/${ID}`, ""), true);
});

test("locked routes (spec R1) stay behind login", () => {
  assert.equal(isPublicPath("/", ""), false);
  assert.equal(isPublicPath(`/people/${ID}`, "?tab=chi-so"), false);
  assert.equal(isPublicPath(`/people/${ID}`, "?tab=tiem-chung"), false);
  assert.equal(isPublicPath(`/people/${ID}/summary`, ""), false);
  assert.equal(isPublicPath(`/people/${ID}/vaccinations`, ""), false);
  assert.equal(isPublicPath(`/people/${ID}/edit`, ""), false);
  assert.equal(isPublicPath("/visits", ""), false);
  assert.equal(isPublicPath("/visits/new", ""), false);
  assert.equal(isPublicPath(`/visits/${ID}/edit`, ""), false);
  assert.equal(isPublicPath("/cases/new", ""), false);
  assert.equal(isPublicPath(`/cases/${ID}/edit`, ""), false);
  assert.equal(isPublicPath("/settings", ""), false);
  assert.equal(isPublicPath("/inbox/x/review", ""), false);
  assert.equal(isPublicPath("/documents/x/review", ""), false);
  assert.equal(isPublicPath("/api/chat", ""), false);
  assert.equal(isPublicPath("/login", ""), false);
});

test("boundaries: tabs, trailing slash, ids, query forms", () => {
  assert.equal(isPublicPath(`/people/${ID}`, "?tab=unknown"), true);
  assert.equal(isPublicPath(`/people/${ID}`, new URLSearchParams("tab=chi-so")), false);
  assert.equal(isPublicPath(`/people/${ID}`, new URLSearchParams("tab=lan-kham")), true);
  assert.equal(isPublicPath(`/visits/${ID}/`, ""), true);
  assert.equal(isPublicPath(`/people/${ID}/`, "?tab=chi-so"), false);
  assert.equal(isPublicPath(`/visits/${ID}`, "?tab=chi-so"), true);
  assert.equal(isPublicPath("/people/new", ""), false);
  assert.equal(isPublicPath("/visits/abc", ""), false);
  assert.equal(isPublicPath(`/visits/${ID.toUpperCase()}`, ""), true);
  assert.equal(isPublicPath("/api/public-file/abc", ""), false);
  assert.equal(isPublicPath(`/visits/${ID}//`, ""), false);
});
