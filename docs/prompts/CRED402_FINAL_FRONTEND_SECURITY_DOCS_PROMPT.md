# Cred402 — Final Frontend, Responsive, Documentation, and Security Closeout Prompt

You are the **Lead Frontend Engineer, Security Reviewer, QA Orchestrator, and Documentation Owner** for Cred402.

Continue from the current clean repository state and inspect the latest implementation before editing. This is the final refinement and closeout pass after the current frontend checkpoint.

Preserve all working Cred402 behavior:

- Genuine HTTP 402 report gate
- Hedera Testnet HBAR settlement
- HCS issuance/revocation proof
- Mirror Node verification
- Deterministic SHA-256 credential checks
- Existing Tamper Demo API and UI
- Existing database and migrations
- Existing sample verdicts
- Existing visual identity

Do not rewrite the product. Do not push, deploy, reset databases, reseed live data, re-anchor HCS records, or spend testnet HBAR unless explicitly authorized.

---

# 1. Main Goal

Complete the following:

1. Improve Sample Certificate cards and breakpoints
2. Fix the two remaining broken mobile states:
   - Upload / Ready-to-Scan
   - Post-payment Verification Progress
3. Make the header responsive and compact on laptop widths
4. Keep all pages free from horizontal overflow
5. Run a security-focused review of the affected UI/API behavior
6. Correct stale documentation about live HCS/x402 verification and rate limiting
7. Update tests, owner acceptance, progress, and known limitations
8. Create one local checkpoint commit only

---

# 2. Mandatory Inspection

Before editing:

1. Inspect:
   - Homepage
   - Header/navigation
   - Sample Certificates cards
   - Upload / Ready-to-Scan state
   - Payment state
   - Verification Progress state
   - Final Report state
   - `/how-it-works`
   - Tamper Demo
   - Shared responsive CSS
   - API routes touched by the UI
   - Current security controls
   - Documentation listed below
2. Reproduce at:
   - 320px
   - 360px
   - 390px
   - 430px
   - 768px
   - 1024px
   - 1280px
   - 1366px
   - 1440px
   - 1536px
   - Large desktop
3. Identify:
   - Hard-coded widths
   - `min-width` overflow
   - Grid breakpoints that are too aggressive
   - Sticky/fixed/full-height containers
   - Nested scroll traps
   - Long text that does not wrap
   - Button truncation
   - Laptop header crowding
4. Update `docs/IMPLEMENTATION_PLAN.md` and `docs/PROGRESS.md` before implementation.

---

# 3. Sample Certificates — Final Card Design

Improve the Sample Certificates section.

## Responsive grid

Use this final behavior:

```text
Mobile below 768px      → 1 column
Tablet 768–1199px       → 2 columns
Laptop 1200–1535px      → 2 columns
Large desktop 1536px+   → 3 columns
```

Because the Samples section occupies only 65% of the desktop row, three columns are too cramped on normal laptop widths.

Preferred Tailwind direction:

```text
grid-cols-1 md:grid-cols-2 2xl:grid-cols-3
```

Use the exact implementation style that fits the current codebase.

## Card content order

Each sample card must use this order:

1. Certificate preview
2. Status badge
3. Certificate title
4. Short description
5. Actions

The status badge must be on its own row **above the title**, aligned left.

Do not place badges inline beside the title.

Supported states:

- VALID
- TAMPERED
- REVOKED
- EXPIRED
- UNKNOWN / FAKE
- UNREGISTERED

## Card styling requirements

- Full-width preview inside the card
- Consistent preview ratio
- Consistent card height within a row
- Title allowed 2–3 lines
- Description clamped cleanly without breaking layout
- Actions aligned at the bottom
- Full button text visible
- Do not show truncated labels like `Use t...`
- Download button aligned and same height as primary action
- Better spacing between preview, badge, title, description, and actions
- No badge/title overlap
- No horizontal overflow
- Preserve all current actions and status colors
- Preserve keyboard access and focus states

Recommended primary button label:

```text
Use this sample
```

The button may become full width on mobile.

---

# 4. Header — Laptop and Responsive Refinement

The header is crowded at laptop widths.

Use these layout rules:

