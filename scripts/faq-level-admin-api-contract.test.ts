import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adminFaqRoute = fs.readFileSync("app/api/admin/faq/[id]/route.ts", "utf8");

test("admin faq patch route supports set_level action", () => {
  assert.match(adminFaqRoute, /action === ["']set_level["']/);
  assert.match(adminFaqRoute, /updateFaqLevel\(/);
});

test("set_level validates level values and returns bad request on invalid input", () => {
  assert.match(adminFaqRoute, /!\[1,\s*2\]\.includes\(body\.level\)/);
  assert.match(adminFaqRoute, /status:\s*400/);
});
