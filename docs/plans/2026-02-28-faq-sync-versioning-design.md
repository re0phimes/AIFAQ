# FAQ 同步工作流 + 答案版本化设计

## 背景

FAQ 数据目前是单向流动：本地生成 → 推送到 Vercel Postgres。缺少从数据库回溯、评估、修改、再推送的闭环。同时用户投票数据（upvote/downvote）提供了质量信号，但没有机制利用这些信号驱动内容优化。

## 目标

1. 建立双向同步机制：DB ↔ 本地 JSON 文件
2. 答案版本化：每次更新保留历史，投票绑定版本
3. 利用 faq-judge / faq-generator skills 在本地评估和改进内容
4. Premium 用户可查看历史版本，Free 用户引导升级

## 一、数据库变更

### 新表 `faq_versions`

```sql
CREATE TABLE IF NOT EXISTS faq_versions (
  id SERIAL PRIMARY KEY,
  faq_id INTEGER NOT NULL REFERENCES faq_items(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  answer TEXT NOT NULL,
  answer_brief TEXT,
  answer_en TEXT,
  answer_brief_en TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faq_id, version)
);
CREATE INDEX idx_faq_versions_faq_id ON faq_versions(faq_id);
```

### `faq_votes` 表变更

```sql
ALTER TABLE faq_votes ADD COLUMN version_id INTEGER REFERENCES faq_versions(id);
```

- 新投票自动关联当前版本的 `version_id`
- 旧投票 `version_id` 为 NULL，视为初始版本（version=1）

### `faq_items` 表变更

```sql
ALTER TABLE faq_items ADD COLUMN current_version INTEGER DEFAULT 1;
ALTER TABLE faq_items ADD COLUMN last_updated_at TIMESTAMPTZ;
```

- `current_version`：当前版本号，每次答案更新 +1
- `last_updated_at`：最近一次答案更新时间（用于 30 天标记）

### 用户 tier 扩展

NextAuth JWT token 和 session 中增加 `tier` 字段：

```typescript
// types/next-auth.d.ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "user";
      tier: "free" | "premium";  // 新增
    } & DefaultSession["user"];
  }
}
```

Admin 通过后台设置用户 tier（暂不做自助付费）。需要新增 `users` 表或在现有结构中持久化 tier 信息。

## 二、本地同步工具

### 目录结构

```
tools/faq-sync/
  pull.ts        # 从 DB 导出到本地 JSON
  push.ts        # 检测变更推回 DB，自动创建版本
  evaluate.ts    # 批量调用 faq-judge 评分
  README.md      # 工作流说明文档

data/faq-sync/   # 导出的 FAQ 数据（gitignore）
  42.json
  108.json
  ...
```

### pull.ts

从 Vercel Postgres 导出 FAQ 到 `data/faq-sync/` 目录。

参数：
- `--all` — 全量导出
- `--flagged` — 只导出 downvote 超过阈值的（阈值可配置，默认 downvote > upvote）
- `--ids 42,108` — 手动指定 ID
- `--status review|published` — 按状态筛选

单条 JSON 结构：

```json
{
  "id": 42,
  "question": "对 LLaMA-7B 使用 LoRA（rank=16）进行 SFT，显存占用大约多少？",
  "question_en": "...",
  "answer": "...",
  "answer_brief": "...",
  "answer_en": "...",
  "answer_brief_en": "...",
  "tags": ["LoRA", "显存"],
  "categories": ["训练优化"],
  "references": [],
  "images": [],
  "difficulty": "intermediate",
  "status": "published",
  "current_version": 3,
  "votes_summary": { "up": 15, "down": 3 },
  "downvote_reasons": { "outdated": 2, "unclear": 1 },
  "_pulled_at": "2026-02-28T12:00:00Z"
}
```

### push.ts

读取 `data/faq-sync/*.json`，对比 DB 中当前 answer，推送变更。

逻辑：
1. 读取本地 JSON 文件
2. 对比 DB 中当前 `answer` 字段
3. 有变更的：
   - 将 DB 中旧答案插入 `faq_versions`（version = current_version）
   - 更新 `faq_items` 为新内容
   - `current_version++`，更新 `last_updated_at`
4. 无变更的：跳过
5. 输出变更报告

### evaluate.ts

批量评估 `data/faq-sync/` 下的 JSON 文件。

逻辑：
1. 读取所有 JSON 文件
2. 对每条 QA 调用 AI API（按 faq-judge skill 的评分标准）
3. 输出评估报告到 `data/faq-sync/_report.json`
4. 标记不达标的条目

## 三、Skills 增强

### faq-judge 增加批量模式

支持指定 `data/faq-sync/` 目录，自动读取所有 JSON 文件，按 10 维度评分，输出汇总报告。标记哪些需要修改。

### faq-generator 增加改写模式

新增"改写"能力：读取一条现有 QA + judge 的改进建议，输出改进后的版本，直接写回对应的 JSON 文件。

## 四、前端功能

### 30 天更新标记

- 条件：`last_updated_at` 距今 ≤ 30 天 且 `current_version > 1`
- 所有用户可见，标题旁显示小标记

### 版本历史交互

| 用户类型 | 行为 |
|---------|------|
| Free 用户 | 看到"查看历史版本"按钮，点击弹窗提示"升级 Premium 解锁历史版本" |
| Premium 用户 | 点击后内联版本选择器，切换版本查看内容 + 该版本投票数据 |
| Admin | 后台完整版本列表 + 每版本投票分布 + downvote 原因统计 |

### 投票显示

- 默认显示当前版本的投票数
- Premium 切换到旧版本时，显示该版本的投票数
- 版本更新后，新投票绑定新版本，旧投票保留在旧版本

## 五、API 变更

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/faq/[id]/versions` | Premium / Admin | 获取版本列表 |
| GET | `/api/faq/[id]/versions/[version]` | Premium / Admin | 获取特定版本内容 + 投票数据 |
| PATCH | `/api/admin/faq/[id]` | Admin | 更新答案时自动创建版本记录 |

## 六、完整工作流

```
1. pull:     npx tsx tools/faq-sync/pull.ts --flagged
2. evaluate: 在 Claude Code 中 /faq-judge 批量评估
3. rewrite:  在 Claude Code 中 /faq-generator 改写不达标条目
4. push:     npx tsx tools/faq-sync/push.ts
```

详细操作说明见 `tools/faq-sync/README.md`。
