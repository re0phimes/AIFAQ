import { readFileSync } from "node:fs";

const scopeArg = process.argv.find((arg) => arg.startsWith("--scope="));
const scope = scopeArg ? scopeArg.split("=")[1] : "all";

const checks = {
  "outer-shell": [
    { file: "app/page.tsx", expected: "py-4 md:py-6" },
    { file: "app/profile/page.tsx", expected: "py-4 md:py-6" },
  ],
};

const selected = scope === "all" ? Object.values(checks).flat() : checks[scope] ?? [];
if (selected.length === 0) {
  console.error(`[check-compact-top] unknown scope: ${scope}`);
  process.exit(2);
}

const failures = [];
for (const c of selected) {
  const content = readFileSync(c.file, "utf8");
  if (!content.includes(c.expected)) {
    failures.push(`${c.file} missing: ${c.expected}`);
  }
}

if (failures.length > 0) {
  console.error("[check-compact-top] FAIL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log("[check-compact-top] PASS");
