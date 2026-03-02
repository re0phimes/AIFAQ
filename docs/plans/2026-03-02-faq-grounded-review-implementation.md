# FAQ Grounded Review Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现一个可执行的 FAQ 生成流水线，支持文本问题和图片提问，联网验证后将结果写入 Neon 并进入 `review` 审核队列。

**Architecture:** 在 `tools/faq-sync` 下新增独立 CLI 脚本 `answer-and-stage.ts`，复用 `lib/ocr.ts` 与 `lib/db.ts`。流水线按“问题采集 -> 草稿生成 -> 证据检索与校验 -> 入库 review”执行，并输出每题中间结果到 `data/faq-sync/grounded/`。

**Tech Stack:** TypeScript, tsx, Next.js server utilities, @vercel/postgres, OpenAI-compatible chat/completions API

---

### Task 1: Create Skill Definition For Grounded FAQ Flow

**Files:**
- Create: `C:/Users/re0ph/.codex/skills/faq-grounded-review/SKILL.md`

**Step 1: Write the failing trigger check**

Run: `Get-Item 'C:/Users/re0ph/.codex/skills/faq-grounded-review/SKILL.md'`
Expected: file not found error

**Step 2: Write minimal skill content**

```markdown
---
name: faq-grounded-review
description: Use when generating FAQ answers from text questions or image-extracted questions, and when web-grounding with paper-first evidence plus staging into a human review queue is required.
---

# FAQ Grounded Review

1. Collect questions from text or OCR image extraction.
2. Generate a baseline answer for each question.
3. Retrieve sources from the web with strict ranking:
   - paper > expert blog > general blog
4. Validate baseline answer against evidence, revise final answer.
5. Stage to DB with status `review`; never auto-publish.
6. Include references in output and mark low-evidence items for manual verification.
```

**Step 3: Verify file exists and metadata is readable**

Run: `Get-Content 'C:/Users/re0ph/.codex/skills/faq-grounded-review/SKILL.md'`
Expected: frontmatter with `name` and `description`, plus 6-step body

**Step 4: Commit**

```bash
git -C C:/Users/re0ph add ../.codex/skills/faq-grounded-review/SKILL.md
git -C C:/Users/re0ph commit -m "feat(skill): add faq-grounded-review skill"
```

### Task 2: Add Reusable Grounding Helper Module

**Files:**
- Create: `tools/faq-sync/grounding.ts`
- Test: `tools/faq-sync/grounding.smoke.ts`

**Step 1: Write failing smoke test first**

```ts
import { rankSources } from "./grounding";

const ranked = rankSources([
  { title: "Blog", url: "https://someblog.dev/post", type: "blog" },
  { title: "arXiv", url: "https://arxiv.org/abs/1706.03762", type: "paper" }
]);

if (ranked[0].url !== "https://arxiv.org/abs/1706.03762") {
  throw new Error("paper source should rank first");
}
```

**Step 2: Run smoke test to verify it fails**

Run: `npx tsx tools/faq-sync/grounding.smoke.ts`
Expected: module not found error for `./grounding`

**Step 3: Implement minimal grounding helper**

```ts
export interface GroundingSource {
  type: "paper" | "blog" | "other";
  title: string;
  url: string;
}

export function sourcePriority(source: GroundingSource): number {
  const u = source.url.toLowerCase();
  if (source.type === "paper" || u.includes("arxiv.org") || u.includes("openreview.net")) return 0;
  if (source.type === "blog") return 1;
  return 2;
}

export function rankSources(sources: GroundingSource[]): GroundingSource[] {
  return [...sources].sort((a, b) => sourcePriority(a) - sourcePriority(b));
}

export function computeEvidenceFlags(sources: GroundingSource[]): {
  sourceCount: number;
  hasPaper: boolean;
  needsManualVerification: boolean;
} {
  const sourceCount = sources.length;
  const hasPaper = sources.some((s) => sourcePriority(s) === 0);
  return {
    sourceCount,
    hasPaper,
    needsManualVerification: sourceCount < 2 || !hasPaper,
  };
}
```

