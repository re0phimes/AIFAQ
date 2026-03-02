# Toast 撤销机制与 Modal 收藏按钮设计文档

**日期**: 2026-03-02
**主题**: 添加 Toast 组件、收藏撤销机制、DetailModal 收藏按钮

---

## 设计原则

- **禁止弹窗**: 未登录用户点击收藏按钮只震动，不使用 alert/confirm
- **Toast 自动消失**: 5秒后自动关闭，无需用户点击
- **视觉反馈**: 待移除项变灰提示，可撤销恢复

---

## 1. Toast 组件

**文件**: `components/Toast.tsx`

### Props 接口

```typescript
interface ToastProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose: () => void;
  duration?: number; // 默认 5000ms
}
```

### 视觉设计

- 位置: 屏幕底部中央固定
- 背景: `bg-gray-900/90` 半透明深色
- 文字: 白色
- 操作按钮: 带下划线样式，琥珀色高亮
- 动画: 淡入淡出

### 行为

- 显示后自动倒计时
- 点击操作按钮后立即关闭
- 超时后触发 onClose 回调

---

## 2. Profile 页面撤销机制

### 状态管理

```typescript
const [pendingRemovals, setPendingRemovals] = useState<Set<number>>(new Set());
const [toast, setToast] = useState<ToastState | null>(null);
```

### 取消收藏流程

1. **点击取消收藏**
   - 标记为 pending removal（UI 变灰/半透明）
   - 显示 Toast: "已取消收藏" + "撤销"按钮

2. **撤销操作**
   - 点击 Toast 的"撤销"
   - 移除 pending 标记，恢复卡片正常显示
   - 关闭 Toast

3. **超时未撤销**
   - Toast 自动关闭
   - 真正从列表移除
   - 更新 stats

### 卡片视觉状态

- **正常**: `bg-panel opacity-100`
- **待移除**: `bg-panel opacity-50 grayscale` 变灰半透明

---

## 3. DetailModal 收藏按钮

### 新增 Props

```typescript
interface DetailModalProps {
  // ... 现有 props
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  isAuthenticated?: boolean;
}
```

### 按钮位置

Footer 右侧，与投票按钮分开：

```
┌─────────────────────────────────────────────────────────┐
│  [有用 ↑] [反馈 ↓]                      [收藏 ☆]        │
│  [有用 ↑] [反馈 ↓]                      [已收藏 ★]      │
└─────────────────────────────────────────────────────────┘
```

### 未登录行为

- **只震动**: `navigator.vibrate(50)`
- **无弹窗**: 不使用 alert/confirm
- **Hover 提示**: title="登录后收藏"（原生 tooltip，非弹窗）

---

## 4. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/Toast.tsx` | 新建 | Toast 通知组件 |
| `app/profile/ProfileClient.tsx` | 修改 | 添加撤销逻辑、pending 状态、Toast |
| `components/DetailModal.tsx` | 修改 | 添加收藏按钮和 props |
| `app/FAQPage.tsx` | 修改 | 传递收藏相关 props 给 DetailModal |
| `lib/i18n.ts` | 修改 | 添加翻译 |

---

## 5. 新增翻译

```typescript
removedFromFavorites: { zh: "已取消收藏", en: "Removed from favorites" },
undo: { zh: "撤销", en: "Undo" },
loginToFavorite: { zh: "登录后收藏", en: "Sign in to favorite" },
```

---

## 6. 实现顺序

1. 创建 Toast 组件
2. 修改 ProfileClient 添加撤销机制
3. 修改 DetailModal 添加收藏按钮
4. 修改 FAQPage 传递 props
5. 添加翻译
6. 构建测试
