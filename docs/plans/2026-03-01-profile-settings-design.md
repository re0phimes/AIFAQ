# Profile 页面设置功能设计文档

**日期**: 2026-03-01
**作者**: Claude Code
**状态**: 已批准，待实现

---

## 1. 背景

当前 Profile 页面仅展示用户的学习记录（收藏列表和学习进度统计）。用户希望在 Profile 页面增加设置功能，并通过 Tab 切换。同时需要统一 Profile 页面与主页的风格。

---

## 2. 目标

1. Profile 页面添加 Tab 导航，支持"学习记录"和"设置"切换
2. 设置 Tab 包含：账号信息、语言偏好、默认每页数量、默认展开模式
3. 主页用户头像改为下拉菜单，包含 Profile 和 Logout 选项
4. Profile 页面风格与主页保持一致

---

## 3. 设计详情

### 3.1 Tab 导航

位置：Profile 页面标题下方

样式：
- 使用胶囊式按钮（`rounded-full`）
- active 状态：`bg-primary text-white`
- inactive 状态：`border-[0.5px] border-border text-subtext hover:bg-surface`
- 切换动画：无（即时切换）

Tab 选项：
- 📚 学习记录 / My Learning
- ⚙️ 设置 / Settings

### 3.2 学习记录 Tab

保留现有内容：
- 页面标题 + 副标题
- 统计卡片（总收藏、学习中、已内化）
- 过期提醒（如有）
- 收藏列表（按状态分组）

### 3.3 设置 Tab

**账号信息卡片**
```
┌─────────────────────────────────┐
│  账号信息                        │
│                                 │
│  [ 头像 ]                       │
│  GitHub 用户名                   │
│  ID: xxx                        │
└─────────────────────────────────┘
```
- 卡片样式：`rounded-lg border border-border bg-surface p-4`

**偏好设置**
- **语言**：中文 / EN 切换按钮组
- **默认每页数量**：10 / 20 / 50 / 100 单选
- **默认展开模式**：精简 / 详细 切换

控件样式：
- 选项按钮：`rounded-full px-3 py-1.5 text-xs`
- 选中状态：`bg-primary text-white`
- 未选中状态：`border-[0.5px] border-border text-subtext hover:bg-surface`

### 3.4 用户头像下拉菜单

触发方式：点击头像

菜单内容：
- 👤 我的学习 / My Learning → 跳转 /profile
- 🚪 登出 / Logout → 调用 signOut()

菜单样式：
- `absolute right-0 mt-2 w-40`
- `rounded-lg border border-border bg-surface shadow-sm`
- 菜单项：`px-4 py-2 text-sm hover:bg-bg cursor-pointer`
- 分隔线：可选

交互细节：
- 点击外部关闭
- 点击菜单项后关闭
- Escape 键关闭

### 3.5 风格统一

Profile 页面需要调整以匹配主页风格：

| 元素 | 主页样式 | Profile 需调整 |
|------|----------|----------------|
| 标题 | `font-brand text-3xl font-bold text-text` | 应用相同样式 |
| 卡片 | `rounded-lg border border-border bg-surface` | 保持一致 |
| 按钮 | `rounded-full border-[0.5px] border-border` | 保持一致 |
| 副标题 | `text-sm text-subtext` | 保持一致 |
| 容器 | `mx-auto max-w-2xl px-4 py-6 md:max-w-4xl md:px-8 md:py-8` | 保持一致 |

---

## 4. 数据结构

### 新增类型

```typescript
interface UserSettings {
  lang: "zh" | "en";
  pageSize: number;
  defaultDetailed: boolean;
}
```

### i18n 新增字段

```typescript
settings: { zh: "设置", en: "Settings" }
accountInfo: { zh: "账号信息", en: "Account Info" }
preferences: { zh: "偏好设置", en: "Preferences" }
defaultPageSize: { zh: "默认每页数量", en: "Items per page" }
defaultViewMode: { zh: "默认视图模式", en: "Default view mode" }
```

---

## 5. 状态管理

设置项存储：
- 语言：`localStorage` + cookie（已有）
- 每页数量：`localStorage`
- 默认展开模式：`localStorage`

加载优先级：
1. 从 `localStorage` 读取
2. 若无，使用默认值

---

## 6. 交互流程

### 切换 Tab

1. 用户点击 Settings Tab
2. `activeTab` 状态变为 `"settings"`
3. 显示设置内容
4. URL 不变

### 修改设置

1. 用户点击选项（如语言切换为 EN）
2. 立即更新 `localStorage`
3. 界面语言实时更新
4. 下次访问时生效

### 打开下拉菜单

1. 用户点击头像
2. `showDropdown` 设为 `true`
3. 显示下拉菜单
4. 点击外部或菜单项后关闭

---

## 7. 边界情况

- **未登录访问 /profile**：重定向到首页（已有逻辑）
- **设置保存失败**：静默失败，使用内存中的值
- **localStorage 不可用**：使用默认值，不报错

---

## 8. 依赖

- 现有 `lib/i18n.ts` - 需要添加新翻译字段
- 现有 `components/FAQList.tsx` - 需要添加 localStorage 读取逻辑
- 现有 `app/profile/ProfileClient.tsx` - 主要修改目标

---

## 9. 验收标准

- [ ] Profile 页面有 Tab 切换（学习记录 / 设置）
- [ ] Settings Tab 包含：账号信息、语言、每页数量、默认视图模式
- [ ] 设置更改后保存到 localStorage
- [ ] 主页点击头像显示下拉菜单（Profile / Logout）
- [ ] Profile 页面风格与主页一致
- [ ] 所有文本支持中英文
