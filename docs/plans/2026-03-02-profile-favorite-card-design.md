# Profile FavoriteCard 设计文档

**日期**: 2026-03-02
**主题**: 统一 Profile 收藏卡片与主页风格

---

## 问题分析

### 当前 Profile 收藏卡片的问题

1. **样式不一致**
   - 主页: `rounded-xl border-[0.5px] bg-panel`
   - Profile: `rounded-lg border bg-surface`

2. **缺少 ID 展示**
   - 主页有显眼的 `font-brand text-xl font-bold text-primary` ID
   - Profile 只有纯文字链接

3. **缺少收藏功能**
   - Profile 只能"标记为已内化"
   - 不能取消收藏（应该可以）

4. **标题布局问题**
   - 状态标签（圆点+文字）和数量不在同一行
   - 看起来杂乱

---

## 设计方案

### 新组件: FavoriteCard

位置: `components/FavoriteCard.tsx`

#### Props 接口

```typescript
interface FavoriteCardProps {
  item: {
    faq_id: number;
    faq: FAQItem;
    learning_status: 'unread' | 'learning' | 'mastered';
  };
  lang: "zh" | "en";
  onUpdateStatus: (faqId: number, status: 'learning' | 'mastered') => void;
  onToggleFavorite: (faqId: number) => void;
  showMasterButton?: boolean;
}
```

#### 视觉设计

**整体容器** (与 FAQItem 一致):
```
rounded-xl border-[0.5px] border-border bg-panel
hover:border-primary/20 transition-all duration-200
```

**布局结构**:
```
┌─────────────────────────────────────────────────────────┐
│  [ID]  [问题标题]                              [收藏★]  │
│  42    什么是 Transformer 的注意力机制?                 │
├─────────────────────────────────────────────────────────┤
│  [标签] [标签]                                   [操作]  │
│  #transformer #attention                       [已内化] │
└─────────────────────────────────────────────────────────┘
```

**具体样式**:
- ID: `font-brand text-xl font-bold text-primary` (与主页一致)
- 标题: `text-sm font-medium leading-snug text-text`
- 标签: `rounded-full border-[0.5px] border-border bg-panel px-1.5 py-0.5 text-xs font-medium text-primary`
- 状态徽章: 显示在标题下方，如"学习中"、"已内化"
- 收藏按钮: 右侧，可点击取消收藏

#### 状态徽章设计

位置: 标题下方，标签上方

```
[灰色圆点] 未看    [蓝色圆点] 学习中    [绿色圆点] 已内化
```

样式:
```css
/* 未看 */
<span class="inline-flex items-center gap-1.5 text-xs text-subtext">
  <span class="h-1.5 w-1.5 rounded-full bg-gray-400" />
  未看
</span>

/* 学习中 */
<span class="inline-flex items-center gap-1.5 text-xs text-blue-600">
  <span class="h-1.5 w-1.5 rounded-full bg-blue-500" />
  学习中
</span>

/* 已内化 */
<span class="inline-flex items-center gap-1.5 text-xs text-green-600">
  <span class="h-1.5 w-1.5 rounded-full bg-green-500" />
  已内化
</span>
```

#### 操作按钮

**收藏按钮** (右侧):
```
已收藏 ★  (amber 色，点击取消)
```

**标记为已内化按钮** (仅在学习中状态):
```
标记已内化 →
```

---

## ProfileClient 改造

### 统计卡片样式统一

当前: `rounded-lg border border-border bg-surface p-4`

改为: `rounded-xl border-[0.5px] border-border bg-panel p-4`

与主页卡片一致。

### 收藏列表改造

移除 `FavoritesSection` 组件中的简单列表渲染，改用 `FavoriteCard`。

---

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/FavoriteCard.tsx` | 创建 | 新的收藏卡片组件 |
| `app/profile/ProfileClient.tsx` | 修改 | 使用 FavoriteCard，统一统计卡片样式 |

---

## 预期效果

1. Profile 收藏卡片与主页 FAQItem 风格一致
2. 可以取消收藏
3. 状态徽章清晰展示
4. ID 数字醒目
5. 标签 pills 与主页一致
