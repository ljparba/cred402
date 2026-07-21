# Cred402 — Final Mobile Payment Page and Footer Fix Prompt

You are the **Lead Frontend Engineer and Responsive QA Owner** for Cred402.

Continue from the current clean repository state. This is the final mobile refinement pass and is limited to two remaining areas:

1. **Payment / HTTP 402 page**
2. **Footer and bottom network status bar**

Preserve all existing Cred402 behavior:

- Genuine HTTP 402 flow
- x402 payment actions
- Demo wallet action
- Transaction preview
- Hedera account/transaction details
- HCS and HashScan links
- Existing navigation
- Existing desktop layouts
- Existing responsive fixes on upload and verification progress
- Existing security controls

Do not redesign unrelated pages.

Do not push, deploy, reset databases, reseed, run live settlement, or re-anchor HCS events.

---

# 1. Main Goal

Fix the remaining mobile width and layout problems shown in the owner screenshots:

## Payment page

- Main 402 card is clipped or wider than the viewport
- Stepper is cramped
- Wallet → Cred402 API → Hedera Network illustration is too wide
- Transaction Preview rows overflow
- Long account IDs, request IDs, protocol/network/asset values are cut off
- Some inner cards still behave like desktop-width components

## Footer

- Footer navigation remains too horizontal on mobile
- Testnet disclaimer is cramped
- Bottom network/status bar overflows horizontally
- Network, Mirror Node, mode, price, facilitator, DB, and HashScan action are forced into one row
- Sticky bottom bar creates a mobile layout trap

The result must be genuinely mobile-first, not hidden with `overflow-x-hidden`.

---

# 2. Mandatory Inspection

Before editing, inspect all wrappers and direct children in:

## Payment state

- Payment page root
- Request Submitted card
- Server Response card
- Locked Report card
- Main `402 Payment Required` card
- Four-step payment progress rail
- Wallet/API/Hedera diagram
- Payment CTA buttons
- HCS/Decentralized/Tamper/Fast Settlement feature grid
- Transaction Preview card
- Every transaction metadata row
- Account ID / request ID copy wrappers
- Every `motion.div` surrounding the payment content

## Footer

- Main footer wrapper
- Logo/description/disclaimer block
- Footer navigation
- Bottom network/status bar
- Status items
- HashScan action
- Sticky/fixed behavior
- Mobile drawer/footer interactions if any

Use DevTools to identify the first child wider than its parent.

---

# 3. Payment Page — Mobile Layout

## Required mobile order

1. Back to Home
2. Back to Scan
3. Request Submitted
4. Server Response
5. Locked Report
6. 402 Payment Required
7. Transaction Preview

Keep the current content order unless the implementation requires a minor adjustment for usability.

## Main page and cards

Every payment-page wrapper and card must use shrink-safe behavior equivalent to:

```tsx
w-full min-w-0 max-w-full
```

Cards should also use:

```tsx
overflow-hidden
```

where inner effects, borders, or animations can escape the card.

Remove any:

```text
w-[...px]
min-w-[...px]
fixed desktop width
unsafe max-w-* on mobile
100vw inside padded parents
```

All `motion.div` layout wrappers must also be:

```tsx
w-full min-w-0 max-w-full
```

Do not let animation values control layout width.

---

# 4. HTTP 402 Card

The main `402 Payment Required` card must be fully contained within the mobile content column.

## Mobile requirements

- Full available width
- 16–20px inner padding
- No clipped title
- Amount text wraps safely
- No right-side cutoff
- Payment buttons full width
- Feature grid fits within the card
- No horizontal scrolling

Use mobile-first classes and only restore larger spacing at tablet/desktop breakpoints.

---

# 5. Payment Progress Stepper

The four steps are:

1. Request
2. Payment Required
3. Settlement
4. Report Unlocked

The current stepper must not force an intrinsic width.

Use a shrink-safe implementation equivalent to:

```tsx
grid w-full min-w-0 grid-cols-4 gap-1
```

Each step:

```tsx
min-w-0
```

Requirements:

- No fixed-width connectors
- No `justify-center` row whose contents determine width
- Connector lines should be absolute or percentage-based
- Labels may use smaller text and `truncate` on very narrow screens
- Active step remains visually clear
- Step circles remain aligned
- No overflow at 320px

Preserve accessibility labels and progress semantics.

