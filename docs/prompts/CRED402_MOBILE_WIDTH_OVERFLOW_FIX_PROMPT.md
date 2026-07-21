# Cred402 — Mobile Width Overflow Root-Cause Fix Prompt

You are the **Lead Frontend Engineer and Responsive QA Owner** for Cred402.

Continue from the current repository state. This task is narrowly focused on fixing the two remaining broken mobile states:

1. **Upload / Ready-to-Scan**
2. **Post-payment Verification Progress**

Do not redesign unrelated pages. Preserve all working verification, payment, x402, HCS, database, sample, and Tamper Demo behavior.

Do not push, deploy, reset databases, reseed, or re-anchor HCS events.

---

# 1. Confirmed Root Cause

The uploaded DevTools screenshots show that the **outer mobile container is roughly correct**, but one or more inner children are wider than their parent.

Observed pattern:

- Parent mobile content width: approximately 393–408px
- Inner upload/dropzone/card width: approximately 450px
- Result: right-side clipping, overflow, and a layout that is not truly 100% width

This means the fix must audit **every ancestor and child wrapper**, not only the outer grid.

Likely causes include:

- Fixed pixel widths
- `min-w-[...]`
- Unsafe `max-w-*`
- Flex/grid children using default `min-width: auto`
- Motion wrappers without `min-w-0`
- Certificate preview/canvas using a fixed width
- Progress steps forcing a minimum width
- Inline styles or animation values controlling width/x/scale
- Desktop grid templates still active too early

Do not hide the issue only with `overflow-x-hidden`. Fix the actual width source.

---

# 2. Mandatory Inspection

Before editing, inspect all wrappers involved in these states:

## Upload / Ready-to-Scan

- Main page container
- Section container
- Main responsive grid
- Upload column
- Dropzone card
- Drag/drop inner content
- Certificate preview wrapper
- Certificate preview image/canvas/SVG
- Begin Scan button wrapper
- Progress stepper
- Sidebar columns
- Any `motion.div` parent wrappers

## Verification Progress

- Main page container
- Main responsive grid
- Preview column
- Verification checks column
- Individual verification check cards
- Overall Progress wrapper
- Live System Logs wrapper
- Proof & Trace wrapper
- Hash/ID text wrappers
- Every animation wrapper

Use DevTools to identify the first element whose rendered width exceeds its parent.

---

# 3. Upload / Ready-to-Scan Mobile Fix

## Required mobile order

1. Page title/status
2. Progress stepper
3. Upload box
4. Certificate preview
5. Begin Scan button
6. Sample Files
7. Scan Process
8. Issuer Hints

## Main grid

The mobile grid must be one column by default.

Use an implementation equivalent to:

```tsx
className="
  grid
  w-full
  min-w-0
  max-w-full
  grid-cols-1
  gap-4
  xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.85fr)]
"
```

Do not activate the three-column layout before a true desktop breakpoint.

## Every direct grid/flex child

Every direct child must include:

```tsx
w-full min-w-0 max-w-full
```

This includes all `motion.div` wrappers.

## Upload card

The outer upload card must include:

```tsx
w-full min-w-0 max-w-full overflow-hidden
```

## Dropzone

The dropzone must include:

```tsx
w-full min-w-0 max-w-full
```

Remove any:

```text
w-[...px]
min-w-[...px]
max-w-[...px] that is larger than the mobile parent
```

The inner drag/drop content must also be allowed to shrink.

## Certificate preview

The preview wrapper must include:

```tsx
w-full min-w-0 max-w-full overflow-hidden
```

The preview image/canvas/SVG must use behavior equivalent to:

```tsx
className="block h-auto w-full max-w-full object-contain"
```

If the preview uses inline width/height values, preserve the aspect ratio but prevent those values from controlling layout width on mobile.

## Begin Scan button

On mobile:

```tsx
w-full
```

At larger breakpoints it may return to auto width.

Use behavior equivalent to:

```tsx
className="w-full sm:w-auto"
```

## Progress stepper

The 4-step Upload → Scan → Verify → Complete row must not force horizontal overflow.

Use a responsive implementation equivalent to:

```tsx
className="grid w-full min-w-0 grid-cols-4 gap-1"
```

Each step must have:

```tsx
min-w-0
```

Allow shorter labels or compact typography on narrow screens.

Do not use fixed-width connectors or step items.

---

# 4. Post-Payment Verification Progress Mobile Fix

## Required mobile order

1. Title/status
2. Certificate preview
3. Verification checks
4. Overall Progress
5. Live System Logs
6. Proof & Trace

## Main grid

Default to one column.

Desktop columns should only activate at a large breakpoint.

Use an implementation equivalent to:

```tsx
className="
  grid
  w-full
  min-w-0
  max-w-full
  grid-cols-1
  gap-4
  xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]
"
```

## Every section wrapper

All direct wrappers, including `motion.div`, must include:

```tsx
w-full min-w-0 max-w-full
```

## Verification cards

Each check card must include:

```tsx
w-full min-w-0 max-w-full overflow-hidden
```

Do not use fixed-width check cards on mobile.

## Hashes and technical values

For:

