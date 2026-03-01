# Profile 页面设置功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Profile 页面添加 Tab 切换（学习记录/设置），包含用户偏好设置，统一页面风格，并添加用户头像下拉菜单入口。

**Architecture:** ProfileClient 组件内部使用 `activeTab` 状态切换两个视图。设置项使用 localStorage 持久化。用户头像下拉菜单使用 FAQList 组件内的状态管理。

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, next-auth

---

## 前置检查

运行以下命令确保项目状态正常：

```bash
npm run build 2>&1 | head -30
```

Expected: 构建成功或只有与当前改动无关的错误。

---

## Task 1: 添加 i18n 翻译字段

**Files:**
- Modify: `lib/i18n.ts:66-68`

**Step 1: 添加新的翻译字段**

在 `labels` 对象中添加以下字段（在 `backButton` 后面）：

```typescript
settings: { zh: "设置", en: "Settings" },
accountInfo: { zh: "账号信息", en: "Account Info" },
preferences: { zh: "偏好设置", en: "Preferences" },
defaultPageSize: { zh: "默认每页数量", en: "Items per page" },
defaultViewMode: { zh: "默认视图模式", en: "Default view mode" },
```

**Step 2: 提交**

```bash
git add lib/i18n.ts
git commit -m "feat(i18n): add settings tab translations"
```

---

## Task 2: 修改 ProfileClient - 添加 Tab 导航

**Files:**
- Modify: `app/profile/ProfileClient.tsx`

**Step 1: 添加 activeTab 状态**

在 `ProfileClient` 组件内（第 30 行后）添加：

```typescript
const [activeTab, setActiveTab] = useState<'learning' | 'settings'>('learning');
```

**Step 2: 修改 Header 区域，添加 Tab 切换**

将原有的 Header 部分（第 49-53 行）改为：

```typescript
{/* Header with Tabs */}
<div className="flex items-center justify-between">
  <div>
    <h1 className="font-brand text-3xl font-bold text-text">AIFAQ</h1>
    <p className="mt-1 text-sm text-subtext">{t("trackProgress", lang)}</p>
  </div>
  <div className="flex gap-1">
    <button
      onClick={() => setActiveTab('learning')}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === 'learning'
          ? 'bg-primary text-white'
          : 'border-[0.5px] border-border text-subtext hover:bg-surface'
      }`}
    >
      {t("myLearning", lang)}
    </button>
    <button
      onClick={() => setActiveTab('settings')}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === 'settings'
          ? 'bg-primary text-white'
          : 'border-[0.5px] border-border text-subtext hover:bg-surface'
      }`}
    >
      {t("settings", lang)}
    </button>
  </div>
</div>
```

**Step 3: 条件渲染 Tab 内容**

将原有的内容区域（第 55-131 行）包裹在条件渲染中：

```typescript
{activeTab === 'learning' ? (
  <>
    {/* Stats Cards */}
    <div className="grid grid-cols-3 gap-4">
      {/* ... 保持原有代码不变 ... */}
    </div>

    {/* Stale Reminder */}
    {/* ... 保持原有代码不变 ... */}

    {/* Favorites List */}
    {/* ... 保持原有代码不变 ... */}
  </>
) : (
  <SettingsTab lang={lang} />
)}
```

**Step 4: 添加 SettingsTab 组件占位**

在文件末尾（FavoritesSection 之后）添加：

```typescript
interface SettingsTabProps {
  lang: "zh" | "en";
}

function SettingsTab({ lang }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <p className="text-subtext">Settings content coming soon...</p>
    </div>
  );
}
```

**Step 5: 验证构建**

```bash
npm run build 2>&1 | grep -E "(error|warn)" | head -10
```

Expected: 无错误，或只有与当前改动无关的警告。

**Step 6: 提交**

```bash
git add app/profile/ProfileClient.tsx
git commit -m "feat(profile): add tab navigation for learning and settings"
```

---

## Task 3: 实现 Settings Tab 内容

**Files:**
- Modify: `app/profile/ProfileClient.tsx`

**Step 1: 修改 SettingsTab 组件实现**

替换 Task 2 中的占位 SettingsTab：

