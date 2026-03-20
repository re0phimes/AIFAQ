# TODO Prioritization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the project task source-of-truth docs so they expose one approved overall TODO list ordered by dependency and infrastructure priority, while keeping next-phase work explicitly separated.

**Architecture:** Treat `Claude.md` as the canonical task source and `todo.md` as the execution-facing mirror. Update the canonical order first, then reshape the execution view to match it, and finish with text-level verification that both files describe the same sequencing and stage split.

**Tech Stack:** Markdown, PowerShell, `rg`, git

---

### Task 1: Update the Canonical TODO Ordering in `Claude.md`

**Files:**
- Modify: `Claude.md`

**Step 1: Inspect the current canonical TODO block**

Run:

```powershell
rg -n "## 当前重点 TODO|## 备注|微信小程序|手机端" Claude.md
```

Expected: the current file shows the existing TODO list, does not yet include the approved mobile adaptation item, and does not yet split next-phase WeChat work cleanly.

**Step 2: Rewrite the canonical task list**

Update `Claude.md` so it contains:

- one ordered overall TODO sequence
- current-stage items in the approved order:
  - `Admin API Key` 统一鉴权
  - Agent 触发与执行隔离
  - Admin Review 退回自动重生成
  - 后台批量 API（一期）
  - 历史信息查看
  - 开源脱敏（严格模式）
  - 相似问题识别（BERT，两段式）
  - 手机端查看自适应
  - 平台接入范围（一期）
- one next-phase item:
  - 微信小程序支持

Make sure the mobile item explicitly mentions:
- direct expand
- modal
- no experience-breaking horizontal scrollbar

Make sure the WeChat item explicitly mentions:
- shared backend database
- Vercel Postgres free-tier quota risk assessment

**Step 3: Verify the canonical text**

Run:

```powershell
Get-Content Claude.md
```

Expected: the canonical doc shows the approved order and a clear next-phase section.

**Step 4: Commit**

```bash
git add Claude.md
git commit -m "docs: reorder canonical project todo"
```

### Task 2: Reshape `todo.md` Into the Execution View of the Same Ordered List

**Files:**
- Modify: `todo.md`

**Step 1: Inspect the current execution-view structure**

Run:

```powershell
rg -n "## 当前迭代|## 规则|微信|手机端|状态约定" todo.md
```

Expected: the file still reflects the older discussion grouping and does not yet match the approved full ordering.

**Step 2: Rewrite the execution-facing TODO**

Update `todo.md` so it:

- keeps the existing rules and status conventions
- adds an `整体 TODO（排序版）` section
- mirrors the same ordering as `Claude.md`
- marks the current-stage items as `todo`
- places the WeChat mini-program item under a next-phase subsection

For the mobile item, include the same scope:
- direct expand
- modal
- eliminate user-visible horizontal overflow problems

For the WeChat item, include the same next-phase prep notes:
- share backend database
- assess Vercel Postgres free-tier quota risk

**Step 3: Verify the execution-view text**

Run:

```powershell
Get-Content todo.md
```

Expected: `todo.md` becomes a clean execution mirror of the canonical sequence and preserves status-oriented wording.

**Step 4: Commit**

```bash
git add todo.md
git commit -m "docs: align execution todo with canonical order"
```

### Task 3: Cross-check Both Docs for Structural Consistency

**Files:**
- Modify only if inconsistencies are found: `Claude.md`, `todo.md`

**Step 1: Compare key headings and item markers**

Run:

```powershell
rg -n "Admin API Key|Agent 触发|自动重生成|批量 API|历史信息查看|开源脱敏|相似问题识别|手机端查看自适应|平台接入范围|微信小程序" Claude.md todo.md
```

Expected: every approved item appears in both files, with WeChat clearly separated as next-phase work.

**Step 2: Review the git diff**

Run:

```powershell
git diff -- Claude.md todo.md
```

Expected: only task-ordering and wording updates appear, with no unrelated content regression.

**Step 3: Commit final consistency fix if needed**

```bash
git add Claude.md todo.md
git commit -m "docs: sync canonical and execution todo views"
```

Only do this step if Task 3 required additional edits beyond the prior commits.

### Task 4: Final Verification

**Files:**
- No new files required unless wording fixes are found

**Step 1: Confirm working tree state**

Run:

```powershell
git status --short
```

Expected: only unrelated pre-existing files remain untracked or modified.

**Step 2: Confirm the new task order is readable end-to-end**

Run:

```powershell
Get-Content Claude.md
Get-Content todo.md
```

Expected:

- one stable overall ordering
- current-phase and next-phase clearly separated
- mobile adaptation included in current-phase
- WeChat mini-program support excluded from current-phase

**Step 3: Final delivery**

Report:

- updated canonical ordering
- updated execution-view ordering
- any pre-existing unrelated worktree changes left untouched
