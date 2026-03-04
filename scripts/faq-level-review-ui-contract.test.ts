import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reviewPage = fs.readFileSync("app/admin/review/page.tsx", "utf8");

test("review page defines level filter state and UI options", () => {
  assert.match(reviewPage, /const \[levelFilter,\s*setLevelFilter\]/);
  assert.match(reviewPage, /level.*all/i);
  assert.match(reviewPage, /level.*1/i);
  assert.match(reviewPage, /level.*2/i);
});

test("review page item type includes level", () => {
  assert.match(reviewPage, /level:\s*1\s*\|\s*2/);
});

test("review page filters list using item.level", () => {
  assert.match(reviewPage, /item\.level/);
  assert.match(reviewPage, /levelFilter/);
});

test("review page sends set_level patch when changing level", () => {
  assert.match(reviewPage, /action:\s*["']set_level["']/);
  assert.match(reviewPage, /level:\s*level/);
});