**Step 4: Run smoke test to verify it passes**

Run: `npx tsx tools/faq-sync/grounding.smoke.ts`
Expected: no output and exit code 0

**Step 5: Commit**

```bash
git add tools/faq-sync/grounding.ts tools/faq-sync/grounding.smoke.ts
git commit -m "feat(faq-sync): add grounding source ranking helpers"
```

### Task 3: Implement Question Intake (Text + Image OCR)

**Files:**
- Create: `tools/faq-sync/question-intake.ts`
- Test: `tools/faq-sync/question-intake.smoke.ts`

**Step 1: Write failing smoke test**

```ts
import { normalizeQuestions } from "./question-intake";

const questions = normalizeQuestions(["  什么是Transformer  ", "", "什么是Transformer"]);
if (questions.length !== 1) {
  throw new Error("normalizeQuestions should dedupe and drop empties");
}
```

**Step 2: Run smoke test to verify it fails**

Run: `npx tsx tools/faq-sync/question-intake.smoke.ts`
Expected: module not found error for `./question-intake`

**Step 3: Implement minimal intake helpers**

```ts
import * as fs from "fs";
import { parseFileToMarkdown } from "../../lib/ocr";

export function normalizeQuestions(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const q = raw.trim();
    if (!q) continue;
    if (seen.has(q)) continue;
    seen.add(q);
    out.push(q);
  }
  return out;
}

export function readQuestionsFile(filePath: string): string[] {
  const txt = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".json")) {
    const arr = JSON.parse(txt) as unknown[];
    return normalizeQuestions(arr.filter((x): x is string => typeof x === "string"));
  }
  return normalizeQuestions(txt.split(/\r?\n/));
}

export async function extractQuestionsFromImages(imagePaths: string[]): Promise<string[]> {
  const qs: string[] = [];
  for (const p of imagePaths) {
    const buf = fs.readFileSync(p);
    const ext = p.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const md = await parseFileToMarkdown(buf, p, mime);
    for (const line of md.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      if (t.endsWith("？") || t.endsWith("?")) qs.push(t);
    }
  }
  return normalizeQuestions(qs);
}
```

**Step 4: Run smoke test to verify it passes**

Run: `npx tsx tools/faq-sync/question-intake.smoke.ts`
Expected: no output and exit code 0

**Step 5: Commit**

```bash
git add tools/faq-sync/question-intake.ts tools/faq-sync/question-intake.smoke.ts
git commit -m "feat(faq-sync): add question intake for text and image OCR"
```

### Task 4: Build Main Pipeline Script answer-and-stage.ts

**Files:**
- Create: `tools/faq-sync/answer-and-stage.ts`
- Modify: `package.json`

**Step 1: Write failing CLI run check**

Run: `npx tsx -r ./scripts/env-loader.js tools/faq-sync/answer-and-stage.ts --help`
Expected: file not found error

**Step 2: Implement minimal CLI skeleton with argument parsing**

```ts
interface Options {
  question?: string;
  questionsFile?: string;
  images: string[];
  max?: number;
  dryRun: boolean;
}
```

Implement:
1. `parseArgs()` for `--question`, `--questions-file`, `--images`, `--max`, `--dry-run`
2. validation: at least one input source is required
3. `printHelp()` with examples

**Step 3: Implement pipeline core**

Add functions:
1. `collectQuestions(opts)` using `normalizeQuestions`, `readQuestionsFile`, `extractQuestionsFromImages`
2. `generateDraftAnswer(question)` via `AI_API_BASE_URL/chat/completions`
3. `retrieveEvidence(question, draft)` via model prompt returning `sources[]`
4. `reviseWithEvidence(question, draft, sources)` returning final answer + notes
5. `stageToReview(question, draft, finalPayload)`:
   - `createFaqItem(question, draft)`
   - `updateFaqStatus(id, "review", { answer, answer_brief, answer_en, answer_brief_en, question_en, tags, categories, references })`

