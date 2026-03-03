import { readFileSync } from "node:fs";

const scopeArg = process.argv.find((arg) => arg.startsWith("--scope="));
const scope = scopeArg ? scopeArg.split("=")[1] : "all";

const checks = {
  "outer-shell": [
    { file: "app/page.tsx", expected: "py-4 md:py-6" },
    { file: "app/profile/page.tsx", expected: "py-4 md:py-6" },
  ],
  "home-top": [
    {
      file: "components/FAQList.tsx",
      expected: "className={`sticky top-0 z-20 -mx-4 bg-bg/95 px-4 pb-2 backdrop-blur-sm",
    },
    {
      file: "components/FAQList.tsx",
      expected: "<header className=\"mb-2 flex items-center justify-between pt-1\">",
    },
    {
      file: "components/FAQList.tsx",
      expected: "<div className=\"flex items-center gap-2\">",
    },
    {
      file: "components/FAQList.tsx",
      expected: "<p className=\"mt-0.5 text-sm text-subtext\">",
    },
    {
      file: "components/FAQList.tsx",
      expected: "<div className=\"mt-2\">",
    },
    {
      file: "components/SearchBar.tsx",
      expected: "py-2.5 pl-12 pr-16 text-text placeholder-subtext",
    },
    {
      file: "components/TagFilter.tsx",
      expected: "<div className=\"rounded-xl border-[0.5px] border-border bg-panel p-2.5\">",
    },
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
