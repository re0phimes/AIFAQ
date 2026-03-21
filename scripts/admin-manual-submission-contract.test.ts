import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const adminFaqRoutePath = path.join(process.cwd(), "app", "api", "admin", "faq", "route.ts");
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

const adminFaqRouteSource = fs.readFileSync(adminFaqRoutePath, "utf8");
const callbackRouteSource = fs.readFileSync(callbackRoutePath, "utf8");

test("manual admin FAQ submission creates a task instead of running local AI", () => {
  assert.match(adminFaqRouteSource, /createAdminTask/);
  assert.match(adminFaqRouteSource, /dispatchAdminTask/);
  assert.doesNotMatch(adminFaqRouteSource, /analyzeFAQ/);
  assert.doesNotMatch(adminFaqRouteSource, /waitUntil/);
});

test("runner callback can create review items for ingest_submission qa tasks", () => {
  assert.match(callbackRouteSource, /task\.task_type === "ingest_submission"/);
  assert.match(callbackRouteSource, /createFaqItem/);
  assert.match(callbackRouteSource, /submission_type/);
});