```text
1536px+         → full desktop header
1024–1535px     → compact laptop header
Below 1024px    → mobile navigation/menu layout
```

## Compact laptop header

At 1024–1535px:

- Reduce horizontal gaps
- Keep the Cred402 logo readable
- Keep nav items on one line
- Use a more compact `Verify a Certificate` button
- Shorten the network badge to:

```text
Hedera Testnet
```

- Hide the redundant far-right circular Hedera icon if space is limited
- Avoid wrapping
- Avoid overlap
- Preserve keyboard navigation
- Preserve visible focus states
- Keep the logo as a real link to `/`

At 1536px+:

- Full text and comfortable spacing are allowed

Below 1024px:

- Use the existing mobile navigation pattern
- No desktop controls squeezed into one line

---

# 5. Upload / Ready-to-Scan Mobile Fix

This is one of the two remaining broken mobile states.

## Current problems

- Desktop-width content remains on mobile
- Certificate preview exceeds the viewport
- Begin Scan button is too narrow or misaligned
- Sidebar sections are squeezed
- The page looks clipped instead of full-width
- Nested containers create awkward scrolling

## Required mobile layout

Order:

1. Page title/status
2. Upload box
3. Certificate preview
4. Begin Scan button
5. Sample Files
6. Scan Process
7. Issuer Hints

## Requirements

- One column only
- Upload box full width
- Preview full width with `max-width: 100%`
- Remove fixed widths and unsafe `min-width`
- Begin Scan button full width on mobile
- 16–20px responsive page padding
- No side-by-side panels on mobile
- Sidebar sections return to normal document flow
- No horizontal scroll
- No clipped preview frame
- No overlap with floating UI
- No internal viewport-height lock
- Preserve all upload validation and scan behavior

Tablet and desktop may keep the richer multi-column layout where space permits.

---

# 6. Post-Payment Verification Progress Mobile Fix

This is the second remaining broken mobile state.

## Current problems

- Verification checks retain desktop widths
- Text and hashes overflow
- Center panel is compressed
- Cards are clipped
- Progress layout feels fixed or trapped
- Mobile scrolling is awkward

## Required mobile order

1. Page title and verification status
2. Certificate preview
3. Verification checks
4. Overall progress
5. Live System Logs
6. Proof & Trace

## Requirements

- One section per row
- Every verification check full width
- Remove desktop width constraints
- Use `min-width: 0` on all grid/flex children
- Hashes use safe `break-all` or middle truncation
- Descriptions use `break-words`
- Progress bar remains inside the viewport
- Live Logs appear below the checks
- Proof & Trace appears below Live Logs
- Page remains freely scrollable up and down during processing
- No `position: fixed`
- No sticky container that traps scrolling
- No `100vh`, `h-screen`, or forced full-screen wrapper
- No body scroll lock
- Log auto-scroll must only scroll the log container, never the page
- No horizontal overflow
- Preserve progress animation and `prefers-reduced-motion`

---

# 7. Global Responsive Rules

Apply across all affected pages:

- `min-width: 0` on flex/grid children
- `max-width: 100%` on images, previews, cards, and buttons
- Responsive page padding
- No child wider than the viewport
- Long hashes, request IDs, transaction IDs, topic IDs, filenames, and timestamps must wrap or truncate safely
- Do not use `overflow-x: hidden` as the only fix
- Fix the actual source of overflow
- No nested horizontal scroll
- Avoid nested vertical scrolling on mobile unless strictly necessary
- Preserve visible focus states
- Preserve keyboard navigation
- Preserve reduced-motion behavior
- Maintain comfortable tap targets

Mandatory visual checks:

```text
320 / 360 / 390 / 430 / 768 / 1024 / 1280 / 1366 / 1440 / 1536 / large desktop
```

---

# 8. Security Review

Perform a focused security review of the current frontend and related API behavior.

Do not make unrelated architecture changes.

## Verify and preserve

### Secrets

- No private key, payer key, operator key, or server secret in client bundles
- No sensitive values under `NEXT_PUBLIC_*`
- No secret values rendered in UI, logs, API errors, or docs
- No private-key data in tests or screenshots

### Upload security

