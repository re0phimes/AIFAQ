import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("FAQ list no longer imports legacy tag taxonomy", () => {
  const source = fs.readFileSync("components/FAQList.tsx", "utf8");
  assert.equal(source.includes("tag-taxonomy.json"), false);
});

test("Tag filter no longer imports legacy tag taxonomy types", () => {
  const source = fs.readFileSync("components/TagFilter.tsx", "utf8");
  assert.equal(source.includes("TagTaxonomy"), false);
});

test("taxonomy UI uses canonical taxonomy helpers", () => {
  const faqList = fs.readFileSync("components/FAQList.tsx", "utf8");
  const tagFilter = fs.readFileSync("components/TagFilter.tsx", "utf8");
  const faqItem = fs.readFileSync("components/FAQItem.tsx", "utf8");

  assert.equal(faqList.includes("getPrimaryCategoryOptions"), true);
  assert.equal(tagFilter.includes("getPrimaryCategoryLabel"), true);
  assert.equal(faqItem.includes("getPrimaryCategoryLabel"), true);
});