Use `computeEvidenceFlags` and append verification note in answer body when `needsManualVerification` is true.

**Step 4: Add dry-run artifact writing**

Write each item JSON to:
- `data/faq-sync/grounded/<timestamp>-<index>.json`
- errors to `data/faq-sync/grounded/_errors.json`

For `--dry-run`, skip DB write and print summary only.

**Step 5: Register npm script**

In `package.json`, add:

```json
"faq:answer-and-stage": "npx tsx -r ./scripts/env-loader.js tools/faq-sync/answer-and-stage.ts"
```

**Step 6: Run script smoke checks**

Run: `npm run faq:answer-and-stage -- --help`
Expected: usage/help output

Run: `npm run faq:answer-and-stage -- --question "什么是Transformer中的自注意力？" --max 1 --dry-run`
Expected: one grounded artifact JSON generated in `data/faq-sync/grounded/`

**Step 7: Commit**

```bash
git add tools/faq-sync/answer-and-stage.ts package.json
git commit -m "feat(faq-sync): add grounded answer-and-stage pipeline"
```

### Task 5: Add Operator Documentation

**Files:**
- Create: `tools/faq-sync/GROUNDED-WORKFLOW.md`
- Modify: `tools/faq-sync/README.md`

**Step 1: Write doc for commands and guardrails**

Include:
1. text input mode examples
2. image input mode examples
3. source priority rule (paper > expert blog > other)
4. manual review rule (`status=review` only)
5. dry-run vs write mode

**Step 2: Link new command in existing README**

Add command snippet under faq-sync command list:

```bash
npm run faq:answer-and-stage -- --question "..." --dry-run
```

**Step 3: Verify docs match actual command signatures**

Run: `npm run faq:answer-and-stage -- --help`
Expected: help flags exactly match docs

**Step 4: Commit**

```bash
git add tools/faq-sync/GROUNDED-WORKFLOW.md tools/faq-sync/README.md
git commit -m "docs(faq-sync): document grounded review workflow"
```

### Task 6: Final Verification Before Completion

**Files:**
- Verify only

**Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0

**Step 2: Lint changed files**

Run: `npm run lint -- tools/faq-sync/answer-and-stage.ts tools/faq-sync/grounding.ts tools/faq-sync/question-intake.ts`
Expected: no lint errors

**Step 3: End-to-end dry-run with mixed inputs**

Run:

```bash
npm run faq:answer-and-stage -- --questions-file data/sample-questions.txt --images data/samples/sample1.png --max 3 --dry-run
```

Expected:
1. At most 3 items processed
2. `data/faq-sync/grounded/` has output JSON files
3. `_errors.json` exists only if any item failed

**Step 4: End-to-end write mode**

Run:

```bash
npm run faq:answer-and-stage -- --question "LoRA 的 rank 对显存和效果有什么影响？" --max 1
```

Expected:
1. New row created in `faq_items`
2. Row status is `review`
3. references is non-empty JSON

**Step 5: Final commit**

```bash
git add tools/faq-sync package.json
git commit -m "feat: ship grounded faq generation pipeline to review queue"
```

## Verification Checklist

- [ ] Skill file exists and is discoverable by name `faq-grounded-review`
- [ ] `npm run faq:answer-and-stage -- --help` works
- [ ] Text and image inputs both produce questions
- [ ] Paper-first source ranking logic is enforced
- [ ] Items without paper evidence are flagged for manual verification
- [ ] Non-dry-run path writes to Neon with `status=review`
- [ ] Dry-run path writes artifacts without DB mutation

## Environment Variables

- `AI_API_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `MISTRAL_API_KEY` (required when using image OCR)
- `POSTGRES_URL` / Vercel Postgres environment variables used by `@vercel/postgres`
