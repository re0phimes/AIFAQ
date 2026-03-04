import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const faqItem = fs.readFileSync("components/FAQItem.tsx", "utf8");
const faqType = fs.readFileSync("src/types/faq.ts", "utf8");
const homePage = fs.readFileSync("app/page.tsx", "utf8");
const i18n = fs.readFileSync("lib/i18n.ts", "utf8");

test("FAQItem defines newly-created badge condition using createdAt", () => {
  assert.match(faqItem, /isNewlyCreated/);
  assert.match(faqItem, /item\.createdAt/);
});

test("FAQItem renders newlyAdded i18n key", () => {
  assert.match(faqItem, /t\("newlyAdded",\s*lang\)/);
});

test("FAQItem keeps updated badge and allows simultaneous checks", () => {
  assert.match(faqItem, /isRecentlyUpdated/);
  assert.ok(!/else\s+if\s*\(\s*isRecentlyUpdated/.test(faqItem));
});

test("FAQItem type includes createdAt", () => {
  assert.match(faqType, /createdAt\?:\s*string/);
});

test("home page maps DB created_at to createdAt", () => {
  assert.match(homePage, /createdAt:\s*item\.created_at\??\.toISOString\(\)/);
});

test("i18n contains newlyAdded label", () => {
  assert.match(i18n, /newlyAdded/);
});
