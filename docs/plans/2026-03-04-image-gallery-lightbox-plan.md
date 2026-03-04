# Image Gallery and Lightbox Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有回答图片展示从纵向列表升级为统一的 gallery + lightbox 交互，覆盖 FAQItem、DetailModal、ReadingView、FavoriteCard，并实现 lightbox 边界振动。

**Architecture:** 新增两个可复用组件：`ImageGallery`（内联横向浏览）和 `ImageLightbox`（放大浏览层）。所有业务容器仅维护 lightbox 开关和当前索引。交互输入统一收敛为按钮/键盘/触摸手势，边界振动仅在 lightbox 发生。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4 token classes, node:test + tsx, ESLint

---

### Task 1: 建立 gallery/lightbox 交互契约测试（先红）

**Files:**
- Create: `scripts/image-gallery-contract.test.ts`
- Test: `scripts/image-gallery-contract.test.ts`

**Step 1: Write the failing test**

创建静态契约测试，断言以下目标（先失败）：

1. `components/ImageGallery.tsx` 文件存在并包含关键类名/交互 token：
- 桌面 3 列相关 token（如 `md:basis-1/3`）
- 移动单图相关 token（如 `basis-full`）
- hover 抬升 token（如 `hover:scale-`、`hover:shadow-`）

2. `components/ImageLightbox.tsx` 文件存在并包含：
- 键盘事件处理（`ArrowLeft`/`ArrowRight`/`Escape`）
- 触摸事件处理（`onTouchStart`/`onTouchMove`/`onTouchEnd`）
- 缩略图条渲染逻辑
- `navigator.vibrate` 分支

**Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/image-gallery-contract.test.ts`

Expected: FAIL（新组件尚不存在）。

**Step 3: Commit red test (optional but recommended)**

```bash
git add scripts/image-gallery-contract.test.ts
git commit -m "test: add image gallery and lightbox interaction contract"
```

### Task 2: 新增 `ImageGallery` 组件（最小可用）

**Files:**
- Create: `components/ImageGallery.tsx`
- Modify: `src/types/faq.ts` (仅在需要新增 type alias 时)
- Test: `scripts/image-gallery-contract.test.ts`

**Step 1: Write minimal implementation**

实现 `ImageGallery`：

- props:

```ts
interface ImageGalleryProps {
  images: FAQImage[];
  lang: "zh" | "en";
  onOpen: (index: number) => void;
  className?: string;
}
```

- 渲染策略：
  - 外层横向滚动容器 + `snap-x snap-mandatory`
  - item: `basis-full md:basis-1/3`
  - hover: `hover:scale-[1.02]` + `hover:shadow-*`

- 每张图包含：缩略图 + caption + source 标签。
- 点击卡片触发 `onOpen(index)`。

**Step 2: Run contract test**

Run: `npx tsx --test scripts/image-gallery-contract.test.ts`

Expected: 仍 FAIL（lightbox 条件尚未满足）。

**Step 3: Run lint for new file**

Run: `npx eslint components/ImageGallery.tsx`

Expected: PASS。

**Step 4: Commit**

```bash
git add components/ImageGallery.tsx
git commit -m "feat(ui): add reusable inline image gallery component"
```

### Task 3: 新增 `ImageLightbox` 组件（导航 + 震动 + 缩略图）

**Files:**
- Create: `components/ImageLightbox.tsx`
- Test: `scripts/image-gallery-contract.test.ts`

**Step 1: Write minimal implementation**

实现 `ImageLightbox`：

- props:

```ts
interface ImageLightboxProps {
  isOpen: boolean;
  images: FAQImage[];
  initialIndex: number;
  lang: "zh" | "en";
  onClose: () => void;
}
```

- 必要行为：
  - 打开时初始化 `currentIndex`
  - 按钮切换 prev/next
  - `keydown`:
    - `ArrowLeft` -> prev
    - `ArrowRight` -> next
    - `Escape` -> close
  - touch swipe:
    - 记录 startX
    - end 时按阈值切换
  - 边界振动：
    - 在 prev at 0 / next at last 时触发 `navigator.vibrate(...)`
    - 增加轻量 cooldown（如 200ms）
  - 底部缩略图条：点击跳转到指定 index

**Step 2: Run contract test to verify pass**

Run: `npx tsx --test scripts/image-gallery-contract.test.ts`

Expected: PASS。

**Step 3: Run lint**

Run: `npx eslint components/ImageLightbox.tsx`

Expected: PASS。

**Step 4: Commit**

```bash
git add components/ImageLightbox.tsx scripts/image-gallery-contract.test.ts
git commit -m "feat(ui): add image lightbox with keyboard touch and boundary haptics"
```

### Task 4: 接入 `FAQItem` 与 `DetailModal`

**Files:**
- Modify: `components/FAQItem.tsx`
- Modify: `components/DetailModal.tsx`
- Test: `scripts/image-gallery-contract.test.ts`

**Step 1: FAQItem integration**

- 替换现有 `detailed && item.images` 的纵向 `<figure>` map。
- 新增局部 state：
  - `isLightboxOpen`
  - `lightboxIndex`
- 接入：
  - `<ImageGallery images={...} onOpen={(idx) => { setLightboxIndex(idx); setIsLightboxOpen(true); }} />`
  - `<ImageLightbox ... />`

**Step 2: DetailModal integration**

- 替换 modal 内容区的纵向图片列表为 `ImageGallery`。
- 在 `DetailModal` 内维护同样 lightbox state。

**Step 3: Run targeted checks**

Run:

```bash
npx eslint components/FAQItem.tsx components/DetailModal.tsx
npx tsx --test scripts/image-gallery-contract.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add components/FAQItem.tsx components/DetailModal.tsx
git commit -m "feat(ui): integrate gallery and lightbox into FAQ item and detail modal"
```

### Task 5: 接入 `ReadingView` 与 `FavoriteCard`

**Files:**
- Modify: `components/ReadingView.tsx`
- Modify: `components/FavoriteCard.tsx`

**Step 1: ReadingView integration**

- 在 `isDetailed(item.id)` 分支中替换纵向图片列表。
- 保持现有 `print:hidden` 语义。

**Step 2: FavoriteCard integration**

- 在 expanded 区域替换纵向图片列表。
- 保持卡片展开/折叠逻辑不变。

**Step 3: Run targeted checks**

Run:

```bash
npx eslint components/ReadingView.tsx components/FavoriteCard.tsx
npx tsx --test scripts/image-gallery-contract.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add components/ReadingView.tsx components/FavoriteCard.tsx
git commit -m "feat(ui): roll out gallery and lightbox to reading view and favorite card"
```

### Task 6: 补充 i18n 文案与可访问性细节

**Files:**
- Modify: `lib/i18n.ts`
- Modify: `components/ImageGallery.tsx`
- Modify: `components/ImageLightbox.tsx`

**Step 1: Add required labels**

新增 key（zh/en）：

- `imageGallery`
- `openImage`
- `prevImage`
- `nextImage`
- `closeLightbox`
- `imageThumbnail`
- `imageLoadFailed` (如需要)

**Step 2: Wire aria labels**

- 按钮和缩略图带可读 `aria-label`
- 当前缩略图带选中态（可用 `aria-current`）

**Step 3: Run checks**

Run:

```bash
npx eslint lib/i18n.ts components/ImageGallery.tsx components/ImageLightbox.tsx
npx tsx --test scripts/image-gallery-contract.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add lib/i18n.ts components/ImageGallery.tsx components/ImageLightbox.tsx
git commit -m "feat(ui): add gallery/lightbox i18n labels and a11y wiring"
```

### Task 7: 最终回归与验证

**Files:**
- Verify only (no mandatory edit)

**Step 1: Static verification**

Run:

```bash
npx tsx --test scripts/image-gallery-contract.test.ts
npm run lint
npm run build
```

Expected: PASS（允许仓库既有 warning，但不得新增 error）。

**Step 2: Manual QA checklist**

Run: `npm run dev`

Manual scenarios:

1. FAQItem: desktop 3-up, mobile 1-up, hover 抬升。
2. DetailModal: 点击图进 lightbox，按钮/键盘/触摸切换正常。
3. ReadingView: gallery 正常，print 模式下图片区域依然隐藏。
4. FavoriteCard: 展开态 gallery + lightbox 正常。
5. Lightbox 边界振动：仅在 lightbox 到头时触发。
6. 缩略图条跳转和当前态标识正确。
7. 现有投票/收藏/引用交互无回归。

**Step 3: Commit final verification notes (if any file change)**

```bash
git add -A
git commit -m "chore: finalize verification for image gallery and lightbox rollout"
```

---

## Notes For Execution

1. 全流程执行 `@test-driven-development`：先写失败测试再实现。
2. 出现行为偏差先走 `@systematic-debugging`，禁止猜改。
3. 对外声明完成前必须执行 `@verification-before-completion`。
4. 推荐在独立 worktree 中执行，避免与并行需求线互相污染。
