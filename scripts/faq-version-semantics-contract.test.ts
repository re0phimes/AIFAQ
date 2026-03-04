import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const db = fs.readFileSync("lib/db.ts", "utf8");

test("updateFaqStatus uses explicit first-review guard before bumping version", () => {
  assert.match(db, /hasExistingAnswer/);
  assert.match(db, /shouldBumpVersion/);
});

test("version increment is conditional rather than unconditional +1", () => {
  assert.match(db, /newVersion\s*=\s*shouldBumpVersion\s*\?\s*oldVersion\s*\+\s*1\s*:\s*oldVersion/);
});

test("createVersion call is guarded by shouldBumpVersion", () => {
  assert.match(db, /if\s*\(\s*shouldBumpVersion\s*\)\s*\{[\s\S]*createVersion\(/);
});
