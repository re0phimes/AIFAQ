# AIFAQ 主站链接徽章 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 AIFAQ 标题旁边添加一个徽章样式的链接，指向 phimes.top 主站

**Architecture:** 在现有的 FAQList 组件头部添加一个链接徽章，使用与登录按钮一致的样式系统。支持中英文国际化。

**Tech Stack:** React, TypeScript, Tailwind CSS, Next.js

---

## Task 1: 添加国际化文本

**Files:**
- Modify: `lib/i18n.ts:53` (在 updated 行之后添加)

**Step 1: 读取当前 i18n 文件**

Run: 查看 lib/i18n.ts 第 50-55 行
Expected: 看到 labels 对象中的现有条目

**Step 2: 添加 visitMainSite 翻译**

在 `lib/i18n.ts` 的 labels 对象中，在 `updated` 行之后添加：

```typescript
  updated: { zh: "30天内有更新", en: "Updated within 30 days" },
  visitMainSite: { zh: "访问主站", en: "Visit Main Site" },
  viewHistory: { zh: "查看历史版本", en: "View answer history" },
```

**Step 3: 验证语法**

Run: `npm run build` 或检查 TypeScript 编译
Expected: 无错误

**Step 4: Commit**

```bash
git add lib/i18n.ts
git commit -m "feat(i18n): add visitMainSite label for main site link"
```

---

## Task 2: 修改 FAQList 组件添加链接徽章

**Files:**
- Modify: `components/FAQList.tsx:342-346`

**Step 1: 读取当前头部结构**

Run: 查看 components/FAQList.tsx 第 340-350 行
Expected: 看到当前的 header 结构，包含 `<h1>AIFAQ</h1>` 和副标题

**Step 2: 修改标题结构添加链接徽章**

将第 342-346 行的代码从：

```tsx
          <div>
            <h1 className="font-brand text-3xl font-bold text-text">AIFAQ</h1>
            <p className="mt-1 text-sm text-subtext">
              {lang === "zh" ? "AI/ML 常见问题知识库" : "AI/ML FAQ Knowledge Base"}
            </p>
          </div>
```

修改为：

```tsx
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-brand text-3xl font-bold text-text">AIFAQ</h1>
              <a
                href="https://phimes.top"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full border-[0.5px] border-border px-2.5 py-1 text-xs text-subtext hover:bg-surface transition-colors"
              >
                {t("visitMainSite", lang)}
                <span className="text-[10px]">↗</span>
              </a>
            </div>
            <p className="mt-1 text-sm text-subtext">
              {lang === "zh" ? "AI/ML 常见问题知识库" : "AI/ML FAQ Knowledge Base"}
            </p>
          </div>
```

**Step 3: 验证编译**

Run: `npm run build` 或 `npm run dev`
Expected: 无 TypeScript 或编译错误

**Step 4: Commit**

```bash
git add components/FAQList.tsx
git commit -m "feat(ui): add main site link badge next to AIFAQ title"
```

---

## Task 3: 手动测试验证

**Step 1: 启动开发服务器**

Run: `npm run dev`
Expected: 服务器在 http://localhost:3000 启动

**Step 2: 测试中文界面**

1. 打开浏览器访问 http://localhost:3000
2. 确保语言设置为中文
3. 验证：
   - "访问主站" 徽章显示在 AIFAQ 标题右侧
   - 徽章样式与登录按钮一致（圆角边框、相同字号）
   - hover 时背景变化正常

**Step 3: 测试英文界面**

1. 点击 EN 按钮切换到英文
2. 验证：
   - 徽章文字变为 "Visit Main Site"
   - 其他样式保持不变

**Step 4: 测试链接功能**

1. 点击 "访问主站" 徽章
2. 验证：
   - 在新标签页打开 https://phimes.top
   - 原页面保持不变

**Step 5: 测试响应式布局**

1. 调整浏览器窗口大小
2. 验证徽章在不同屏幕尺寸下显示正常

---

## Task 4: 最终验证和清理

**Step 1: 运行完整构建**

Run: `npm run build`
Expected: 构建成功，无错误或警告

**Step 2: 检查验收标准**

验证所有验收标准：
- [x] "访问主站" 徽章显示在 AIFAQ 标题右侧
- [x] 点击链接在新标签页打开 phimes.top
- [x] 中英文切换正常工作
- [x] 样式与现有设计保持一致
- [x] hover 效果正常显示

**Step 3: 最终 commit（如有需要）**

如果有任何调整或修复：

```bash
git add .
git commit -m "fix: minor adjustments to main site link badge"
```

---

## 完成标准

- 所有 commits 已完成
- 手动测试通过所有验收标准
- 构建成功无错误
- 代码符合现有代码风格

## 预计时间

总计：15-20 分钟
- Task 1: 3 分钟
- Task 2: 5 分钟
- Task 3: 7 分钟
- Task 4: 3 分钟
