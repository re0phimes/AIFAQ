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
  "profile-top": [
    {
      file: "app/profile/ProfileClient.tsx",
      expected: "return (\n    <div className=\"space-y-4\">",
    },
    {
      file: "app/profile/ProfileClient.tsx",
      expected: "<div className=\"flex items-center gap-2\">",
    },
    {
      file: "app/profile/ProfileClient.tsx",
      expected: "<p className=\"mt-0.5 text-xs text-subtext\">",
    },
    {
      file: "app/profile/ProfileClient.tsx",
      expected: "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
    },
    {
      file: "app/profile/ProfileClient.tsx",
      expected: "<div className=\"grid grid-cols-3 gap-3\">",
    },
    {
      file: "app/profile/ProfileClient.tsx",
      expected: "className=\"rounded-xl border-[0.5px] border-border bg-panel p-3\"",
    },
    {
      file: "app/profile/ProfileClient.tsx",
      expected: "className=\"flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3\"",
    },
  ],
  "home-pagination": [
    {
      file: "components/FAQList.tsx",
      expected: "if (typeof window === \"undefined\") return 10;",
    },
    {
      file: "components/FAQList.tsx",
      expected: "const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;",
    },
    {
      file: "components/FAQList.tsx",
      expected: "window.scrollTo({ top: 0 });",
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