- PDF/PNG/JPEG only
- Existing MIME/magic-byte validation preserved
- Existing maximum upload size preserved
- Empty and malformed files rejected
- Raw uploaded files are not permanently stored
- Filenames and labels sanitized before display/storage
- No unsafe HTML injection
- No user-controlled filesystem paths

### Tamper Demo

Confirm:

- `TAMPER_DEMO_ENABLED` default remains false
- Testnet-only guard remains enforced
- Demo issuer is forced server-side
- User cannot choose issuer, HCS topic, payer, or recipient
- DB-backed rate limit remains active when enabled
- Default remains:

```text
3 registrations per IP per hour
```

- IP is hashed before storage
- No raw certificate bytes are stored
- HCS event contains minimal proof only
- Demo records remain visibly labelled:
  - Synthetic
  - Demo
  - Hedera Testnet
  - Cred402 Demo Issuer
- Disclaimer remains visible before and after registration

### General verification uploads

Document honestly:

```text
General certificate verification uploads currently have no global rate limit.
```

Do not claim Tamper Demo rate limiting protects the general verification endpoint.

Recommend, but do not necessarily implement without scope approval:

- Edge/server rate limiting for `/api/verify`
- Request body and timeout limits
- Abuse monitoring
- Per-IP or per-client quotas for public production use

### x402 and payment

Verify:

- Full verdict/checks do not leak before payment
- Configured mode ignores `?demo=1`
- Payment transaction IDs remain single-use
- DB unique settlement binding remains enforced
- Mirror Node independently confirms:
  - SUCCESS
  - exact amount
  - correct recipient
- Paid report re-access remains idempotent
- Reusing the same payment for another report remains rejected
- No client-provided payment claim is trusted without Mirror verification

### HCS

Verify:

- No certificate bytes or personal data are submitted to HCS
- HCS records contain only minimal proof metadata
- HashScan links remain correct
- Mirror Node lag is handled safely
- Re-running seed or UI tests does not re-anchor events

### Error handling

- No stack traces in API responses
- Typed safe errors for invalid uploads, missing records, disabled demo, rate limits, and unavailable services
- UI does not expose raw internal errors
- No live write happens during page render
- State-changing actions require explicit clicks

---

# 9. Fix Stale Documentation

Update documentation to reflect the actual owner-verified state.

## KNOWN_LIMITATIONS.md

The current wording incorrectly says live settlement was not executed.

Replace the stale live-settlement section with accurate wording:

> **Live HCS anchoring and real x402 settlement were owner-verified on Hedera Testnet.**

Add a concise note that:

- Real HCS topic/messages were created
- Real HBAR x402 settlement completed
- Mirror Node verification succeeded
- HashScan proof was observed
- These were owner-run acceptance actions
- Mainnet production readiness is still outside the current testnet proof-of-concept scope

Do not include private keys or sensitive transaction details in docs.

## Rate limiting clarification

Document separately:

### Tamper Demo

> The Tamper Demo registration endpoint uses a DB-backed rate limit when enabled. The default is 3 registrations per IP per hour.

### General verification

> General certificate verification uploads currently have no global rate limit.

Do not say “no rate limiting” globally without this distinction.

## Other stale docs

Audit and fix inconsistencies in:

```text
README.md
docs/IMPLEMENTATION_PLAN.md
docs/PROGRESS.md
docs/TESTING.md
docs/OWNER_ACCEPTANCE_TEST.md
docs/KNOWN_LIMITATIONS.md
docs/HEDERA_SETUP.md
docs/X402_FLOW.md
docs/BOUNTY_SUBMISSION_CHECKLIST.md
docs/DEMO_SCRIPT.md
.env.example
```

Look for stale statements such as:

- Live settlement still owner-blocked
- HCS anchoring not yet run
- Enhancement task list still unchecked despite completion
- Tests still shown as 29 instead of 49
- Old homepage layout descriptions
- Wrong sample-grid breakpoints
- Missing mobile fixes
- Tamper Demo rate-limit ambiguity
- General verification rate-limit ambiguity
- Old build bundle numbers that no longer match the current build
- Old route/layout descriptions

## PROGRESS.md

