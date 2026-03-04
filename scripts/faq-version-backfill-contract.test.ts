import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const scriptPath = "tools/faq-sync/fix-version-offset.ts";

test("backfill script exists", () => {
  assert.equal(fs.existsSync(scriptPath), true);
});

test("backfill script supports dry-run and apply modes", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  assert.match(script, /--dry-run/);
  assert.match(script, /--apply/);
});

test("backfill script reports manual_review bucket", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  assert.match(script, /manual_review/);
});

test("package.json includes faq:fix-version-offset command", () => {
  const packageJson = fs.readFileSync("package.json", "utf8");
  assert.match(packageJson, /faq:fix-version-offset/);
});