```typescript
interface SettingsTabProps {
  lang: "zh" | "en";
  sessionUser?: { id?: string; name?: string | null; image?: string | null } | null;
}

function SettingsTab({ lang, sessionUser }: SettingsTabProps) {
  // Load settings from localStorage
  const [settings, setSettings] = useState({
    lang: (typeof window !== 'undefined' ? localStorage.getItem('aifaq-lang') : null) as "zh" | "en" || lang,
    pageSize: Number(typeof window !== 'undefined' ? localStorage.getItem('aifaq-pageSize') : null) || 20,
    defaultDetailed: (typeof window !== 'undefined' ? localStorage.getItem('aifaq-defaultDetailed') : null) === 'true',
  });

  const updateSetting = <K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(`aifaq-${key}`, String(value));
  };

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 font-brand text-lg font-semibold text-text">
          {t("accountInfo", lang)}
        </h2>
        <div className="flex items-center gap-4">
          {sessionUser?.image && (
            <img
              src={sessionUser.image}
              alt=""
              className="h-16 w-16 rounded-full"
            />
          )}
          <div>
            <div className="font-medium text-text">{sessionUser?.name || '-'}</div>
            <div className="text-sm text-subtext">ID: {sessionUser?.id?.slice(-8) || '-'}</div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 font-brand text-lg font-semibold text-text">
          {t("preferences", lang)}
        </h2>
        <div className="space-y-4">
          {/* Language */}
          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("language", lang) || "语言 / Language"}
            </label>
            <div className="flex gap-2">
              {(['zh', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => updateSetting('lang', l)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    settings.lang === l
                      ? 'bg-primary text-white'
                      : 'border-[0.5px] border-border text-subtext hover:bg-surface'
                  }`}
                >
                  {l === 'zh' ? '中文' : 'EN'}
                </button>
              ))}
            </div>
          </div>

          {/* Page Size */}
          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("defaultPageSize", lang)}
            </label>
            <div className="flex gap-2">
              {[10, 20, 50, 100].map((size) => (
                <button
                  key={size}
                  onClick={() => updateSetting('pageSize', size)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    settings.pageSize === size
                      ? 'bg-primary text-white'
                      : 'border-[0.5px] border-border text-subtext hover:bg-surface'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Default View Mode */}
          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("defaultViewMode", lang)}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateSetting('defaultDetailed', false)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  !settings.defaultDetailed
                    ? 'bg-primary text-white'
                    : 'border-[0.5px] border-border text-subtext hover:bg-surface'
                }`}
              >
                {t("brief", lang)}
              </button>
              <button
                onClick={() => updateSetting('defaultDetailed', true)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  settings.defaultDetailed
                    ? 'bg-primary text-white'
                    : 'border-[0.5px] border-border text-subtext hover:bg-surface'
                }`}
              >
                {t("detailed", lang)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 修改 SettingsTab 调用，传入 sessionUser**

找到 SettingsTab 的调用位置，改为：

```typescript
<SettingsTab lang={lang} sessionUser={session?.user} />
```

但 ProfileClient 目前没有 session prop，需要在下一步添加。

**Step 3: 添加 session prop 到 ProfileClient**

修改 ProfileClientProps：

```typescript
interface ProfileClientProps {
  favorites: FavoriteItem[];
  stats: Stats;
  lang: "zh" | "en";
  sessionUser?: { id?: string; name?: string | null; image?: string | null } | null;
}
```

修改函数签名：

```typescript
export default function ProfileClient({ favorites, stats, lang, sessionUser }: ProfileClientProps) {
```

**Step 4: 修改 page.tsx 传入 sessionUser**

在 `app/profile/page.tsx` 中：

```typescript
<ProfileClient
  favorites={data.favorites || []}
  stats={data.stats || { total: 0, unread: 0, learning: 0, mastered: 0, stale: 0 }}
  lang={lang}
  sessionUser={session?.user}
/>
```

**Step 5: 验证构建**

```bash
npm run build 2>&1 | grep -E "(error|warn)" | head -10
```

**Step 6: 提交**

```bash
git add app/profile/ProfileClient.tsx app/profile/page.tsx
git commit -m "feat(profile): implement settings tab with preferences"
```

---

## Task 4: FAQList 添加用户头像下拉菜单

**Files:**
- Modify: `components/FAQList.tsx:360-376`

**Step 1: 添加下拉菜单状态**

在 FAQList 组件内（第 76 行后）添加：

```typescript
const [showUserDropdown, setShowUserDropdown] = useState(false);
const userDropdownRef = useRef<HTMLDivElement>(null);
```

**Step 2: 添加点击外部关闭逻辑**

在 useEffect 区域添加（第 130 行后）：

```typescript
// Close dropdown when clicking outside
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
      setShowUserDropdown(false);
    }
  }
  if (showUserDropdown) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [showUserDropdown]);
```

**Step 3: 修改用户区域代码**

将原有用户区域代码（第 360-376 行）替换为：

```typescript
{session?.user ? (
  <div className="relative" ref={userDropdownRef}>
    <button
      onClick={() => setShowUserDropdown(!showUserDropdown)}
      className="flex items-center gap-2 rounded-full border-[0.5px] border-border px-3 py-1.5 hover:bg-surface"
    >
      {session.user.image && (
        <img src={session.user.image} alt="" className="h-6 w-6 rounded-full" />
      )}
      <span className="text-xs text-subtext">{session.user.name}</span>
      <svg
        className={`h-4 w-4 text-subtext transition-transform ${showUserDropdown ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {showUserDropdown && (
      <div className="absolute right-0 mt-2 w-40 rounded-lg border border-border bg-surface shadow-sm">
        <a
          href="/profile"
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-bg"
        >
          <span>👤</span>
          {t("myLearning", lang)}
        </a>
        <button
          onClick={() => {
            setShowUserDropdown(false);
            onSignOut?.();
          }}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-text hover:bg-bg"
        >
          <span>🚪</span>
          {t("logout", lang)}
        </button>
      </div>
    )}
  </div>
) : (
  // ... 保持原有的未登录按钮代码不变 ...
)}
```

**Step 4: 移除原有 "我的学习" 链接**

删除原有的 "我的学习" 链接代码（原第 370-375 行，现在应该已经不存在了）：

```typescript
{/* 删除这段 */}
<span className="h-4 border-l border-border" />
<a
  href="/profile"
  className="flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1.5 text-xs text-subtext hover:bg-surface"
