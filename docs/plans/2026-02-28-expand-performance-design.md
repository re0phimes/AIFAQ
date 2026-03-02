# 详细模式全部展开性能优化设计

日期: 2026-02-28

## 问题

`handleExpandAll` 不区分 brief/detailed 模式，在 detailed 模式下 50 个 item 全部同步渲染完整 markdown + KaTeX 导致严重卡顿。

## 方案: 禁用 detailed 全部展开 + brief 懒渲染 (D)

### 1. 行为变更

**detailed 模式:**
- "全部展开"按钮 → disabled（灰色 + tooltip "详细模式下请逐个查看"）
- "全部收起"保持可用
- 单击 item → 打开弹窗（不变）

**brief 模式:**
- "全部展开/收起"行为不变
- 渲染策略改为懒渲染

**pageSize 50 保留**，配合懒渲染无性能问题。

### 2. Brief 模式懒渲染

- FAQItem answer 区域外层加 `ref`，用 `IntersectionObserver` 检测可见性
- `rootMargin: "200px"` 提前 200px 开始渲染，减少滚动闪烁
- `once` 模式：渲染过就保持，避免来回滚动反复渲染/销毁
- `isOpen && isVisible` → 渲染 MarkdownContent
- `isOpen && !isVisible` → 骨架屏占位（min-height: 120px + 淡灰背景）

同一时刻只有可视区域附近 5-8 个 item 渲染 markdown，其余为轻量 DOM。

### 3. 影响范围

仅修改两个文件:

1. **`components/FAQList.tsx`**
   - `handleExpandAll`: globalDetailed 为 true 时不执行
   - 工具栏"全部展开"按钮: detailed 模式下 disabled + tooltip

2. **`components/FAQItem.tsx`**
   - answer 内容区域加 IntersectionObserver
   - isOpen && !isVisible → 骨架屏
   - isOpen && isVisible (once) → MarkdownContent

不新建文件，不改 MarkdownContent / DetailModal。
