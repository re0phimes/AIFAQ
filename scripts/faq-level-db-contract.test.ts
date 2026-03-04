import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const db = fs.readFileSync("lib/db.ts", "utf8");
const faqTypes = fs.readFileSync("src/types/faq.ts", "utf8");

test("db schema adds faq_items level column and constraint", () => {
  assert.match(db, /ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS level SMALLINT DEFAULT 1/i);
  assert.match(db, /CHECK\s*\(level IN \(1,2\)\)/i);
});

test("DBFaqItem includes level field", () => {
  assert.match(db, /level:\s*1\s*\|\s*2;/);
});

test("rowToFaqItem maps level from DB row", () => {
  assert.match(db, /level:\s*\(row\.level as 1 \| 2\)\s*\?\?\s*1,/);
});

test("FAQItem type exposes optional level", () => {
  assert.match(faqTypes, /level\?:\s*1\s*\|\s*2;/);
});
