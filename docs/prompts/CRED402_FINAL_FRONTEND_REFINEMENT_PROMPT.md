# Cred402 — Final Frontend Layout and Mobile Responsiveness Refinement

You are the **Lead Frontend Engineer and UI Orchestrator** for Cred402.

Continue from the current repository state and inspect the existing implementation before editing. This task is primarily a **frontend refinement pass**. Preserve all existing Hedera, HCS, x402, database, verification, payment, and tamper-demo behavior unless a small supporting frontend/API adjustment is required.

Do not redesign the product from scratch. Keep the current Cred402 visual identity, dark theme, typography, animations, and premium presentation.

Do not push, deploy, expose secrets, reset databases, reseed credentials, or rerun live HCS anchoring unless explicitly authorized.

---

# 1. Main Goal

Implement these final UI changes:

1. Make the header logo always redirect to the homepage
2. Replace the redundant right-side hero proof panel with Live Activity
3. Rearrange the homepage How It Works and Sample Certificates sections
4. Improve the upload/scan page sidebar ordering and sample list
5. Simplify the scan-completion/report layout
6. Fix the mobile scanner scroll-lock/sticky behavior
7. Add a strong Tamper Demo section back to the homepage
8. Verify all affected pages mobile-first with no horizontal overflow

This is a layout and usability refinement, not a feature rewrite.

---

# 2. Required Inspection Before Editing

Before making changes:

1. Inspect the current:
   - Header/navigation
   - Homepage hero
   - Homepage Live Activity component
   - Homepage How It Works preview
   - Homepage Sample Certificates section
   - Upload/scan page
   - Scan progress page
   - Final verification report page
   - Dedicated `/how-it-works` page
   - Create Tamper Demo component
   - Shared responsive CSS/layout utilities
2. Reproduce the current behavior at:
   - 320px
   - 360px
   - 390px
   - 430px
   - 768px
   - Standard desktop widths
3. Identify:
   - Fixed widths
   - Sticky/fixed elements
   - Full-height containers
   - Internal scroll traps
   - Horizontal overflow
   - Excessive empty spacing
4. Update implementation/progress documentation before implementation.

---

# 3. Header Logo Behavior

Update the Cred402 logo in every shared header/navigation instance.

Requirement:

```text
Clicking the Cred402 logo must always navigate to `/`
```

This must work from:

- Homepage
- Upload page
- Scan page
- Payment state
- Scan-progress state
- Final report page
- `/how-it-works`
- Tamper Demo state
- Mobile navigation

Use a real route link, not a scroll anchor.

Preserve keyboard accessibility and visible focus behavior.

---

# 4. Homepage Hero Right-Side Change

The current hero has a right-side Hedera/HCS proof panel that repeats information already shown elsewhere.

Remove that redundant panel.

Replace it with the existing **Live Activity** box.

## Requirements

The new hero layout should be:

- Left: Main headline, description, CTAs, and the three feature cards
- Center: Certificate scanning visual and hash/status panel
- Right: Live Activity

The Live Activity box should:

- Show recent verification/payment/HCS activity
- Preserve HashScan links
- Use a contained vertical scroll only when needed
- Avoid page-level overflow
- Match the height and visual balance of the hero
- Remain readable on tablet and mobile

On mobile:

- Stack hero content in a logical order
- Do not force the Live Activity panel into a narrow column
- Keep it one full-width section per row

---

# 5. Homepage Main Content Layout

Create this final desktop/tablet structure.

## Row 1

- Left: **How It Works preview**
- Right: **Sample Certificates**

Width ratio:

```text
How It Works: 35%
Sample Certificates: 65%
```

Use a responsive grid or flexible layout rather than hard-coded pixel widths.

## How It Works Preview

Keep it compact.

Show:

1. Upload
2. Pay via x402
3. Get Report

Each step should include:

- Step number
- Icon
- Short title
- Short description

Add a clear CTA linking to:

```text
/how-it-works
```

Do not repeat the entire dedicated page content here.

## Sample Certificates

Display the existing sample cards clearly.

Recommended responsive behavior:

- Wide desktop: 3 or 4 cards per row depending on available width
- Standard desktop: 3 cards per row
- Tablet: 2 cards per row
- Mobile: 1 card per row

Requirements:

- No clipped titles
- No overlapping buttons
- No fixed card width larger than the viewport
- Preserve all sample actions
- Preserve sample status labels
- Preserve download support where already available

## Mobile

At mobile widths:

- How It Works first
- Sample Certificates second
- One full-width section per row

---

# 6. Add Tamper Demo Back to Homepage

Add a dedicated homepage section based on the existing:

```text
Original vs. Tampered — Create Tamper Demo
```

This section is important and must remain visually prominent.

## Homepage version

Use a strong but compact full-width section.

It should explain:

