# Vercel Build Fix Design (i18n `all` Key)

Date: 2026-03-02  
Branch: main

## Problem

Vercel build fails on:

- `app/profile/ProfileClient.tsx`
- `t("all", lang)` is rejected by TypeScript because `all` is missing from `keyof typeof labels` in `lib/i18n.ts` at the deployed commit.

## Goal

Restore successful `next build` with the smallest safe change.

## Chosen Approach

Option 1 (approved): add `all` to `labels` in `lib/i18n.ts` and keep `ProfileClient` unchanged.

## Why This Approach

- Smallest semantic fix aligned with current UI intent (`All` filter tab).
- Preserves strict key checking from `t(key, lang)`.
- Avoids weakening type safety (`any` cast) or using unrelated fallback key names.

## Scope

- Modify only `lib/i18n.ts` to include:
  - `all: { zh: "全部", en: "All" }`
- No behavior changes in components.

## Verification

- Run `npm run build` locally.
- Confirm no TypeScript error at `ProfileClient.tsx:258`.
- Push and redeploy in Vercel.

## Risks

- If additional translation keys are missing elsewhere, build may surface new errors; fix them the same way.

