import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const faqItemPath = "components/FAQItem.tsx";

function readRequiredFile(filePath: string): string {
  assert.ok(fs.existsSync(filePath), `Missing required file: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

test("FAQItem defers heavy answer rendering until item is open", () => {
  const source = readRequiredFile(faqItemPath);

  assert.match(source, /import AsyncMarkdownContent from "\.\/AsyncMarkdownContent"/);
  assert.match(source, /isOpen && \(/);
  assert.match(source, /<AsyncMarkdownContent/);
  assert.match(source, /<AsyncMarkdownContent[\s\S]*content=\{detailed/);
});
