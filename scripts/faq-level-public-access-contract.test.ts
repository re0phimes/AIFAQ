import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const homePage = fs.readFileSync("app/page.tsx", "utf8");
const detailPage = fs.readFileSync("app/faq/[id]/page.tsx", "utf8");

test("home page resolves session and allowed levels server-side", () => {
  assert.match(homePage, /from ["']@\/auth["']/);
  assert.match(homePage, /getServerSession\(\)|auth\(\)/);
  assert.match(homePage, /resolveAllowedLevels\(/);
});

test("home page filters items by FAQ level before render", () => {
  assert.match(homePage, /item\.level/);
  assert.match(homePage, /allowedLevels/);
});

test("detail page checks level access and returns notFound when forbidden", () => {
  assert.match(detailPage, /canAccessFaqLevel\(/);
  assert.match(detailPage, /notFound\(\)/);
  assert.match(detailPage, /faqItem\.level/);
});
