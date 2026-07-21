# Cred402 — Tamper Demo Mobile Full-Width Fix Prompt

You are the **Lead Frontend Engineer and Responsive QA Owner** for Cred402.

Continue from the current clean repository state. This task is narrowly focused on the **Create Tamper Demo flow inside `/how-it-works`**.

The owner has confirmed that several Tamper Demo steps still break on mobile. The outer page width is correct, but inner step cards, ID/hash fields, instruction rows, buttons, step navigation, and motion wrappers are wider than their parent.

Preserve all existing Tamper Demo behavior:

- Original file registration
- SHA-256 generation
- Demo credential creation
- HCS anchoring
- Mirror proof retrieval
- Demo ID persistence
- Modified-file verification
- VALID/TAMPERED results
- Existing disclaimer and synthetic/testnet labels
- Existing rate limiting and security controls

Do not redesign unrelated sections. Do not push, deploy, reset databases, reseed, run live settlement, run live Tamper Demo registration, or re-anchor HCS events.

---

## 1. Goal

Fix the entire Tamper Demo flow so every step is truly mobile-safe and full-width.

Audit and fix:

- Step navigation rail/chips
- Step cards
- Registration progress list
- Demo ID field
- Original hash field
- Copy controls
- HashScan link
- Label chips
- Numbered instructions
- CTA buttons
- Saved credential summary
- Modified-file upload
- Final VALID/TAMPERED result
- Hash diff view
- Every `motion.div`

Do not hide the issue only with `overflow-x-hidden`. Remove the actual width source.

---

## 2. Required inspection

Inspect the complete component tree, including:

- `src/components/demo/TamperDemo.tsx`
- All Tamper Demo child components
- Shared hash/copy components
- Shared buttons/cards
- Every Framer Motion wrapper
- Every step from upload through final result

Use DevTools to find the first child whose rendered width exceeds its parent.

Test at:

```text
320 / 360 / 390 / 425 / 430 / 768 / 1024 / desktop
```

---

## 3. Confirmed mobile problems

The owner screenshots show:

1. Demo ID and Original Hash fields extend beyond the card
2. Long hashes force card width
3. Step descriptions are cut off on the right
4. Numbered instruction rows do not shrink correctly
5. CTA buttons with long labels exceed the content width
6. Step cards are not fully contained
7. Some motion/layout wrappers likely lack `min-w-0`
8. The flow is not a true single-column mobile layout

---

## 4. Global width rules

Every Tamper Demo layout wrapper must use shrink-safe behavior equivalent to:

```tsx
w-full min-w-0 max-w-full
```

Cards containing glows, animated borders, hashes, or buttons should also use:

```tsx
overflow-hidden
```

Audit every `motion.div`.

No layout wrapper may enforce width using:

- fixed pixel widths
- unsafe `min-width`
- `100vw` inside padded containers
- animated width
- horizontal `x` values that escape the parent
- scale values that visually overflow the card

Preserve `prefers-reduced-motion`.

---

## 5. Step navigation

The Tamper Demo rail must fit at 320px.

Preferred responsive direction:

```tsx
grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6
```

Equivalent compact mobile designs are acceptable.

Requirements:

- No horizontal scroll
- Labels may wrap
- Active/completed states remain clear
- No fixed-width connectors
- Accessible progress semantics preserved

---

## 6. Step cards

Every step card:

```tsx
w-full min-w-0 max-w-full overflow-hidden
```

Mobile:

- one card per row
- full available width
- 16–20px inner padding
- no fixed height
- no desktop multi-column layout
- no clipped content

---

## 7. Anchor Proof progress list

Each status row:

```tsx
flex min-w-0 items-start gap-3
```

Icon:

```tsx
shrink-0
```

Text wrapper:

```tsx
min-w-0 break-words
```

Apply to:

- Validating file
- Computing SHA-256
- Creating demo credential
- Submitting HCS event
- Waiting for consensus
- Retrieving Mirror proof
- Complete

---

## 8. Demo ID and hash fields

For field wrappers:

```tsx
w-full min-w-0 max-w-full
```

For Demo ID:

```tsx
min-w-0 break-all
```

For Original Hash:

```tsx
min-w-0 break-all font-mono
```

Copy buttons:

```tsx
shrink-0
```

On mobile, stack label above value. Never use a long value in a row where its text child keeps `min-width:auto`.

If a shared `CopyHash` component is used, fix it once so all Tamper Demo fields benefit.

---

## 9. HashScan link and chips

HashScan link:

```tsx
min-w-0 break-words
```

Keep the external-link icon aligned and visible.

Chips such as:

- Synthetic
- Demo
- Hedera Testnet
- Cred402 Demo Issuer

must use:

```tsx
flex flex-wrap gap-2
```

Do not force them into one row.

---

## 10. Modify-file instructions

Each numbered row:

```tsx
flex items-start gap-3
```

Number circle:

```tsx
shrink-0
```

Text wrapper:

```tsx
min-w-0 break-words
```

Do not truncate important instruction text.

The information note under the steps must use:

```tsx
w-full min-w-0 max-w-full break-words
```

