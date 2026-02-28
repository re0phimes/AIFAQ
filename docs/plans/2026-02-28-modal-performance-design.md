# Modal 性能优化设计

## 问题分析

从性能分析图看到：
- 点击打开 Modal 触发 2,274ms 的长任务
- 右侧有大量紫色 React 渲染块（20+ 个）
- 根本原因是 FAQList 重渲染导致所有 FAQItem 跟随重渲染

### 重渲染链条

```
点击 → setIsModalOpen(true)
    ↓
FAQList 状态变化 → 重新渲染
    ↓
创建新的 JSX: <FAQItem onToggle={() => ...} onOpenModal={() => ...} />
    ↓
箭头函数引用不同 → FAQItem props "变化"
    ↓
即使 memo 存在，props 变了 → 20 个 FAQItem 全部重渲染
    ↓
紫色渲染块 × 20 = 2,274ms 卡顿
```

## 优化方案

### 方案 A: 稳定化回调引用（局部优化）

**目标**：让 FAQItem 的 props 引用稳定，使 React.memo 真正生效

**策略**：
1. 使用 `useCallback` 缓存回调函数
2. 使用 `useRef` 存储可变状态，避免依赖项变化导致回调重建
3. FAQItem 通过 `itemId` 而非内联箭头函数与父组件通信

**代码模式**：
```typescript
// 使用 ref 绕过依赖检测，保持回调稳定
const itemsRef = useRef(items);
itemsRef.current = items;

const handleToggle = useCallback((id: number) => {
  const item = itemsRef.current.find(i => i.id === id);
  // ...
}, []); // 空依赖 = 永不重建
```

### 方案 B: 分离 Modal 状态（架构优化）

**目标**：Modal 打开不触发 FAQList 重渲染

**策略**：
1. 在 `app/page.tsx` 中管理 Modal 状态
2. FAQList 只通过回调通知（`onOpenItem: (item) => void`），不直接控制 Modal
3. DetailModal 作为 Page 的直属子组件，与 FAQList 同级

**组件层级**：
```
Page (app/page.tsx)
├── FAQList (列表状态：openItems, filters...)
└── DetailModal (独立状态)
```

**交互流程**：
```
点击 FAQItem → 调用 onOpenItem(item)
              → Page 更新 modalItem 状态
              → DetailModal 打开
              → FAQList 完全不参与，不重新渲染
```

## 预期效果

| 指标 | 优化前 | 优化后 (A+B) |
|------|--------|--------------|
| 点击响应时间 | 2,274ms | < 50ms |
| FAQList 重渲染 | 是 | 否 |
| FAQItem 重渲染 | 20+ 个 | 0 个 |
| Modal 打开 | 卡顿 | 流畅 |

## 兼容性

- 不影响现有功能
- 保持组件接口向后兼容
- 渐进式实施：可先实施 A，再实施 B

## 风险

- **低风险**：主要是代码结构调整，无业务逻辑变更
- **测试重点**：确保 Modal 打开/关闭、投票、展开收起功能正常
