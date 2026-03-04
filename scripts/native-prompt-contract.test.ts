import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const TARGET_FILES = [
  "app/FAQPage.tsx",
  "components/FAQItem.tsx",
  "app/admin/review/page.tsx",
];

const NATIVE_PROMPT_PATTERN = /\b(window\.)?(alert|confirm)\s*\(/g;

test("no native blocking prompt APIs in app code", () => {
  const violations: string[] = [];

  for (const relPath of TARGET_FILES) {
    const absPath = path.resolve(relPath);
    const source = fs.readFileSync(absPath, "utf8");
    const matches = source.match(NATIVE_PROMPT_PATTERN);
    if (matches && matches.length > 0) {
      violations.push(`${relPath}: ${matches.join(", ")}`);
    }
  }

  assert.equal(violations.length, 0, violations.join("\n"));
});
