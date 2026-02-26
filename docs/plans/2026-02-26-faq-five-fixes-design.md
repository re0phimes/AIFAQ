# FAQ 页面 5 项修复设计

日期: 2026-02-26

## 1. 标签过滤 bug 修复

**根因**: `faq.json` 中所有 81 条 FAQ 的 `categories` 字段为空数组。
`FAQList.tsx:144-148` 的分类过滤检查 `item.categories.includes(cat)`，
导致选任何分类都过滤掉全部内容。

**方案**: 从 `tag-taxonomy.json` 构建 `categoryName -> Set<tag>` 映射，
选中分类时检查 item.tags 是否与该分类的 tags 有交集。不再依赖 `item.categories`。

**影响**: `FAQList.tsx`

## 2. 行内公式 `$...$` 渲染修复

**现状**: KaTeX CSS 已导入，remarkMath + rehypeKatex 插件已配置。
数据中包含大量 `$...$` 行内公式（如 `$O(N^2)$`）。

**排查方向**:
- `remark-math` v6 是否需要显式 `singleDollarTextMath: true`
- Tailwind `prose` 样式是否覆盖 `.katex` inline 样式
- 插件版本兼容性

**影响**: `FAQItem.tsx`，可能涉及 `globals.css`

## 3. 参考来源默认展开

**现状**: `ReferenceList.tsx` 桌面端默认折叠 (`expanded = false`)，
只显示标题摘要。

**方案**: 将 `expanded` 默认值改为 `true`。
FAQ 展开时参考来源同步展开，用户可手动折叠。

**影响**: `ReferenceList.tsx`

## 4. 头部滚动隐藏/显示

**行为**: 向下滚动时，header（标题 + 搜索 + 标签）向上滑出视口；
向上滚动时滑回显示。类似 iOS 导航栏行为。

**实现**:
- 监听 `scroll` 事件，记录滚动方向
- header 区域使用 `position: sticky` + `transform: translateY()` + `transition`
- 向下滚动超过阈值时 `translateY(-100%)`，向上滚动时 `translateY(0)`

**影响**: `app/page.tsx`（header 包裹在 sticky 容器），
`FAQList.tsx`（搜索/标签区域的显隐控制）

## 5. "不准确"投票增加理由

**交互**:
- 点击"不准确"后，在按钮下方展开内联面板
- 预设选项: "事实错误"、"过时信息"、"表述不清"、"其他"
- 可选填写补充说明文本框
- 提交按钮发送投票 + 理由到后端

**数据变更**:
- `faq_votes` 表增加 `reason VARCHAR(50)` 和 `detail TEXT` 列
- `castVote` 函数接收 `reason` 和 `detail` 参数
- 投票 API 接收新字段

**影响**: `FAQItem.tsx`、`app/api/faq/[id]/vote/route.ts`、`lib/db.ts`、`FAQList.tsx`
