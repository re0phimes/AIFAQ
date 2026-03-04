import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const faqList = fs.readFileSync("components/FAQList.tsx", "utf8");
const faqPage = fs.readFileSync("app/FAQPage.tsx", "utf8");
const i18n = fs.readFileSync("lib/i18n.ts", "utf8");

test("FAQList defines level filter state", () => {
  assert.match(faqList, /const \[levelFilter,\s*setLevelFilter\]/);
});

test("FAQList only shows level controls for premium or admin", () => {
  assert.match(faqList, /tier === ["']premium["']/);
  assert.match(faqList, /role === ["']admin["']/);
});

test("FAQList filters using item.level with fallback", () => {
  assert.match(faqList, /item\.level\s*\?\?\s*1/);
  assert.match(faqList, /levelFilter/);
});

test("FAQPage session typing includes role for FAQList", () => {
  assert.match(faqPage, /role\?:\s*string/);
});

test("i18n includes labels for level filter", () => {
  assert.match(i18n, /levelAll/);
  assert.match(i18n, /level1/);
  assert.match(i18n, /level2/);
});
