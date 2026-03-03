import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStoredTheme,
  resolveInitialTheme,
  shouldFollowSystem,
} from "./theme-preference";

test("normalizeStoredTheme handles unknown values as system", () => {
  assert.equal(normalizeStoredTheme("dark"), "dark");
  assert.equal(normalizeStoredTheme("light"), "light");
  assert.equal(normalizeStoredTheme("system"), "system");
  assert.equal(normalizeStoredTheme("foo"), "system");
  assert.equal(normalizeStoredTheme(null), "system");
});

test("resolveInitialTheme prefers user explicit theme", () => {
  assert.equal(resolveInitialTheme("dark", false), "dark");
  assert.equal(resolveInitialTheme("light", true), "light");
});

test("resolveInitialTheme falls back to system when stored=system", () => {
  assert.equal(resolveInitialTheme("system", true), "dark");
  assert.equal(resolveInitialTheme("system", false), "light");
});

test("shouldFollowSystem only true when stored=system", () => {
  assert.equal(shouldFollowSystem("system"), true);
  assert.equal(shouldFollowSystem("dark"), false);
  assert.equal(shouldFollowSystem("light"), false);
});
