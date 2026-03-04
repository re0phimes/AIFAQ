import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessFaqLevel,
  normalizeFaqLevelFilter,
  resolveAllowedLevels,
} from "./faq-level-access";

test("canAccessFaqLevel treats anonymous as free", () => {
  assert.equal(canAccessFaqLevel(undefined, 1), true);
  assert.equal(canAccessFaqLevel(undefined, 2), false);
});

test("canAccessFaqLevel allows premium to access level 2", () => {
  assert.equal(canAccessFaqLevel({ tier: "premium", role: "user" }, 1), true);
  assert.equal(canAccessFaqLevel({ tier: "premium", role: "user" }, 2), true);
});

test("canAccessFaqLevel allows admin to access level 2", () => {
  assert.equal(canAccessFaqLevel({ role: "admin", tier: "free" }, 1), true);
  assert.equal(canAccessFaqLevel({ role: "admin", tier: "free" }, 2), true);
});

test("normalizeFaqLevelFilter forces free users to level 1", () => {
  assert.equal(normalizeFaqLevelFilter({ tier: "free", role: "user" }, "all"), 1);
  assert.equal(normalizeFaqLevelFilter({ tier: "free", role: "user" }, "2"), 1);
  assert.equal(normalizeFaqLevelFilter(undefined, "2"), 1);
});

test("normalizeFaqLevelFilter respects premium and admin requests", () => {
  assert.equal(normalizeFaqLevelFilter({ tier: "premium", role: "user" }, "all"), "all");
  assert.equal(normalizeFaqLevelFilter({ tier: "premium", role: "user" }, "1"), 1);
  assert.equal(normalizeFaqLevelFilter({ tier: "premium", role: "user" }, "2"), 2);
  assert.equal(normalizeFaqLevelFilter({ tier: "free", role: "admin" }, "2"), 2);
});

test("normalizeFaqLevelFilter falls back safely on invalid requested value", () => {
  assert.equal(normalizeFaqLevelFilter({ tier: "premium", role: "user" }, "bad"), "all");
  assert.equal(normalizeFaqLevelFilter(undefined, "bad"), 1);
});

test("resolveAllowedLevels returns expected level set", () => {
  assert.deepEqual(resolveAllowedLevels(undefined, "all"), [1]);
  assert.deepEqual(resolveAllowedLevels({ tier: "free", role: "user" }, "2"), [1]);
  assert.deepEqual(resolveAllowedLevels({ tier: "premium", role: "user" }, "all"), [1, 2]);
  assert.deepEqual(resolveAllowedLevels({ tier: "premium", role: "user" }, "1"), [1]);
  assert.deepEqual(resolveAllowedLevels({ tier: "premium", role: "user" }, "2"), [2]);
});
