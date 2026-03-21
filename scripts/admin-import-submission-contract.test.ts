import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const importRoutePath = path.join(process.cwd(), "app", "api", "admin", "faq", "import", "route.ts");
const callbackRoutePath = path.join(
  process.cwd(),
  "app",
  "api",
  "admin",
  "tasks",
  "[id]",
  "callback",
  "route.ts"
);
const importRouteSource = fs.readFileSync(importRoutePath, "utf8");
const callbackRouteSource = fs.readFileSync(callbackRoutePath, "utf8");

const require = createRequire(import.meta.url);
const sanitizeModule = require("../lib/sanitize.ts") as
  | (typeof import("../lib/sanitize") & {
      default?: typeof import("../lib/sanitize");
    })
  | undefined;
const sanitizeDocumentRunnerCallbackPayload =
  sanitizeModule?.sanitizeDocumentRunnerCallbackPayload ??
  sanitizeModule?.default?.sanitizeDocumentRunnerCallbackPayload;

if (!sanitizeDocumentRunnerCallbackPayload) {
  throw new Error("Failed to load sanitizeDocumentRunnerCallbackPayload");
}

test("file import creates a document ingest task instead of local AI pipeline execution", () => {
  assert.match(importRouteSource, /createImportRecord/);
  assert.match(importRouteSource, /createAdminTask/);
  assert.match(importRouteSource, /dispatchAdminTask/);
  assert.doesNotMatch(importRouteSource, /parseFileToMarkdown/);
  assert.doesNotMatch(importRouteSource, /generateQAPairs/);
  assert.doesNotMatch(importRouteSource, /judgeQAPairs/);
  assert.doesNotMatch(importRouteSource, /analyzeFAQ/);
  assert.doesNotMatch(importRouteSource, /waitUntil/);
});

test("document callback updates import status and creates review items", () => {
  assert.match(callbackRouteSource, /submission_type === "document"/);
  assert.match(callbackRouteSource, /updateImportStatus/);
  assert.match(callbackRouteSource, /createFaqItem/);
});

test("document callback sanitizer requires items for success", () => {
  assert.deepEqual(
    sanitizeDocumentRunnerCallbackPayload({
      status: "succeeded",
    }),
    {
      ok: false,
      error: "Succeeded document callback must include items",
    }
  );
});
