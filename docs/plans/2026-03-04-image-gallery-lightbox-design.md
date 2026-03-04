# Image Gallery and Lightbox Interaction Design

Date: 2026-03-04

## Context

Current FAQ image rendering is vertical stack style (`N images => N blocks`), which causes long reading interruptions and weak browsing efficiency.

Goal is to upgrade to a gallery-style interaction with consistent behavior across all answer surfaces.

## Confirmed Requirements

1. Replace current vertical image list with horizontal gallery.
2. Coverage scope: all current answer surfaces:
- `components/FAQItem.tsx`
- `components/DetailModal.tsx`
- `components/ReadingView.tsx`
- `components/FavoriteCard.tsx`
3. Visible count:
- Desktop: 3 images visible by default
- Mobile: 1 image visible by default
4. Hover effect: card lift (scale + shadow), no floating tooltip popup.
5. Click image opens enlarged viewer (lightbox).
6. In lightbox: support image switching via
- buttons
- keyboard arrows
- touch swipe
7. Boundary vibration:
- only in lightbox when trying to move beyond left/right edge.
8. Lightbox includes bottom thumbnail strip (click to jump).

## Non-goals

1. No backend/data shape changes (`images[]` remains unchanged).
2. No business logic changes for vote/favorite/reference.
3. No third-party carousel/lightbox dependency in this iteration.

## Chosen Approach

Implement reusable in-house UI primitives:

- `ImageGallery` for inline horizontal browsing
- `ImageLightbox` for enlarged navigation

Reasoning:

- Strong visual consistency with existing token system.
- Full control over exact interaction semantics (especially boundary vibration).
- Avoid extra dependency overhead and style drift.

## Component Architecture

### 1) `components/ImageGallery.tsx`

Responsibilities:

- Render horizontal scroll-snap gallery for inline content.
- Desktop 3-up layout, mobile 1-up layout.
- Card hover lift effect on pointer devices.
- Emit `onOpen(index)` when an image is clicked.

Inputs:

- `images: FAQImage[]`
- `lang: "zh" | "en"`
- `onOpen: (index: number) => void`
- optional `className`/context flags for slight layout adaptation

Behavior notes:

- No vibration in gallery layer.
- Gallery only handles browsing and open-trigger; enlarged state is owned by parent.

### 2) `components/ImageLightbox.tsx`

Responsibilities:

- Fullscreen modal viewing with large image.
- Navigation by buttons, keyboard arrows, and touch swipe.
- Bottom thumbnail strip for random access.
- Boundary vibration only when trying to navigate past edges.

Inputs:

- `isOpen: boolean`
- `images: FAQImage[]`
- `initialIndex: number`
- `lang: "zh" | "en"`
- `onClose: () => void`

Internal state:

- `currentIndex`
- touch gesture refs (`touchStartX`, `touchDeltaX`)
- boundary vibration cooldown timestamp (avoid excessive pulses)

## Integration Plan (By Surface)

1. `FAQItem`
- Replace current detailed-mode vertical image block with `ImageGallery`.
- Own lightbox state locally in item component.

2. `DetailModal`
- Replace image block with `ImageGallery` inside modal content area.
- Open nested lightbox overlay above modal content.

3. `ReadingView`
- Replace detailed image block with `ImageGallery`.
- Keep existing print-hidden behavior for image region.

4. `FavoriteCard`
- Replace expanded-image block with `ImageGallery`.
- Keep existing card interaction semantics unchanged.

## Interaction State Flow

### Inline gallery flow

1. user scrolls/swipes gallery horizontally
2. gallery snap settles to nearest card
3. click card -> `onOpen(index)`
4. parent opens lightbox with that index

### Lightbox flow

1. open with `initialIndex`
2. navigation entry points call same switch logic:
- left/right button
- keyboard ArrowLeft/ArrowRight
- touch swipe left/right
3. if at edge and still moving outward:
- do not move index
- trigger `navigator.vibrate(35~50)` if available
- throttle vibration with short cooldown
4. thumbnail click sets exact `currentIndex`
5. `Esc` or close button closes lightbox

## Error Handling

1. Empty/missing images -> do not render gallery/lightbox trigger.
2. Broken image URL -> show fallback visual state in card/lightbox, continue browsing.
3. `navigator.vibrate` unavailable -> silently no-op.
4. Tiny touch movement below threshold -> no switch.

## Accessibility

1. Lightbox:
- `role="dialog"`, `aria-modal="true"`
- focus stays in modal while open

2. Keyboard:
- `Esc`: close
- `ArrowLeft/ArrowRight`: previous/next

3. Thumbnails:
- selected state exposed (`aria-current` equivalent)
- clear accessible labels for jump buttons

## Styling Direction

Use existing token system and modal style language:

- container/background: `bg-panel`, `bg-surface`
- border/text tokens: `border-border`, `text-text`, `text-subtext`
- action accents: `bg-primary`, `hover:bg-primary-hover`

No visual language change beyond the gallery interaction itself.

## Validation Checklist

1. Desktop gallery shows 3 cards by default.
2. Mobile gallery shows 1 card by default.
3. Hover lift works on desktop pointer interaction.
4. Click opens lightbox correctly on selected image.
5. Lightbox supports button/keyboard/touch navigation.
6. Edge vibration triggers only in lightbox.
7. Thumbnail strip click-jump works.
8. All four target surfaces behave consistently.
9. Existing vote/favorite/reference behavior remains unchanged.

## Risks and Mitigations

1. Risk: duplicated state logic in four parents.
- Mitigation: keep gallery/lightbox logic encapsulated; parent holds only open/index state.

2. Risk: gesture conflicts with page scroll on mobile.
- Mitigation: horizontal threshold + directional lock before switching.

3. Risk: performance cost for many images.
- Mitigation: lazy image loading and lightweight transforms only.
