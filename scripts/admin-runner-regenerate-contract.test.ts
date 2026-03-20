import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sanitizeModule = require("../lib/sanitize.ts") as
  | (typeof import("../lib/sanitize") & {
      default?: typeof import("../lib/sanitize");
    })
  | undefined;
const sanitizeRunnerCallbackPayload =
  sanitizeModule?.sanitizeRunnerCallbackPayload ??
  sanitizeModule?.default?.sanitizeRunnerCallbackPayload;

if (!sanitizeRunnerCallbackPayload) {
  throw new Error("Failed to load sanitizeRunnerCallbackPayload");
}

const faqRoutePath = path.join(process.cwd(), "app", "api", "admin", "faq", "[id]", "route.ts");
const dispatchRoutePath = path.join(
  process.cwd(),
  "app",
  "api",
  "admin",
  "tasks",
  "[id]",
  "dispatch",
  "route.ts"
);
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
const faqItemRoute = fs.readFileSync(faqRoutePath, "utf8");
const dbSource = fs.readFileSync(path.join(process.cwd(), "lib", "db.ts"), "utf8");
const dispatchSource = fs.readFileSync(path.join(process.cwd(), "lib", "admin-task-dispatch.ts"), "utf8");
const callbackSource = fs.readFileSync(callbackRoutePath, "utf8");

test("admin FAQ reject route reads structured reasons and note", () => {
  assert.match(faqItemRoute, /action === ["']reject["']/);
  assert.match(faqItemRoute, /reasons/);
  assert.match(faqItemRoute, /note/);
});

test("database layer defines reject events table", () => {
  assert.match(dbSource, /faq_reject_events/);
});

test("database layer defines admin tasks table", () => {
  assert.match(dbSource, /admin_tasks/);
});

test("dispatch route exists", () => {
  assert.equal(fs.existsSync(dispatchRoutePath), true);
});

test("callback route exists", () => {
  assert.equal(fs.existsSync(callbackRoutePath), true);
});

test("callback route sanitizes payloads before persistence", () => {
  assert.equal(fs.existsSync(callbackRoutePath), true);
  assert.match(callbackSource, /sanitize/);
});

test("callback route uses dedicated runner shared secret", () => {
  assert.equal(fs.existsSync(callbackRoutePath), true);
  assert.match(callbackSource, /RUNNER_SHARED_SECRET/);
});

test("dispatch helper reserves running before outbound dispatch and rolls back to pending on failure", () => {
  assert.match(dispatchSource, /transitionAdminTaskStatus\(task\.id, \["pending"\], "running"\)/);
  assert.match(dispatchSource, /await sendRunnerDispatch\(task\)/);
  assert.match(dispatchSource, /transitionAdminTaskStatus\(task\.id, \["running"\], "pending"/);
  assert.ok(
    dispatchSource.indexOf('transitionAdminTaskStatus(task.id, ["pending"], "running")') <
      dispatchSource.indexOf("await sendRunnerDispatch(task)")
  );
});

test("sanitize rejects malformed callback status instead of defaulting to success", () => {
  assert.deepEqual(sanitizeRunnerCallbackPayload({}), {
    ok: false,
    error: "Invalid callback status",
  });
});

test("sanitize requires answer for succeeded callback", () => {
  assert.deepEqual(
    sanitizeRunnerCallbackPayload({
      status: "succeeded",
      tags: ["rag"],
    }),
    {
      ok: false,
      error: "Succeeded callback must include answer",
    }
  );
});

test("sanitize keeps only valid reference and image shapes", () => {
  const result = sanitizeRunnerCallbackPayload({
    status: "succeeded",
    answer: "Updated answer",
    references: [
      { type: "paper", title: "Attention Is All You Need", url: "https://example.com/paper" },
      { type: "paper", url: "https://example.com/missing-title" },
      "bad",
    ],
    images: [
      { url: "https://example.com/figure.png", caption: "Figure 1", source: "paper" },
      { url: "https://example.com/invalid.png", source: "paper" },
      123,
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.result?.references, [
    {
      type: "paper",
      title: "Attention Is All You Need",
      url: "https://example.com/paper",
    },
  ]);
  assert.deepEqual(result.result?.images, [
    {
      url: "https://example.com/figure.png",
      caption: "Figure 1",
      source: "paper",
    },
  ]);
});

test("callback route only accepts running tasks", () => {
  assert.match(callbackSource, /task\.status !== "running"/);
});