- Upload an original file
- Anchor its proof
- Modify a local copy
- Upload the modified version
- See the result change from VALID to TAMPERED

Include a CTA to start the tamper demo.

The homepage section should not duplicate the entire detailed workflow from `/how-it-works`.

Suggested structure:

- Left: Short explanation and CTA
- Right: Simple original-vs-tampered visual or step preview

On mobile:

- Single-column
- CTA easy to tap
- No horizontal scrolling
- Keep the disclaimer visible but concise

Preserve the complete expanded Tamper Demo explanation on `/how-it-works`.

---

# 7. Back to Home Button Placement

Any current **Back to Home** action that appears near the bottom of a long page should be moved to the top area.

Place it near:

- Page title
- Breadcrumb area
- Top navigation controls

Do not leave the only navigation-back action at the bottom.

Preserve:

- Verify another
- Start another scan
- Other relevant top actions

Avoid duplicate buttons unless each has a distinct purpose.

---

# 8. Upload / Scan Page Sidebar Order

On the upload/scan page, update the right column order.

Final order:

1. **Sample Files**
2. **Scan Process**
3. **Issuer Hints**

The Scan Process box should move above Issuer Hints.

This order should remain logical on tablet and mobile.

On mobile, stack all three sections normally in the document flow.

---

# 9. Sample Files Panel

Remove the current `View All` button.

Reason:

- It does not reliably navigate to the full sample section
- It adds unnecessary interaction
- All samples should be available directly

## New behavior

Display all available sample files inside the Sample Files panel.

Requirements:

- Use a controlled vertical scroll inside the panel when necessary
- Do not create a horizontal scroll
- Keep every sample row readable
- Preserve sample status/type labels
- Preserve click/select behavior
- Use a sensible maximum height
- Do not make the entire page excessively tall on desktop

On mobile:

- Prefer normal page flow if internal scrolling becomes awkward
- Avoid nested scroll traps
- Keep one sample per row

---

# 10. Scan Completion / Final Report Cleanup

Remove the **Reference Samples** box from the scan-completion/final report view.

It is redundant and adds clutter.

## Recommended final layout

### Top row

- Left: Credential details
- Center: Verdict banner
- Right: Payment Proof

### Main content below

- Wide main area: Verification Checks
- Right supporting column:
  - HCS Proof
  - Verification Activity

## Spacing

Reduce excessive empty vertical space.

Requirements:

- Align cards from the top
- Use tighter but comfortable gaps
- Avoid tall empty columns
- Keep HCS proof close to verification checks
- Keep verdict and payment proof visible without large dead space
- Preserve all current proof values and links
- Preserve mobile single-column stacking

## Long values

Continue to protect against overflow:

- Hashes
- Transaction IDs
- Request IDs
- Topic IDs
- Filenames
- Consensus timestamps

Use:

- `min-width: 0`
- Safe wrapping
- Middle truncation where appropriate
- Copy buttons
- HashScan links

Do not hide the only copy of a technical proof value.

---

# 11. Scan Progress Mobile Scroll Fix

Current problem:

During active scanning/verification on mobile, the page becomes difficult or impossible to scroll upward because the scanner/progress layout behaves like a locked or sticky full-screen panel.

Fix this completely.

## Requirements

- Remove inappropriate `position: fixed`
- Remove sticky behavior that traps the page
- Remove forced `100vh` or full-screen containers where they block natural scrolling
- Do not lock `body` scrolling during the scan
- Keep all progress UI in normal document flow
- Avoid oversized internal scroll containers
- Ensure the page can scroll both upward and downward while scanning

## Mobile order

Use this sequence:

1. Page title/status
2. Certificate preview
3. Verification progress/checks
4. Live system logs
5. Proof & Trace

All sections:

- One per row
- Full available width
- No overlap
- No fixed viewport positioning
- No horizontal overflow

Live logs may have a small internal vertical scroll, but the page itself must remain freely scrollable.

---

# 12. Mobile-First Requirements

Treat mobile as a first-class layout.

Test at:

- 320px
- 360px
- 390px
- 430px

Mandatory:

- No page-level horizontal scrollbar
- No child wider than the viewport
- No clipped buttons
- No overlapping cards
- No inaccessible text
- No scroll lock
- No fixed desktop widths
- No excessive left/right padding
- All cards use `min-width: 0`
- Media and images use `max-width: 100%`
- Long text wraps safely
- Tap targets remain comfortable
- Header navigation remains usable
- Focus states remain visible
- Reduced-motion support remains intact

Do not rely only on `overflow-x: hidden` to conceal broken layout.

Fix the actual source of overflow.

---

# 13. Final Homepage Order

Use this final page structure:

1. Header
2. Hero:
   - Main content
   - Certificate scanner
   - Live Activity
