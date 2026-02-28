# FAQ 交互体验优化设计文档

**日期**: 2026-02-27  
**主题**: FAQ 页面 UX 优化 - Header 自动收起 + Modal 详情展示 + 表格样式修复

## 1. 问题背景

### 1.1 当前痛点

1. **双滚动条问题**：Tab 展开后内容区域有 `max-height: 60vh; overflow-y: auto`，与页面滚动条共存
2. **Header 占用空间**：顶部 SearchBar + TagFilter 区域在展开 FAQ 时仍占用大量垂直空间
3. **Markdown 表格样式错位**：表格渲染出现布局问题

### 1.2 使用场景

- 用户在页面顶部展开 FAQ 时，Header + 展开的 Tab 内容导致视口被严重挤压
- 长内容需要内部滚动，体验割裂

## 2. 设计方案

### 2.1 核心交互模式

| 全局模式 | 点击 FAQ 行为 | Tab 内显示 | 切换到详细 |
|---------|-------------|-----------|-----------|
| **Brief** | Tab 展开 | 精简内容 (Brief) | 点击"详细"→ 弹出 Modal |
| **Detailed** | 直接弹出 Modal | - | 已在 Modal 中 |

### 2.2 Header 自动收起

**触发条件**（满足任一）：
- 任意 FAQ Tab 展开
- Modal 处于打开状态

**恢复条件**：
- 所有 Tab 已收起
- Modal 已关闭
- 用户向上滚动页面（保留现有行为）

**实现方式**：
- 复用现有的 `headerVisible` state 控制
- 新增 `isAnyTabOpen` 或 `isModalOpen` 条件参与计算

### 2.3 Modal 设计

**内容范围**：
- 问题标题（中英文）
- 标签列表
- 详细答案（Markdown 渲染）
- 图片（如有）
- 引用列表
- 投票按钮

**关闭方式**：
- 点击遮罩层
- 点击关闭按钮
- ESC 键

**关闭后行为**：
- Modal 关闭后保持 Tab 展开状态（Brief 模式下）

### 2.4 全局模式切换行为调整

**Brief 模式**（默认）：
```
用户点击 FAQ → Tab 展开 → 显示 Brief 内容
                          ↓ 点击"详细"
                    Modal 弹出 → 显示完整内容
```

**Detailed 模式**：
```
用户点击 FAQ → Tab 收起（如有展开的其他 Tab）
            ↓
            Modal 直接弹出 → 显示完整内容
```

### 2.5 Markdown 表格样式修复

**问题**：当前表格样式错位

**解决方案**：
- 添加表格专用 CSS 样式
- 确保表格在 prose 内正确渲染
- 支持横向滚动（宽表格）

## 3. 组件变更

### 3.1 FAQList.tsx

**新增 State**：
- `isModalOpen: boolean`
- `modalItem: FAQItem | null`

**修改逻辑**：
- Header 可见性计算纳入 `openItems.size > 0 || isModalOpen`
- 根据 `globalDetailed` 决定点击行为

### 3.2 FAQItem.tsx

**修改**：
- Detailed 模式下的点击行为：触发 onOpenModal 而非本地展开
- Brief 模式保持不变

**新增 Props**：
- `onOpenModal?: () => void` - Detailed 模式下调用

### 3.3 新增 DetailModal.tsx

**Props**：
```typescript
interface DetailModalProps {
  item: FAQItemType | null;
  isOpen: boolean;
  onClose: () => void;
  lang: "zh" | "en";
  onVote: (type: VoteType, reason?: string, detail?: string) => void;
  onRevokeVote: () => void;
  currentVote: VoteType | null;
}
```

**特性**：
- 全屏/大窗口 Modal（桌面端 80vw/max-w-4xl，移动端全屏）
- 内部独立滚动
- 复用 FAQItem 内的投票组件

### 3.4 globals.css

**新增样式**：
- Markdown 表格样式
- Modal 动画
- 遮罩层样式

## 4. 技术实现要点

### 4.1 Header 可见性逻辑

```typescript
const shouldHideHeader = 
  openItems.size > 0 ||      // 有 Tab 展开
  isModalOpen ||              // Modal 打开
  (scrollY > lastScrollY && scrollY > 80);  // 向下滚动（现有逻辑）
```

### 4.2 点击行为分发

```typescript
function handleItemClick(item: FAQItemType) {
  if (globalDetailed) {
    // Detailed 模式：直接弹 Modal
    setModalItem(item);
    setIsModalOpen(true);
    // 可选：收起其他已展开的 Tab
    setOpenItems(new Set());
  } else {
    // Brief 模式：展开/收起 Tab
    toggleOpenItem(item.id);
  }
}
```

### 4.3 Modal 内容渲染

复用现有 ReactMarkdown 配置，确保与 FAQItem 内渲染一致：
- remark-math
- rehype-katex
- 自定义 prose 样式

## 5. 边界情况处理

| 场景 | 处理方案 |
|-----|---------|
| Modal 打开时切换全局模式 | Modal 保持打开，内容不变，关闭后新点击生效 |
| 切换页码时有展开的 Tab | 清空 openItems，确保分页后状态干净 |
| Modal 内点击相关 FAQ 链接 | 关闭当前 Modal，打开新的 Modal |
| 移动端横屏 | Modal 保持全屏，确保可阅读 |

## 6. 样式规范

### 6.1 Modal 尺寸

- **桌面端**: `max-w-4xl w-[90vw] max-h-[90vh]`
- **移动端**: `w-full h-full rounded-none`（全屏）

### 6.2 动画

- **Modal 进入**: `scale-95 opacity-0` → `scale-100 opacity-100` (200ms ease-out)
- **Modal 退出**: 反向动画 (150ms ease-in)
- **遮罩层**: `opacity-0` → `opacity-100` (200ms)

### 6.3 表格样式

```css
.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}
.prose th, .prose td {
  border: 1px solid var(--color-border);
  padding: 0.5em 0.75em;
  text-align: left;
}
.prose th {
  background: var(--color-surface);
  font-weight: 500;
}
```

## 7. 验证清单

- [ ] Brief 模式下点击 FAQ → Tab 展开显示 Brief
- [ ] Brief 模式下点击"详细"→ Modal 弹出
- [ ] Detailed 模式下点击 FAQ → 直接弹出 Modal
- [ ] Tab 展开时 Header 自动收起
- [ ] Modal 打开时 Header 自动收起
- [ ] Header 在滚动时正常恢复
- [ ] Markdown 表格正确显示
- [ ] Modal 内投票功能正常
- [ ] Modal 响应式适配
- [ ] ESC 键关闭 Modal
