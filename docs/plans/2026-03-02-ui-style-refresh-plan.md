# UI Style Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update UI colors (surface #F5F5F5 → #FAFAFA, border #E5E5E5 → #EAEAEA) and replace all emoji with clean icons/text indicators.

**Architecture:** CSS variable updates in globals.css, component-level emoji removals and replacements across FAQList.tsx, ProfileClient.tsx, and ReferenceList.tsx.

**Tech Stack:** Next.js, Tailwind CSS, React, TypeScript

---

## Pre-Implementation Checklist

- [ ] Read current `app/globals.css` to confirm variable locations
- [ ] Read `components/FAQList.tsx` to locate emoji usage
- [ ] Read `app/profile/ProfileClient.tsx` to locate emoji usage
- [ ] Read `components/ReferenceList.tsx` to locate emoji usage

---

## Task 1: Update CSS Color Variables

**Files:**
- Modify: `app/globals.css:10-11`

**Step 1: Update surface color**

Change line 10:
```css
--color-surface: #F5F5F5;
```
to:
```css
--color-surface: #FAFAFA;
```

**Step 2: Update border color**

Change line 11:
```css
--color-border: #E5E5E5;
```
to:
```css
--color-border: #EAEAEA;
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add app/globals.css
git commit -m "style: update surface and border colors to cleaner grays"
```

---

## Task 2: Remove Emoji from User Dropdown

**Files:**
- Modify: `components/FAQList.tsx:412,422`

**Step 1: Locate and read current dropdown menu code**

Read around lines 405-430 to see the current dropdown implementation with 👤 and 🚪 emoji.

**Step 2: Remove 👤 emoji from "My Learning" link**

Current code (~line 412):
```tsx
<a href="/profile" className="...">
  <span>👤</span>
  {t("myLearning", lang)}
</a>
```

Change to:
```tsx
<a href="/profile" className="...">
  {t("myLearning", lang)}
</a>
```

**Step 3: Remove 🚪 emoji from logout button**

Current code (~line 422):
```tsx
<button onClick={...} className="...">
  <span>🚪</span>
  {t("logout", lang)}
</button>
```

Change to:
```tsx
<button onClick={...} className="...">
  {t("logout", lang)}
</button>
```

**Step 4: Verify changes**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add components/FAQList.tsx
git commit -m "style: remove emoji from user dropdown menu"
```

---

## Task 3: Replace Emoji with Status Dots in Profile

**Files:**
- Modify: `app/profile/ProfileClient.tsx:112,136,147,159`

**Step 1: Read current ProfileClient implementation**

Read the file to locate all emoji usages and understand the section title structure.

**Step 2: Replace ⚠️ warning icon**

Current (~line 112):
```tsx
<span className="text-amber-600">⚠️</span>
```

Change to SVG icon:
```tsx
<svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
</svg>
```

**Step 3: Replace 📚 with gray dot for "unread"**

Current (~line 136):
```tsx
title={`📚 ${t("unreadStatus", lang)}`}
```

Change to component with dot:
```tsx
title={
  <span className="flex items-center gap-2">
    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
    {t("unreadStatus", lang)}
  </span>
}
```

Note: The `title` prop may need to support ReactNode instead of just string. Check FavoritesSection interface.

**Step 4: Replace 📖 with blue dot for "learning"**

Current (~line 147):
```tsx
title={`📖 ${t("learningStatus", lang)}`}
```

Change to:
```tsx
title={
  <span className="flex items-center gap-2">
    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
    {t("learningStatus", lang)}
  </span>
}
```

**Step 5: Replace ✅ with green dot for "mastered"**

Current (~line 159):
```tsx
title={`✅ ${t("masteredStatus", lang)}`}
```

Change to:
```tsx
title={
  <span className="flex items-center gap-2">
    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
    {t("masteredStatus", lang)}
  </span>
}
```

**Step 6: Update FavoritesSection interface if needed**

If `title` prop is typed as `string`, update to `ReactNode`:
```tsx
interface FavoritesSectionProps {
  title: React.ReactNode;  // was string
  // ... rest
}
```

**Step 7: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 8: Commit**

```bash
git add app/profile/ProfileClient.tsx
git commit -m "style: replace emoji with color dots in profile status sections"
```

---

## Task 4: Simplify Reference List Type Icons

**Files:**
- Modify: `components/ReferenceList.tsx:80`

**Step 1: Read current ReferenceList implementation**

Read around line 80 to see the emoji usage for reference types.

**Step 2: Replace emoji with text labels**

Current (~line 80):
```tsx
{ref.type === "paper" ? "📄" : ref.type === "blog" ? "📖" : "📌"}
```

Change to styled text badges:
```tsx
<span className={`
  rounded px-1.5 py-0.5 text-[10px] font-medium uppercase
  ${ref.type === "paper" ? "bg-blue-100 text-blue-700" :
    ref.type === "blog" ? "bg-green-100 text-green-700" :
    "bg-gray-100 text-gray-700"}
`}>
  {ref.type === "paper" ? "Paper" :
   ref.type === "blog" ? "Blog" :
   "Ref"}
</span>
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add components/ReferenceList.tsx
git commit -m "style: replace reference type emoji with text badges"
```

---

## Task 5: Final Verification

**Step 1: Full build check**

Run: `npm run build`
Expected: Clean build with no errors

**Step 2: Visual regression checklist**

Verify in browser:
- [ ] Surface color is now cleaner #FAFAFA (not yellow-ish gray)
- [ ] User dropdown has no emoji
- [ ] Profile status sections show color dots instead of emoji
- [ ] Reference list shows text badges instead of emoji
- [ ] All borders use softer #EAEAEA

**Step 3: Push to remote**

```bash
git push origin main
```

**Step 4: Deploy to Vercel**

Run: `vercel --prod`

---

## Summary of Changes

| File | Changes |
|------|---------|
| `app/globals.css` | surface: #F5F5F5 → #FAFAFA, border: #E5E5E5 → #EAEAEA |
| `components/FAQList.tsx` | Remove 👤 🚪 emoji from user dropdown |
| `app/profile/ProfileClient.tsx` | Replace 📚📖✅⚠️ with SVG icons and color dots |
| `components/ReferenceList.tsx` | Replace 📄📖📌 with text badges |

