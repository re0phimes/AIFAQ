import test from "node:test";
import assert from "node:assert/strict";
import { buildThemeInitScript } from "./theme-init-script";

test("buildThemeInitScript includes storage key and data-theme write", () => {
  const script = buildThemeInitScript("aifaq-theme");
  assert.match(script, /aifaq-theme/);
  assert.match(script, /document\.documentElement\.dataset\.theme/);
  assert.match(script, /matchMedia/);
});

test("buildThemeInitScript guards runtime errors", () => {
  const script = buildThemeInitScript("aifaq-theme");
  assert.match(script, /try/);
  assert.match(script, /catch/);
});