3. Stats
4. How It Works preview — 35%
5. Sample Certificates — 65%
6. Original vs. Tampered — Create Tamper Demo
7. Footer

On mobile, every section becomes one full-width row in a logical reading order.

---

# 14. Functional Safety

Do not break:

- Existing upload flow
- Existing samples
- Existing scan process
- Existing verification checks
- Existing report generation
- Existing x402 payment flow
- Existing HCS proof
- Existing HashScan links
- Existing Tamper Demo
- Existing database behavior
- Existing API contracts

Do not introduce live network actions during page render.

All state-changing actions must remain explicit user actions.

---

# 15. Tests

Add or update tests for:

## Navigation

- Header logo routes to `/` from all major pages
- How It Works route remains correct
- Back to Home is visible near the top where required

## Homepage

- Live Activity replaces the redundant hero proof panel
- How It Works and Sample Certificates use 35/65 desktop layout
- Mobile stacks them correctly
- Tamper Demo section appears on homepage
- Existing sample actions still work

## Upload / Scan

- Sidebar order is Sample Files → Scan Process → Issuer Hints
- View All button is removed
- All samples are shown
- Sample list scroll behavior works
- No horizontal overflow

## Final Report

- Reference Samples box is removed
- New layout order is correct
- No excessive empty spacing
- Long technical values remain contained

## Mobile Scan Progress

- Page remains scrollable while scanning
- No fixed/sticky trap
- No body scroll lock
- All sections stack correctly
- No horizontal overflow

## Viewports

Verify at:

- 320px
- 360px
- 390px
- 430px
- 768px
- Desktop

Run all existing quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm run verify:samples
npm run build
```

If browser/E2E tooling exists, use it for responsive checks.

If it does not exist, add the smallest justified automated coverage and document the owner-browser checks.

---

# 16. Documentation

Update relevant documentation:

```text
docs/IMPLEMENTATION_PLAN.md
docs/PROGRESS.md
docs/TESTING.md
docs/OWNER_ACCEPTANCE_TEST.md
docs/KNOWN_LIMITATIONS.md
README.md
```

Document:

- New homepage structure
- Live Activity hero placement
- How It Works / Samples 35–65 layout
- Tamper Demo homepage section
- Upload-page sidebar order
- Removal of View All
- Removal of Reference Samples
- Mobile scanner scroll fix
- Responsive viewport checks

---

# 17. Owner Acceptance Checklist

Add owner checks for:

1. Click logo from every major page → returns to homepage
2. Confirm hero right side shows Live Activity
3. Confirm redundant hero proof box is gone
4. Confirm How It Works is left and Samples is right on desktop
5. Confirm 35/65 balance looks correct
6. Confirm mobile stacks both sections
7. Confirm all samples appear in the upload page panel
8. Confirm View All is gone
9. Confirm Scan Process appears above Issuer Hints
10. Confirm Reference Samples is removed from final report
11. Confirm final report spacing is improved
12. Confirm Back to Home appears near the top
13. Confirm scan progress can scroll freely on mobile
14. Confirm Tamper Demo appears on homepage
15. Confirm no horizontal scrolling at supported mobile widths
16. Confirm existing x402, HCS, and verification flows still work

---

# 18. Completion Criteria

Do not mark complete until:

- Logo routes to `/` everywhere
- Hero right panel is Live Activity
- Redundant proof panel is removed
- Homepage 35/65 layout is implemented
- Tamper Demo is present on homepage
- Back to Home is moved upward
- Scan Process is above Issuer Hints
- View All is removed
- All samples display correctly
- Reference Samples is removed
- Final report spacing is improved
- Mobile scan progress remains scrollable
- No supported viewport has horizontal overflow
- Existing functionality remains intact
- Tests pass
- Build passes
- Documentation is updated
- Working tree is clean
- A local checkpoint commit is created
- Nothing is pushed or deployed

---

# 19. Final Report

Return a concise report containing:

- Files changed
- Components changed
- Homepage layout result
- Navigation result
- Upload-page sidebar result
- Final-report cleanup result
- Mobile scroll-lock fix
- Responsive test results
- Existing flow regression results
- Test/lint/typecheck/build results
- Known limitations
- Exact owner checks remaining
- Commit hash
- Confirmation that nothing was pushed or deployed

---

# 20. Start Now

Begin immediately:

1. Inspect the current implementation
2. Reproduce the desktop and mobile issues
3. Update the plan/progress docs
4. Implement navigation fixes
5. Implement homepage layout changes
6. Update upload/scan sidebar
7. Simplify final report layout
8. Fix mobile scan scrolling
9. Add homepage Tamper Demo section
10. Run responsive and regression tests
11. Update documentation
12. Create a local checkpoint commit
13. Produce the owner handoff report

Do not stop at a plan or partial implementation.