---

## 11. CTA buttons

Affected actions include:

- Continue to tamper test
- I've modified my copy — continue
- Continue with modified copy
- Back to saved ID
- Open on HashScan
- Start another demo
- Upload modified copy
- View result

Mobile button behavior:

```tsx
w-full min-w-0 max-w-full whitespace-normal text-center
```

Requirements:

- Full label visible
- Text may wrap to two lines
- Icons use `shrink-0`
- Button height grows naturally
- Loading/disabled/focus states preserved

Use shorter mobile labels where needed:

```text
Continue to tamper test
Continue with modified copy
```

---

## 12. Saved credential card

The saved Demo Credential card must be:

```tsx
w-full min-w-0 max-w-full overflow-hidden
```

Fields stack vertically on mobile.

No side-by-side label/value layout for long hashes.

---

## 13. Modified upload and final result

Audit every remaining step.

Requirements:

- Modified upload box full width
- Preview full width
- Stable Demo ID contained
- Upload button full width
- Result card full width
- Original/uploaded hashes wrap safely
- VALID/TAMPERED banner inside viewport
- Copy controls visible
- HashScan links fit
- No nested horizontal scroll

For byte/hash diff chips:

```tsx
flex flex-wrap
```

Do not keep a fixed single-line diff row.

---

## 14. Mobile flow

Recommended order:

1. Tamper Demo heading
2. Disclaimer
3. Step navigation
4. Current step card
5. Supporting explanation
6. Next action
7. Remaining `/how-it-works` content

No sticky/fixed step card. No `100vh`, `h-screen`, or body scroll lock.

---

## 15. Global safety

For the full Tamper Demo flow:

- No page-level horizontal scrollbar
- No child wider than parent
- No fixed mobile widths
- No unsafe `min-width`
- No `100vw` inside padded containers
- Every grid/flex child uses `min-width: 0`
- Every media/card uses `max-width: 100%`
- Long IDs and hashes wrap safely
- Chips wrap
- Buttons wrap
- No sticky/fixed mobile flow
- Preserve focus states
- Preserve keyboard access
- Preserve reduced-motion support

Verify at each mobile width:

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

---

## 16. Tests

Add or update structural frontend tests for:

- Tamper Demo wrappers use `w-full min-w-0 max-w-full`
- Step rail is shrink-safe
- No fixed-width connectors
- Step cards are overflow-contained
- Progress rows have shrink-safe text wrappers
- Demo ID wraps safely
- Original hash wraps safely
- Copy buttons are `shrink-0`
- Chips use `flex-wrap`
- Instruction rows use `min-w-0 break-words`
- CTA buttons are full-width and allow wrapped text
- Saved credential card is shrink-safe
- Modified upload is full-width
- Diff view wraps
- No fixed/100vh/body-lock pattern exists

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Do not run live Tamper Demo registration, live settlement, or HCS anchoring.

Do not run `verify:samples` while `next dev` holds the main PGlite DB unless using an isolated seeded directory.

---

## 17. Documentation

Update:

```text
docs/IMPLEMENTATION_PLAN.md
docs/PROGRESS.md
docs/TESTING.md
docs/OWNER_ACCEPTANCE_TEST.md
```

Document:

- Tamper Demo mobile root cause
- Full-width step-card fix
- Hash/ID wrapping
- Wrapped CTA buttons
- Step rail behavior
- Final responsive checks
- Updated test count

Do not reintroduce stale wording about live HCS/x402 verification.

---

## 18. Completion criteria

Do not mark complete until:

- Every Tamper Demo step fits at 320px
- No step card exceeds its parent
- Demo ID fits
- Original hash fits
- Instruction text wraps
- Chips wrap
- CTA labels remain visible
- Modified upload fits
- Final result fits
- Diff view does not overflow
- Page remains freely scrollable
- No mobile horizontal scrollbar
- Existing Tamper Demo behavior is unchanged
- Tests pass
- Build passes
- Working tree is clean
- One local checkpoint commit is created
- Nothing is pushed or deployed

---

## 19. Final report

Return:

- Root cause found
- Exact overflowing elements
- Files changed
- Step navigation changes
- Step-card changes
- Demo ID/hash field changes
- Instruction-row changes
- CTA changes
- Modified upload/final result changes
- Responsive viewport results
- Test/typecheck/lint/build results
- Remaining owner visual checks
- Commit hash
- Confirmation that no DB was reset
- Confirmation that no live Tamper Demo registration ran
- Confirmation that no HCS event was re-anchored
- Confirmation that nothing was pushed or deployed

---

## 20. Start now

1. Inspect the complete Tamper Demo tree
2. Find the first overflowing child in every step
3. Fix wrappers and intrinsic-width sources
4. Audit all motion wrappers
5. Fix ID/hash fields
6. Fix instruction rows
7. Fix CTA buttons
8. Fix modified upload and final result
9. Test all required widths
10. Update tests and docs
11. Run full gates
12. Create one local checkpoint commit
13. Produce the final handoff report

Do not stop after fixing only Step 3 or Step 4. Audit every step from start to result.