---

# 6. Wallet → Cred402 API → Hedera Network Diagram

The three-node payment diagram must fit inside the mobile card.

Use a 3-column shrink-safe grid:

```tsx
grid w-full min-w-0 grid-cols-3 gap-2
```

Each node:

```tsx
min-w-0
```

Requirements:

- Icons scale down on mobile
- Labels wrap or use two lines
- Connector dots/lines must not add fixed width
- No oversized circles
- No translated or scaled element extends outside the card
- Desktop may use larger icons and spacing

Suggested mobile labels:

```text
Your Wallet
Cred402 API
Hedera
```

Full labels may return at larger breakpoints.

---

# 7. Payment Buttons

Buttons:

- `Pay with x402 · 0.1 tHBAR`
- `Use Demo Wallet`

Mobile behavior:

```tsx
w-full
```

Requirements:

- Full label visible
- No text truncation
- Icon does not push text outside
- Comfortable tap target
- Buttons stack vertically
- Maintain loading, disabled, and focus states

---

# 8. Feature Grid Inside Payment Card

The four items:

- HCS Proof
- Decentralized
- Tamper Check
- Fast Settlement

Mobile recommendation:

```text
2 columns
```

Use:

```tsx
grid-cols-2
```

with shrink-safe children.

At very narrow widths, use one column only if 2 columns still produce clipping.

Requirements:

- Labels remain readable
- Descriptions wrap
- No fixed-width icon blocks
- No overflow

---

# 9. Transaction Preview — Mobile Redesign

The Transaction Preview card currently uses desktop-style rows that place labels and long values side-by-side.

On mobile, each row must stack:

```text
Label
Value + optional copy button
```

Use responsive row behavior:

```tsx
flex-col
sm:flex-row
```

or equivalent.

## Fields

Handle:

- Amount
- Pay To
- Recipient account ID
- Fee Payer
- Facilitator account ID
- Protocol
- Network
- Asset
- Scheme
- Request ID

## Long technical values

For account IDs and request IDs:

```tsx
min-w-0 break-all
```

or safe middle truncation with copy support.

Copy buttons must:

- stay visible
- not shrink the value container incorrectly
- use `shrink-0`

Metadata rows must not align long values to the far right on mobile.

Use:

```tsx
items-start
text-left
```

for narrow screens.

Desktop may restore horizontal label/value rows.

---

# 10. Footer — Main Content

On mobile, stack the main footer content vertically.

Required order:

1. Cred402 logo
2. Product description
3. Testnet disclaimer
4. Navigation links

## Footer navigation

Use either:

```text
2 columns
```

or:

```text
1 item per row
```

Recommended:

```tsx
grid-cols-2
```

at mobile, then horizontal navigation on larger screens.

Links:

- How It Works
- Samples
- Tamper Demo
- GitHub

Requirements:

- No horizontal row that exceeds the viewport
- Comfortable spacing
- Visible focus states
- GitHub external icon stays aligned
- No clipped text

## Disclaimer

The yellow testnet disclaimer must:

- wrap naturally
- use `w-full max-w-full`
- not have a width based on content
- remain readable at 320px

---

# 11. Bottom Network / Status Bar

The current bottom status bar is desktop-oriented and must be redesigned for mobile.

## Mobile behavior

- Remove sticky behavior on mobile
- Keep it in normal footer flow
- Stack or wrap all status items
- Give HashScan action its own row
- No one-line horizontal status strip

Recommended mobile order:

1. Testnet Network badge
2. Network: Hedera testnet
3. Mirror Node
4. Mode
5. Price
6. Facilitator
7. DB
8. View on HashScan

Use a compact responsive grid:

```tsx
grid-cols-1
sm:grid-cols-2
```

or a wrapping flex layout with full-width safeguards.

Every item:

```tsx
min-w-0
```

Long values such as the Mirror Node host and facilitator URL must use:

```tsx
break-all
```

or safe truncation.

## Desktop behavior

Desktop may retain:

- Single-row status bar
- Sticky positioning
- Inline details

Use breakpoint-gated sticky behavior, for example:

```text
mobile: static
desktop: sticky
```

Do not use `position: fixed`.

---

# 12. Global Mobile Safety Rules

Apply to payment and footer:

