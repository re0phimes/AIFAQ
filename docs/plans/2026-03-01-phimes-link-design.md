# 设计文档：AIFAQ 标题旁添加主站链接

**日期：** 2026-03-01
**状态：** 已批准

## 概述

在 AIFAQ 页面左上角的标题旁边添加一个徽章样式的链接，指向 phimes.top 主站。

## 需求

用户希望在 AIFAQ 标题附近提供一个到 phimes.top 网站的链接，但不希望 AIFAQ 标题本身变成链接。

## 设计方案

### 视觉设计

在 AIFAQ 标题右侧添加一个徽章样式的链接按钮：

**外观特征：**
- 圆角边框徽章（rounded-full）
- 边框样式：border-[0.5px] border-border（与现有登录按钮保持一致）
- 内边距：px-2.5 py-1
- 字号：text-xs
- 颜色：text-subtext，hover 时 bg-surface
- 内容：文字 "访问主站" + 小箭头图标 "↗"
- 间距：使用 ml-3 与 AIFAQ 标题保持适当距离

**布局示意：**
```
[AIFAQ] [访问主站 ↗]
AI/ML 常见问题知识库
```

### 技术实现

**修改文件：**
1. `components/FAQList.tsx` - 添加链接徽章
2. `lib/i18n.ts` - 添加国际化文本

**代码结构：**

在 FAQList.tsx 第 343 行附近，将原有的 `<h1>` 标签包装在 flex 容器中：

```tsx
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
```

**国际化支持：**

在 `lib/i18n.ts` 的 labels 对象中添加：

```typescript
visitMainSite: { zh: "访问主站", en: "Visit Main Site" },
```

### 安全性考虑

- 使用 `target="_blank"` 在新标签页打开链接
- 添加 `rel="noopener noreferrer"` 防止安全风险：
  - `noopener`：防止新页面访问 window.opener
  - `noreferrer`：不发送 referrer 信息

### 样式一致性

徽章样式与现有登录按钮保持一致：
- 相同的边框样式和圆角
- 相同的字号和颜色系统
- 相同的 hover 效果

## 影响范围

**修改文件：** 2 个
- `components/FAQList.tsx`
- `lib/i18n.ts`

**影响范围：** 最小化
- 仅在页面头部添加一个小的视觉元素
- 不影响现有功能
- 不改变页面布局结构

## 实施步骤

1. 在 `lib/i18n.ts` 中添加国际化文本
2. 修改 `components/FAQList.tsx` 中的标题部分
3. 测试中英文切换
4. 测试链接在新标签页打开
5. 验证样式在不同屏幕尺寸下的表现

## 验收标准

- [ ] "访问主站" 徽章显示在 AIFAQ 标题右侧
- [ ] 点击链接在新标签页打开 phimes.top
- [ ] 中英文切换正常工作
- [ ] 样式与现有设计保持一致
- [ ] hover 效果正常显示