>
  {t("myLearning", lang)}
</a>
```

**Step 5: 验证构建**

```bash
npm run build 2>&1 | grep -E "(error|warn)" | head -10
```

**Step 6: 提交**

```bash
git add components/FAQList.tsx
git commit -m "feat(header): add user avatar dropdown menu"
```

---

## Task 5: 统一 Profile 页面风格

**Files:**
- Modify: `app/profile/ProfileClient.tsx`

**Step 1: 检查并统一所有标题样式**

确保所有标题使用 `font-brand`：

- 页面主标题：`font-brand text-3xl font-bold text-text`
- 设置卡片标题：`font-brand text-lg font-semibold text-text`
- 收藏分区标题：已经是 `font-medium text-text`，保持即可

**Step 2: 检查卡片样式**

确保所有卡片使用统一的样式：
- `rounded-lg border border-border bg-surface`
- 内边距统一为 `p-4` 或 `p-6`

**Step 3: 检查按钮样式**

确保所有按钮使用胶囊样式：
- `rounded-full`
- active: `bg-primary text-white`
- inactive: `border-[0.5px] border-border text-subtext hover:bg-surface`

**Step 4: 验证视觉效果**

检查以下元素：
- [ ] 统计卡片样式正确
- [ ] 收藏分区折叠面板样式正确
- [ ] 设置 Tab 中的按钮样式正确
- [ ] 过期提醒警告框样式正确

**Step 5: 提交**

```bash
git add app/profile/ProfileClient.tsx
git commit -m "style(profile): unify page style with main page"
```

---

## Task 6: FAQList 读取用户偏好设置

**Files:**
- Modify: `components/FAQList.tsx:55-58`

**Step 1: 修改 pageSize 默认值读取逻辑**

将：

```typescript
function loadPageSize(): number {
  if (typeof window === "undefined") return 20;
  return Number(localStorage.getItem(LS_PAGESIZE)) || 20;
}
```

改为：

```typescript
function loadPageSize(): number {
  if (typeof window === "undefined") return 20;
  // 优先读取新的设置键，兼容旧键
  const newValue = localStorage.getItem("aifaq-pageSize");
  if (newValue) return Number(newValue);
  const oldValue = localStorage.getItem(LS_PAGESIZE);
  if (oldValue) return Number(oldValue);
  return 20;
}
```

**Step 2: 修改 globalDetailed 默认值读取逻辑**

在 `loadPageSize` 函数后添加：

```typescript
function loadDefaultDetailed(): boolean {
  if (typeof window === "undefined") return false;
  const value = localStorage.getItem("aifaq-defaultDetailed");
  return value === 'true';
}
```

**Step 3: 修改 initial state**

将第 72 行：

```typescript
const [globalDetailed, setGlobalDetailed] = useState(false);
```

改为：

```typescript
const [globalDetailed, setGlobalDetailed] = useState(loadDefaultDetailed);
```

**Step 4: 提交**

```bash
git add components/FAQList.tsx
git commit -m "feat: read user preferences from localStorage"
```

---

## Task 7: 最终验证

**Step 1: 构建验证**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` 或类似成功信息。

**Step 2: TypeScript 检查**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无错误输出。

**Step 3: 功能检查清单**

- [ ] Profile 页面显示 Tab（学习记录/设置）
- [ ] 点击 Settings Tab 显示设置内容
- [ ] 设置包含：账号信息、语言、每页数量、默认视图模式
- [ ] 修改设置后刷新页面保持设置
- [ ] 主页点击头像显示下拉菜单
- [ ] 下拉菜单包含 Profile 和 Logout
- [ ] Profile 页面风格与主页一致

**Step 4: 最终提交（如需要）**

```bash
git status
# 如有未提交更改：
git add .
git commit -m "feat: complete profile settings feature"
```

---

## 附录：关键文件路径

| 文件 | 作用 |
|------|------|
| `lib/i18n.ts` | 翻译字段 |
| `app/profile/ProfileClient.tsx` | Profile 页面主要组件 |
| `app/profile/page.tsx` | Profile 页面服务端组件 |
| `components/FAQList.tsx` | 主页列表组件（含 header） |

---

## 附录：相关技能

- @superpowers:subagent-driven-development - 使用此 skill 在当前会话执行任务
- @superpowers:executing-plans - 在新会话执行任务
