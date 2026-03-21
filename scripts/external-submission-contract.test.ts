import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const routePath = path.join(
  process.cwd(),
  "app",
  "api",
  "external",
  "submissions",
  "route.ts"
);
const typesPath = path.join(process.cwd(), "lib", "external-submission-types.ts");
const envExamplePath = path.join(process.cwd(), ".env.example");

test("external submission route exists", () => {
  assert.equal(fs.existsSync(routePath), true);
});

test("external submission route uses a dedicated ingestion API key", () => {
  const routeSource = fs.readFileSync(routePath, "utf8");
  const envExample = fs.readFileSync(envExamplePath, "utf8");

  assert.match(routeSource, /EXTERNAL_SUBMISSION_API_KEY/);
  assert.match(envExample, /^EXTERNAL_SUBMISSION_API_KEY=/m);
});

test("external submission route creates admin tasks instead of running local AI analysis", () => {
  const routeSource = fs.readFileSync(routePath, "utf8");

  assert.match(routeSource, /createAdminTask/);
  assert.doesNotMatch(routeSource, /analyzeFAQ/);
  assert.doesNotMatch(routeSource, /parseFileToMarkdown/);
});

test("external submission types include qa and document", () => {
  const typeSource = fs.readFileSync(typesPath, "utf8");

  assert.match(typeSource, /EXTERNAL_SUBMISSION_TYPE_VALUES\s*=\s*\["qa", "document"\]/);
});
