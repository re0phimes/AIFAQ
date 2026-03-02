# Profile Page Fixes Design

Date: 2026-03-02
Branch: feature/profile-settings

---

## Overview

Fix two issues in the profile page:
1. **Bug**: Clicking a favorite item causes 404 error
2. **UI**: Improve card design referencing alphaxiv style, mobile-first

---

## 1. Bug Fix: 404 Error

### Problem
- Profile page filters favorites: `.filter(row => row.question !== null)`
- But FavoriteCard still links to `/faq/${faq_id}`
- If FAQ was deleted, clicking leads to 404

### Solution
Add graceful handling for potentially missing items:

**Option A (Recommended)**: UI-only indicator
- Add `isDeleted` prop to FavoriteCard
- Show "[内容已删除]" grayed out text
- Disable click, remove Link wrapper

**Option B**: Remove from list
- Filter out deleted items entirely
- User won't see them at all

**Decision**: Option A - keeps user's record visible even if source content is gone.

---

## 2. Card Design (Mobile-First)

### Current Issues
- Border-based design looks flat
- Status indicator (small dot) is too subtle
- Metadata scattered
- Not optimized for touch

### New Design

```
┌─────────────────────────────────────────┐
│  #42  Transformer 注意力机制原理         │  ← ID + title (2 lines max)
│                                         │
│  如何在Transformer中计算自注意力机制...    │  ← Summary (2 lines max)
│                                         │
│  Beginner · 128 votes · 2024-03-01      │  ← Metadata row
│                                         │
│  [Transformer] [Attention] [PyTorch]    │  ← Tags (max 3)
│                                         │
│  ┌────────────┬─────────────────────┐   │
│  │ 标记学习中  │      已收藏 ★        │   │  ← Actions
│  └────────────┴─────────────────────┘   │
└─────────────────────────────────────────┘
```

### Visual Specs

| Element | Current | New |
|---------|---------|-----|
| Border | `border-[0.5.5px] border-border` | `shadow-sm` |
| Background | `bg-panel` | `bg-white` |
| Radius | `rounded-xl` | `rounded-2xl` |
| Status | dot + text | left border color |
| Hover | border color change | `-translate-y-0.5 shadow-md` |

### Status Indicators

```css
/* Unread (default) */
- No left border
- Default background

/* Learning */
- border-l-4 border-blue-500
- bg-blue-50/30 (subtle tint)

/* Mastered */
- border-l-4 border-green-500
- bg-green-50/30 (subtle tint)
```

### Mobile Optimizations

- **Touch targets**: Buttons min 44px height
- **Card padding**: `p-4` on mobile, `p-5` on desktop
- **Text**: Prevent overflow with `line-clamp-2`
- **Horizontal scroll**: For status filter tabs

---

## 3. Layout Changes

### Filter Tabs (Replace Collapsible)

Replace section-based collapsible with horizontal tabs:

```
[全部(12)] [未读(3)] [学习中(5)] [已掌握(4)]
```

- Horizontally scrollable on mobile
- Active tab has primary color background
- Click to filter list

### Stats Display

Simplified header:

```
Total 12 · Learning 5 · Mastered 4
```

- Single line below title
- No separate cards

---

## 4. Interaction Details

### Hover States
- Card: `-translate-y-0.5` + `shadow-md`
- Title: `text-primary` color change
- Buttons: Background color darken

### Press States (Mobile)
- Card: `scale-[0.98]` on active
- Buttons: `opacity-80` on press

---

## 5. Accessibility

- Maintain `prefers-reduced-motion` support
- Touch targets minimum 44x44px
- Sufficient color contrast (WCAG AA)
- Keyboard navigation for tabs

---

## Files to Modify

1. `components/FavoriteCard.tsx` - New card design
2. `app/profile/ProfileClient.tsx` - Layout and tabs
3. `app/profile/page.tsx` - Pass `isDeleted` flag if needed

---

## Design Approval

Approved by user on 2026-03-02.