- Mark completed enhancement tasks as completed
- Remove contradictory unchecked task lists
- Record final frontend refinement as complete only after tests and owner visual checks
- Record real owner-verified HCS/x402 acceptance accurately
- Keep remaining owner browser checks clearly separated from implementation completion

## OWNER_ACCEPTANCE_TEST.md

Add or update checks for:

- Sample cards:
  - 1 column mobile
  - 2 columns tablet/laptop
  - 3 columns only at 1536px+
  - status badge above title
  - full button text
- Compact laptop header
- Upload/Ready-to-Scan mobile layout
- Post-payment progress mobile layout
- Free scrolling during verification
- No horizontal overflow
- Tamper Demo rate-limit behavior
- General verification rate-limit limitation acknowledged
- Live HCS/x402 owner verification recorded

---

# 10. Tests

Add or update tests.

## Structural/frontend tests

Cover:

- Sample grid:
  - mobile 1 column
  - tablet/laptop 2 columns
  - 1536px+ 3 columns
- Badge row appears before title
- Button text is not intentionally truncated
- Header compact laptop classes/behavior
- Redundant header icon hidden at compact laptop width if implemented
- Upload mobile one-column order
- Begin Scan mobile full-width
- Verification Progress mobile order
- No fixed/100vh/body-lock pattern in scan progress
- Log container scrolls itself
- Long technical values have safe wrapping classes

## Existing tests

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run verify:samples
npm run build
```

Important PGlite rule:

- Stop `next dev` before `npm run verify:samples`, or
- Use an isolated seeded `PGLITE_DATA_DIR`

Do not delete or reset the main `.pglite` database.

## Manual responsive checks

Because the current frontend tests are structural, complete human-eye checks at:

```text
320 / 360 / 390 / 430 / 768 / 1024 / 1280 / 1366 / 1440 / 1536 / large desktop
```

Check:

- No horizontal scroll
- No clipped card
- No overlapping badge/title
- Full primary button label visible
- Header remains readable
- Upload screen full-width on mobile
- Verification Progress freely scrollable
- Logs do not drag the page
- Proof & Trace visible below logs

---

# 11. Completion Criteria

Do not mark complete until:

- Sample cards are redesigned
- Badge is above title
- Mobile sample grid is 1 column
- Tablet/laptop sample grid is 2 columns
- 1536px+ sample grid is 3 columns
- Laptop header is compact and readable
- Upload/Ready-to-Scan mobile is full-width and clean
- Begin Scan is full-width on mobile
- Post-payment Verification Progress is clean and scrollable
- No fixed/full-screen mobile trap remains
- No horizontal overflow at all required widths
- Existing verification/x402/HCS/Tamper Demo behavior is unchanged
- Security review is complete
- Stale live-settlement docs are corrected
- Rate-limit documentation clearly distinguishes Tamper Demo from general verification
- Progress checkboxes are consistent
- Tests pass
- Build passes
- Owner browser checklist is updated
- Working tree is clean
- One local checkpoint commit is created
- Nothing is pushed or deployed

---

# 12. Final Report

Return a concise final handoff report with:

- Branch
- Starting commit
- Ending commit
- Files changed
- Sample-card changes
- Final breakpoints
- Header changes
- Upload mobile fix
- Verification Progress mobile fix
- Horizontal-overflow result
- Security review findings
- Documentation corrections
- Live HCS/x402 wording update
- Rate-limit clarification
- Test results
- Build result
- Remaining owner visual checks
- Known limitations
- Confirmation that no database was reset
- Confirmation that no HCS event was re-anchored
- Confirmation that nothing was pushed or deployed

---

# 13. Start Now

Begin immediately:

1. Inspect the current implementation and docs
2. Update plan/progress
3. Reproduce all affected widths
4. Refine Sample Certificate cards
5. Refine laptop header
6. Fix Upload/Ready-to-Scan mobile
7. Fix Verification Progress mobile
8. Run security review
9. Fix stale docs
10. Add/update tests
11. Run full gates
12. Complete browser checklist where possible
13. Create a local checkpoint commit
14. Produce the final handoff report

Do not stop at a plan or partial implementation.