- No page-level horizontal scrollbar
- No child wider than parent
- No fixed pixel widths on mobile
- No unsafe `min-width`
- No `100vw` inside padded containers
- All grid/flex children use `min-width: 0`
- Media/icons use `max-width: 100%`
- Long IDs and URLs wrap safely
- No sticky bottom bar on mobile
- No body scroll lock
- No fixed-position mobile footer
- Preserve keyboard accessibility
- Preserve focus states
- Preserve `prefers-reduced-motion`

Do not rely solely on:

```css
overflow-x: hidden
```

Fix the actual overflow source.

---

# 13. Responsive Checks

Test:

```text
320px
360px
390px
425px
430px
768px
1024px
1280px
1536px
large desktop
```

Confirm:

- Payment page fits exactly within the viewport
- 402 card is not clipped
- Stepper fits
- Wallet/API/Hedera diagram fits
- Payment buttons show full text
- Transaction Preview values wrap and copy buttons remain visible
- Footer navigation stacks correctly
- Disclaimer wraps
- Bottom network bar does not overflow
- Mobile bottom status bar is not sticky
- HashScan button fits
- Desktop layout remains visually strong

Measure:

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

at all mobile widths.

---

# 14. Tests

Add/update structural frontend tests for:

## Payment

- Payment main wrappers are `w-full min-w-0 max-w-full`
- Stepper uses shrink-safe grid
- Diagram uses shrink-safe 3-column grid
- Buttons are full-width on mobile
- Transaction rows stack on mobile
- Long IDs use safe wrapping/truncation
- Copy buttons are `shrink-0`
- No fixed-width payment wrapper remains

## Footer

- Main footer stacks on mobile
- Navigation becomes grid/wrapped layout
- Disclaimer is full-width and wrap-safe
- Bottom status bar is non-sticky on mobile
- Sticky behavior only applies at desktop breakpoint
- Status values use safe wrapping
- HashScan action gets its own responsive row
- No fixed-position footer

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Do not run live x402 settlement, HCS anchoring, or Tamper Demo registration.

Do not run `verify:samples` while `next dev` holds the main PGlite DB unless using an isolated seeded directory.

---

# 15. Documentation

Update only relevant docs:

```text
docs/IMPLEMENTATION_PLAN.md
docs/PROGRESS.md
docs/TESTING.md
docs/OWNER_ACCEPTANCE_TEST.md
docs/BOUNTY_SUBMISSION_CHECKLIST.md
```

Document:

- Payment page mobile fix
- Transaction Preview stacked rows
- Footer mobile stacking
- Non-sticky mobile network bar
- Final responsive viewport checks
- Test count changes

Do not reintroduce stale wording about live HCS/x402 being unverified.

---

# 16. Completion Criteria

Do not mark complete until:

- 402 card is fully contained on mobile
- Stepper fits at 320px
- Wallet/API/Hedera diagram fits
- Payment buttons show full labels
- Transaction Preview rows stack cleanly
- Account IDs and request IDs stay inside the card
- Footer content stacks correctly
- Footer links do not overflow
- Testnet disclaimer wraps
- Mobile network bar is non-sticky
- Bottom status details fit without horizontal scrolling
- HashScan button fits
- No supported viewport has horizontal overflow
- Existing payment behavior is unchanged
- Existing desktop layout remains intact
- Tests pass
- Build passes
- Working tree is clean
- One local checkpoint commit is created
- Nothing is pushed or deployed

---

# 17. Final Report

Return:

- Root cause found
- Exact overflowing elements
- Files changed
- Payment page mobile changes
- Stepper changes
- Payment diagram changes
- Transaction Preview changes
- Footer changes
- Bottom network bar changes
- Responsive viewport results
- Test/typecheck/lint/build results
- Remaining owner visual checks
- Commit hash
- Confirmation that no DB was reset
- Confirmation that no live settlement ran
- Confirmation that no HCS event was re-anchored
- Confirmation that nothing was pushed or deployed

---

# 18. Start Now

1. Inspect all payment and footer ancestors/children
2. Identify first elements wider than their parent
3. Fix payment page at the source
4. Rebuild Transaction Preview mobile rows
5. Rebuild footer/mobile status layout
6. Test all required widths
7. Update structural tests
8. Run full gates
9. Update docs
10. Create one local checkpoint commit
11. Produce the final handoff report

Do not stop after adding `overflow-hidden`; prove that every mobile child fits its parent.
