import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeFaqTaxonomyFields } from "./db";

test("normalizes nullable taxonomy fields from DB rows", () => {
  const normalized = normalizeFaqTaxonomyFields({
    primary_category: "model_architecture",
    secondary_category: null,
    patterns: null,
    topics: ["rope"],
    tool_stack: null,
  });

  assert.equal(normalized.primaryCategory, "model_architecture");
  assert.equal(normalized.secondaryCategory, null);
  assert.deepEqual(normalized.patterns, []);
  assert.deepEqual(normalized.topics, ["rope"]);
  assert.deepEqual(normalized.toolStack, []);
});

test("page-level mappers expose taxonomy fields to app-facing FAQ items", () => {
  const homePage = fs.readFileSync("app/page.tsx", "utf8");
  const detailPage = fs.readFileSync("app/faq/[id]/page.tsx", "utf8");
  const profilePage = fs.readFileSync("app/profile/page.tsx", "utf8");

  assert.equal(homePage.includes("primaryCategory:"), true);
  assert.equal(homePage.includes("secondaryCategory:"), true);
  assert.equal(detailPage.includes("primaryCategory:"), true);
  assert.equal(detailPage.includes("secondaryCategory:"), true);
  assert.equal(profilePage.includes("primaryCategory:"), true);
  assert.equal(profilePage.includes("secondaryCategory:"), true);
});
