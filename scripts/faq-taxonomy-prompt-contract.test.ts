import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("AI analysis prompt asks for new taxonomy fields", () => {
  const source = fs.readFileSync("lib/ai.ts", "utf8");

  assert.equal(source.includes("primary_category"), true);
  assert.equal(source.includes("secondary_category"), true);
  assert.equal(source.includes("patterns"), false);
  assert.equal(source.includes("topics"), true);
  assert.equal(source.includes("tool_stack"), true);
  assert.equal(source.includes("categories:"), false);
});

test("import pipeline prompt asks for new taxonomy fields", () => {
  const source = fs.readFileSync("lib/import-pipeline.ts", "utf8");

  assert.equal(source.includes("primary_category"), true);
  assert.equal(source.includes("secondary_category"), true);
  assert.equal(source.includes("patterns"), false);
  assert.equal(source.includes("topics"), true);
  assert.equal(source.includes("tool_stack"), true);
  assert.equal(source.includes("categories (1-2个分类)"), false);
});

test("admin routes persist new taxonomy fields", () => {
  const createRoute = fs.readFileSync("app/api/admin/faq/route.ts", "utf8");
  const itemRoute = fs.readFileSync("app/api/admin/faq/[id]/route.ts", "utf8");
  const importRoute = fs.readFileSync("app/api/admin/faq/import/route.ts", "utf8");

  for (const source of [createRoute, itemRoute, importRoute]) {
    assert.equal(source.includes("primary_category"), true);
    assert.equal(source.includes("secondary_category"), true);
    assert.equal(source.includes("patterns"), false);
    assert.equal(source.includes("topics"), true);
    assert.equal(source.includes("tool_stack"), true);
  }
});
