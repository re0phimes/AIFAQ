import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const authSource = fs.readFileSync("lib/auth.ts", "utf8");
const envExample = fs.readFileSync(".env.example", "utf8");

const adminRouteFiles = [
  "app/api/admin/faq/route.ts",
  "app/api/admin/faq/[id]/route.ts",
  "app/api/admin/faq/import/route.ts",
  "app/api/admin/faq/import/[id]/route.ts",
  "app/api/admin/users/[id]/route.ts",
] as const;

test("verifyAdmin accepts request input for unified route auth", () => {
  assert.match(authSource, /export\s+async\s+function\s+verifyAdmin\s*\(\s*request\??\s*:\s*NextRequest/);
});

test("verifyAdmin inspects Authorization header and Bearer token", () => {
  assert.match(authSource, /headers\.get\(["']authorization["']\)/i);
  assert.match(authSource, /Bearer/i);
});

test("verifyAdmin uses fixed-time comparison for API keys", () => {
  assert.match(authSource, /timingSafeEqual/);
});

test("verifyAdmin keeps wrong Authorization from falling back to session", () => {
  assert.match(authSource, /if\s*\(\s*authHeader\s*\)/);
  assert.match(authSource, /return\s+false/);
});

test(".env.example declares ADMIN_API_KEY", () => {
  assert.match(envExample, /^ADMIN_API_KEY=/m);
});

for (const routePath of adminRouteFiles) {
  test(`${routePath} uses verifyAdmin(request)`, () => {
    const source = fs.readFileSync(routePath, "utf8");
    assert.match(source, /verifyAdmin\s*\(\s*request\s*\)/);
  });
}