- SHA-256 hashes
- Request IDs
- Transaction IDs
- Topic IDs
- Consensus timestamps

Use:

```tsx
min-w-0 break-all
```

or a safe middle-truncation component with copy support.

Never let a technical value determine the card width.

## Normal text

Descriptions and labels must use:

```tsx
break-words
```

## Overall Progress

The progress wrapper and bar must stay within the viewport.

Use:

```tsx
w-full min-w-0 max-w-full
```

No minimum width larger than the parent.

## Logs

The Live System Logs panel may scroll internally, but must not resize wider than the page.

Use:

```tsx
w-full min-w-0 max-w-full overflow-hidden
```

The log content itself should wrap safely.

Auto-scroll must affect only the log container:

```tsx
el.scrollTop = el.scrollHeight
```

Do not call `scrollIntoView()` on new log items.

## Proof & Trace

Move below logs on mobile.

Every proof value must wrap or truncate safely.

No fixed desktop width.

---

# 5. Animation Wrapper Audit

This is mandatory.

Even when the visible card has correct classes, a parent `motion.div` can still enforce a larger width.

Inspect every Framer Motion wrapper in both states.

Every layout wrapper must use:

```tsx
w-full min-w-0 max-w-full
```

Remove or adjust any animation using:

- `width`
- `minWidth`
- `x`
- `scale`
- fixed transform values

that visually or mathematically expands the mobile layout beyond its parent.

Preserve animation intent, but never let animation control layout width.

Preserve `prefers-reduced-motion`.

---

# 6. Global Mobile Safety Rules

Apply to these two states:

- No page-level horizontal scrollbar
- No child wider than the viewport
- No fixed pixel width on mobile
- No unsafe `min-width`
- No nested horizontal scroll
- No `100vw` inside a padded parent
- No `position: fixed`
- No `h-screen` / `100vh` layout trap
- No body scroll lock
- Normal document flow
- 16–20px mobile horizontal padding
- All images/previews use `max-width: 100%`
- All grid/flex children use `min-width: 0`
- Buttons remain fully visible
- Header and bottom status bars must not overlap content

Do not rely on:

```css
overflow-x: hidden;
```

as the primary fix.

---

# 7. Required Responsive Checks

Test both states at:

```text
320px
360px
390px
425px
430px
768px
1024px
1280px
Desktop
```

For each width confirm:

- `document.documentElement.scrollWidth === document.documentElement.clientWidth`
- Upload card is exactly within the content container
- Dropzone is not wider than its card
- Preview is not clipped
- Begin Scan is visible and full width on mobile
- Stepper does not overflow
- Verification cards fill the available width
- Hashes do not expand the card
- Overall Progress stays inside the viewport
- Logs and Proof & Trace stack correctly
- Page scrolls freely up and down during processing

Use DevTools box-model measurements to prove no inner child is wider than its parent.

---

# 8. Tests

Add/update structural frontend tests for:

- Upload grid defaults to one column
- Desktop grid only activates at the intended breakpoint
- Direct wrappers include `w-full min-w-0 max-w-full`
- Dropzone contains no fixed/minimum mobile width
- Preview wrapper and media use `max-w-full`
- Begin Scan is full width on mobile
- Stepper uses a shrink-safe layout
- Verification Progress grid defaults to one column
- Verification cards are full-width and shrink-safe
- Hashes use safe wrapping
- Motion wrappers do not define unsafe width/x/scale layout values
- Logs scroll their own container
- No `100vh`, `h-screen`, body-lock, or fixed-position scan container

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Do not run `npm run verify:samples` while `next dev` is holding the main PGlite database unless using an isolated seeded directory.

---

# 9. Completion Criteria

Do not mark complete until:

- Upload/Ready-to-Scan is truly 100% width on mobile
- The dropzone is no wider than its parent
- Certificate preview fits fully inside the viewport
- Begin Scan is full-width on mobile
- Progress stepper does not overflow
- Verification Progress is one-column on mobile
- Verification cards are full-width
- Hashes and text do not force width
- Overall Progress fits inside the viewport
- Logs and Proof & Trace stack correctly
- Page scroll remains free during processing
- No supported viewport has horizontal overflow
- Existing verification/payment behavior is unchanged
- Tests pass
- Build passes
- Working tree is clean
- One local checkpoint commit is created
- Nothing is pushed or deployed

---

# 10. Final Report

Return:

- Root cause found
- Exact overflowing element(s)
- Files changed
- Upload mobile fix
- Verification Progress mobile fix
- Animation wrapper changes
- Width measurements before and after
- Responsive viewport results
- Test/typecheck/lint/build results
- Remaining owner visual checks
- Commit hash
- Confirmation that no DB was reset
- Confirmation that no HCS event was re-anchored
- Confirmation that nothing was pushed or deployed

---

# 11. Start Now

1. Inspect every ancestor and child in both broken states
2. Identify the first element wider than its parent
3. Fix width constraints at the source
4. Audit all motion wrappers
5. Test all required widths
6. Add/update structural guards
7. Run full gates
8. Create a local checkpoint commit
9. Produce the final handoff report

Do not stop at changing only the outer grid.
