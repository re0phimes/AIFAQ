# AIFAQ 样式重设计 — alphaxiv 风格靠拢

## 目标

将 AIFAQ 中间内容区域的视觉风格全面向 alphaxiv.org 靠拢，
实现现代、干净、产品化的设计语言。左侧导航不在本次范围内。

## 设计决策

### 1. 配色系统

| Token | 旧值 | 新值 | 用途 |
|-------|------|------|------|
| `--color-bg` | `#FAF9F6` | `#FFFFFF` | 页面背景 |
| `--color-text` | `#1A1A2E` | `#171717` | 主文字 |
| `--color-primary` | `#C45D3E` | `#9a2036` | 强调色 |
| `--color-primary-hover` | `#D4785F` | `#6b1626` | hover |
| `--color-subtext` | `#64748B` | `#737373` | 次要文字 |
| `--color-surface` | `#F1F0EB` | `#F5F5F5` | 表面/代码背景 |
| `--color-border` | Tailwind gray-200 | `#E5E5E5` | 边框 |
| `--color-panel` | white/60 | `#FFFFFF` | 卡片面板 |

废弃旧 token: warm-white, deep-ink, copper, copper-light,
slate-secondary, code-bg。

### 2. 字体

```
--font-brand: "Rubik", sans-serif       → 标题 "AIFAQ"、品牌元素
--font-sans:  "Noto Sans SC", sans-serif → 正文、UI 文字
--font-mono:  "JetBrains Mono", monospace → 代码
```

去掉 Noto Serif SC，标题改用 Rubik。

### 3. 卡片 (FAQItem)

```
容器:  rounded-xl border-[0.5px] border-border bg-panel
hover: shadow-md transition-all backdrop-blur-sm
展开:  border-primary/30 shadow-sm
选中:  border-primary/20 bg-primary/5
```

- 极细边框 (0.5px) 是 alphaxiv 标志性风格
- rounded-xl 替代 rounded-lg
- 去掉 bg-white/60 半透明

### 4. 按钮

工具栏按钮:
```
rounded-full border-[0.5px] border-border px-3 py-1.5 text-xs
hover:   bg-surface text-text
激活态:  bg-primary text-white
```

投票按钮:
```
rounded-full pill 风格
有用激活: bg-green-50 text-green-700
反馈激活: bg-red-50 text-red-600
```

### 5. 标签 pill

```
border-[0.5px] border-border bg-panel px-1.5 py-0.5
text-xs font-medium text-primary
```

### 6. 搜索框

```
rounded-full border-[0.5px] border-border
focus: border-primary outline-none
```

### 7. 间距

- 卡片间: space-y-3
- 卡片内 padding: px-4 py-3

## 影响范围

- `app/globals.css` — 设计 token 全部替换
- `app/layout.tsx` — 加载 Rubik 字体
- `components/FAQItem.tsx` — 卡片样式
- `components/FAQList.tsx` — 工具栏按钮、布局间距
- `components/SearchBar.tsx` — 搜索框样式
- `components/TagFilter.tsx` — 标签样式
- `components/Pagination.tsx` — 分页器样式
- `components/BackToTop.tsx` — 浮动按钮样式
- `components/SelectionSidebar.tsx` — 侧边栏样式
- `components/ReadingView.tsx` — 阅读视图样式
- `components/ReferenceList.tsx` — 参考来源样式

## 不变的部分

- 功能逻辑完全不动
- 左侧导航不在范围内 (项目目前也没有)
- Markdown 渲染、KaTeX 数学公式支持不变
- 投票系统、搜索、筛选、分页逻辑不变
