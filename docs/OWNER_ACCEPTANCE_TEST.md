# Cred402 — Owner Acceptance Test

> A concrete, step-by-step checklist you (the owner) run to accept the project. Follow it top to
> bottom. Each step lists the exact action and the expected result. Tick the boxes as you go.

Do **Part A** with zero setup (unconfigured mode). Do **Part B** only once you've added Hedera keys
(see [HEDERA_SETUP.md](HEDERA_SETUP.md)) — it proves the real on-chain settlement.

Related: [LOCAL_SETUP.md](LOCAL_SETUP.md), [X402_FLOW.md](X402_FLOW.md), [TESTING.md](TESTING.md),
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## Owner verification status (recorded)

The checklists below stay unchecked so the owner can re-run them any time (they are a reusable
acceptance script). The **actual owner-verified state as of this handoff** is:

- ✅ **Part A — unconfigured demo**: passed (genuine 402, honest *simulated* report, all **7** sample
  verdicts correct).
- ✅ **Part C — responsive / mobile acceptance**: owner-checked and **passed** at every width, across
  the homepage, sample cards, compact laptop header, Upload / Ready-to-Scan, post-payment Verification
  Progress, Payment / 402, footer + bottom status bar, the complete Create Tamper Demo mobile flow, and
  the global no-horizontal-scroll sweep.
- ✅ **Part B — live on-chain (core)**: **live HCS anchoring and a real x402 HBAR settlement were
  owner-verified on Hedera Testnet** — real topic + messages observed, settlement completed,
  independent Mirror Node confirmation succeeded, and HashScan proof was observed. (No private keys or
  sensitive transaction values are recorded here.)
- ✅ **Automated gates**: `npm test` **86/86** (frontend-layout **52** structural guards), with the
  DB-backed suites now closing PGlite and returning to the prompt naturally; `verify:samples` **7/7**;
  typecheck, lint, and the production build all pass.
- ✅ **Phase 3 — local production verification (`npm run start`)**: the built app boots on a dedicated
  local port; `/` + `/how-it-works` → 200 with branding; `/api/health` → `status:"ok"`, `db.ok:true`,
  configured mode, safe booleans/public endpoints only (no secret leak); `/api/samples` → 7 samples;
  sample PDFs download (`application/pdf`, non-empty); `POST /api/verify` → **locked** preview with **no
  verdict/checks**; unpaid `GET /api/report/{id}` → **genuine HTTP 402** (x402 v2, `PAYMENT-REQUIRED`
  header, no report leak); **configured mode ignores `?demo=1`** (still 402); error paths → safe typed
  404/415/400 (no stack traces/paths/SQL). Server stopped cleanly (no orphan); smoke ran against an
  isolated seeded DB, so the main `.pglite` was untouched.
- ⏳ **Part B — replay rejection (B6) and idempotent re-access (B7)**: still **not run**. B6 needs a
  previously-captured `PAYMENT-SIGNATURE` payload (not persisted, and a new one must not be created);
  B7 needs a previously-paid request (no reusable artifact was available). The owner runs B6/B7 later —
  a new live testnet settlement requires explicit owner authorization; do not tick them from code
  inspection alone.

Remaining owner-controlled actions: public GitHub push, Render configuration/deploy + deployed-site
test, production secrets, demo-video recording/upload, and the final bounty submission. Mainnet
production readiness is outside this Hedera Testnet proof-of-concept scope.

---

## Part A — Unconfigured mode (no keys required)

### A0. Install and prepare

- [ ] `npm install`
- [ ] `npm run db:setup`
- [ ] `npm run certs:generate`
- [ ] `npm run db:seed`
- [ ] `npm run dev`, then open <http://localhost:3000>

**Expected:** the one-page Cred402 experience loads (hero, upload workspace, sample panel, live
activity, footer with GitHub + testnet disclaimer). No console errors.

### A1. Confirm the mode

- [ ] `curl http://localhost:3000/api/health`

**Expected:** `"status":"ok"`, `"mode":"unconfigured"`, `db.driver:"pglite"`, `db.ok:true`,
`hedera.configured:false`, `x402.configured:false`.

### A2. Automated engine check (all six states)

- [ ] `npm run verify:samples`

**Expected:** all 7 samples pass with the expected verdict (VALID ×2, TAMPERED, EXPIRED, REVOKED,
UNREGISTERED_ISSUER, UNKNOWN).

### A3. The flagship tamper pair (do this in the UI)

- [ ] Upload `samples/valid/data-structures-original.pdf`
- [ ] Open its report (use the `?demo=1` report view in unconfigured mode)

**Expected — VALID:** hash integrity PASS, credential known PASS (`CRED-2026-0004`, Data Structures),
issuer registered PASS (Cred402 Demo Institute), not revoked PASS, not expired PASS, HCS evidence
present (WARN "local offline fixture" before anchoring). A VALID seal.

- [ ] Upload `samples/tampered/data-structures-tampered.pdf`
- [ ] Open its report

**Expected — TAMPERED:** a clear **hash diff** (uploaded SHA-256 ≠ anchored SHA-256), same credential
ID `CRED-2026-0004`, HCS evidence still present, and an explanation that the file was **edited after
issuance** (the grade was changed). Both files look visually identical — that's the point.

### A4. The other credential states (upload each; use `?demo=1` for the report)

| Upload | Expected verdict + what to see |
|---|---|
| `samples/expired/cybersecurity-awareness.pdf` | **EXPIRED** — hash matches, but past expiry (2022-06-01). |
| `samples/revoked/digital-identity.pdf` | **REVOKED** — hash matches, but a revocation event exists (issuance→revocation timeline). |
| `samples/unregistered/web-dev-foundations.pdf` | **UNREGISTERED_ISSUER** — issued by "Northgate Open Academy", not a registered issuer. |
| `samples/fake/counterfeit-certificate.pdf` | **UNKNOWN** — credential ID resolves to nothing, no HCS anchor. |
| `samples/valid/hedera-fundamentals.pdf` | **VALID** — a second genuine certificate (`CRED-2026-0001`). |

### A5. The free preview leaks nothing

- [ ] Upload any sample and inspect the `POST /api/verify` response (or the network tab).

**Expected:** `locked:true`, a `requestId` and `reportUrl`, the file's hash, and identification — but
**no `verdict` and no `checks`**. The verdict only appears from the report endpoint.

### A6. The genuine 402 gate

- [ ] `curl -s -F "file=@samples/tampered/data-structures-tampered.pdf" http://localhost:3000/api/verify | jq -r .requestId` → copy the id
- [ ] `curl -i http://localhost:3000/api/report/<requestId>`

**Expected:** **HTTP 402**. In unconfigured mode with no recipient it returns
`configured:false` and no report. (Decode the `PAYMENT-REQUIRED` header if present to see the real
facilitator `feePayer`.) The full report is **never** returned for free.

### A7. The agent story

- [ ] With the dev server running: `npm run agent:demo`

**Expected:** it uploads the tampered sample, prints the decoded HTTP 402 challenge, and — because
no demo-payer keys are set — exits 0 with a note that the 402 itself is the genuine paywall and how
to enable real settlement.

### A8. Samples download

- [ ] In the UI, click a download link in the Sample Certificates panel.

**Expected:** the corresponding PDF downloads (correct `Content-Type: application/pdf`, filename
based on the slug).

---

## Part B — Configured mode (real Hedera + x402)

Complete [HEDERA_SETUP.md](HEDERA_SETUP.md) first: operator keys, HCS topic, `hedera:anchor`, demo
wallet, recipient. Then:

### B1. Confirm configured mode

- [ ] `curl http://localhost:3000/api/health`

**Expected:** `"mode":"configured"`, `hedera.configured:true`, `hedera.topicConfigured:true`,
`x402.configured:true`, `x402.recipientConfigured:true`, `x402.demoPayerConfigured:true`.

### B2. HCS evidence is now anchored on-chain

- [ ] Re-upload `samples/valid/data-structures-original.pdf` and open its report.

**Expected:** the HCS evidence check is now **PASS** (not WARN), citing a real topic id, sequence
number, and transaction id — with a working HashScan topic link.

### B3. The `?demo=1` bypass is disabled

- [ ] Try `GET /api/report/<requestId>?demo=1` (no payment).

**Expected:** the bypass is **ignored** — you get an HTTP 402, not a report. Real payment is now
mandatory.

### B4. A real x402 settlement (the headline)

- [ ] `npm run agent:demo` (dev server running)

**Expected:**
- prints the genuine HTTP 402 challenge with a real `feePayer`,
- retries with a signed transaction,
- prints a decoded `PAYMENT-RESPONSE` (settlement) and the **released report** with verdict
  `TAMPERED`, the six checks, the hash diff, and a **real testnet transaction id + HashScan URL**,
- `payment.mirrorVerified` is `true`.

### B5. Independent on-chain proof

- [ ] Open the report's HashScan transaction link.

**Expected:** HashScan shows a **SUCCESS** transfer of **0.1 tHBAR** from the demo payer to your
recipient. (Optionally verify via Mirror Node — see [HEDERA_SETUP.md](HEDERA_SETUP.md) §6.)

### B6. Replay protection

- [ ] Attempt to reuse the same settled transaction to unlock a second report (re-send the same
  `PAYMENT-SIGNATURE` to a *different* requestId, e.g. via the agent client against another id).

**Expected:** rejected — **HTTP 409 `PAYMENT_ALREADY_CONSUMED`**. A settled transaction unlocks
exactly one report, ever.

### B7. Idempotent re-access

- [ ] `GET /api/report/<the paid requestId>` again (no new payment).

**Expected:** the same report is returned (idempotent release) with no second charge.

### B8. Live activity feed

- [ ] Refresh the app's Live Activity panel.

**Expected:** it shows the new HCS events and the settled x402 payment, each with a HashScan link,
and the headline counters update.

---

## Part C — Frontend layout & responsive acceptance (browser, no keys required)

These are the human-eye checks for the final layout/usability refinement. The automated suite guards
the structure (`tests/frontend-layout.test.ts`), but the visual/responsive judgement is yours. Do
them in a desktop browser, then repeat the mobile ones with devtools device emulation.

### C1. Navigation

- [ ] Click the **Cred402 logo** from each of: homepage, upload/scan, payment (402), scan progress,
      final report, `/how-it-works`, and the Tamper Demo — every time it returns to the homepage `/`.
- [ ] The logo is keyboard-focusable (Tab to it) with a visible focus ring, and Enter activates it.
- [ ] The nav **How it Works** link opens the real `/how-it-works` route.
- [ ] In any flow stage, **Back to home** appears near the **top** (not only at the bottom).

### C2. Homepage & Sample cards

- [ ] The hero **right side shows Live Activity** (recent HCS/payment/verification items with HashScan
      links) — the old repeated HCS/x402/tamper "proof cards" panel is gone.
- [ ] Desktop: **How It Works (left) and Sample Certificates (right)** in roughly a **35 / 65** split.
- [ ] The **Original vs. Tampered — Create Tamper Demo** section is present, with a CTA that opens
      `/how-it-works#tamper-demo`, and a concise synthetic-data disclaimer.
- [ ] **Sample grid columns:** **1 column** on mobile (< 768px), **2 columns** on tablet/laptop
      (768–1535px), **3 columns only at 1536px+**.
- [ ] **Sample card layout:** preview → **status badge on its own row above the title (left-aligned,
      not inline)** → title (up to 3 lines, not clipped) → description → actions at the bottom.
- [ ] The primary button shows the **full “Use this sample”** label (never `Use t…`); the Download
      button is the same height and aligned; both still work.

### C3. Compact laptop header

- [ ] At **1024–1535px**: header is one clean line — tighter gaps, a compact **Verify a Certificate**
      pill, the network badge reads **“Hedera Testnet”**, and the redundant far-right circular Hedera
      icon is **hidden**. No wrapping, no overlap.
- [ ] At **1536px+**: full desktop header with comfortable spacing and **“Built on Hedera Testnet”**.
- [ ] **Below 1024px**: the mobile menu/drawer is used (no desktop controls squeezed onto one line).
- [ ] Keyboard navigation works and focus rings are visible at every width; the logo still links to `/`.

### C4. Upload / Ready-to-Scan (mobile)

- [ ] Order: page title → upload box → certificate preview → **Begin Scan** → Sample Files →
      Scan Process → Issuer Hints. One column; no side-by-side panels.
- [ ] Upload box and preview are **full-width** (preview never exceeds the viewport / clipped).
- [ ] **Begin Scan is full-width** and easy to tap; sidebar sections are in normal flow (no nested
      scroll trap); no horizontal scroll.

### C5. Final report

- [ ] There is **no “Reference Samples”** box.
- [ ] Top row reads **Credential · Verdict · Payment Proof**; below it, **Verification Checks** sit
      beside **HCS Proof + Verification Activity** with tight spacing (no tall empty columns).
- [ ] Long values (hashes, tx/request/topic ids, filenames, consensus timestamps) stay contained —
      they wrap/truncate with copy buttons and HashScan links intact; no horizontal overflow.

### C6. Post-payment Verification Progress (mobile)

- [ ] Order: title/status → certificate preview → verification checks → overall progress → Live
      System Logs → Proof & Trace. One section per row; every check full-width.
- [ ] **The page scrolls freely up and down while verifying** — the live logs never drag the page;
      only the log box scrolls internally. No fixed/sticky/full-screen trap, no body scroll-lock.
- [ ] Hashes and long values wrap/ellipsize; the progress bar stays inside the viewport; Proof & Trace
      is visible below the logs. Reduced-motion still honoured.

### C7. Rate limits & live on-chain verification

- [ ] **Tamper Demo** (when `TAMPER_DEMO_ENABLED=true`): more than **3 registrations from one IP
      within an hour** is rejected with a 429 + retry-after.
- [ ] You acknowledge that **general `/api/verify` has no global rate limit** (documented in
      [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)); add edge limits before public/production use.
- [ ] **Live HCS/x402 owner verification is recorded:** you have run Part B (or equivalent) and
      observed a real HCS topic/messages, a completed x402 HBAR settlement, Mirror confirmation, and
      HashScan proof.

### C8. Payment / 402 page (mobile)

- [ ] The **402 Payment Required** card is fully inside the viewport (no right-side cutoff/clipped
      title); the amount wraps safely.
- [ ] The 4-step payment stepper (Request → Payment Required → Settlement → Report Unlocked) fits at
      **320px** without overflow.
- [ ] The **Wallet → Cred402 API → Hedera** diagram fits inside the card (circles scaled down, labels
      wrap / shorten to "Hedera"); no node or particle escapes the card.
- [ ] **Pay with x402 · 0.1 tHBAR** and **Use Demo Wallet** are full-width, stacked, with full labels
      (no truncation); loading/disabled/focus states still work.
- [ ] The HCS/Decentralized/Tamper/Fast-Settlement grid is 2 columns and readable.
- [ ] **Transaction Preview** rows stack (label above value); Pay To / Fee Payer / Recipient /
      Facilitator / Request ID stay inside the card (wrap or truncate) with copy buttons visible.

### C9. Footer & bottom status bar (mobile)

- [ ] Footer content stacks: logo → description → testnet disclaimer → nav links; the yellow
      disclaimer **wraps** and is readable at 320px (not cut off).
- [ ] Footer nav is a 2-column grid (or wrapped) that never exceeds the viewport; GitHub icon aligned.
- [ ] The **bottom network/status bar is NOT sticky on mobile** — it sits at the end of the page in
      normal flow (scroll to it), items wrap (Network / Mirror Node / Mode / Price / Facilitator / DB),
      and **View on HashScan is on its own full-width row**. No horizontal status strip / no side-scroll.
- [ ] On desktop the status bar returns to a single sticky bottom row.

### C10. Create Tamper Demo (mobile — `/how-it-works#tamper-demo`, needs `TAMPER_DEMO_ENABLED=true`)

Walk the whole flow at **320 / 360 / 390 / 425 / 430 / 768 px**:

- [ ] The **step rail** fits (a 2-column grid on mobile with wrapping labels) — no horizontal scroll.
- [ ] Every step card is one-per-row, full-width, with content contained (no right-side clipping).
- [ ] After anchoring, **Demo ID** and **Original Hash** wrap (`break-all`) and stay inside the card;
      copy buttons stay visible; **Open on HashScan** fits; the Synthetic/Demo/Testnet/Demo-Issuer
      chips wrap.
- [ ] The **Anchor Proof progress list** (Validating → … → Complete) wraps and never overflows.
- [ ] The **modify-file numbered instructions** wrap fully (nothing truncated).
- [ ] CTA buttons ("Anchor proof", "Continue to tamper test", "Continue with modified copy", "Verify
      tampering", "Start another demo") show their **full labels** (wrapping to two lines if needed).
- [ ] The **modified-file upload** box + Verify button are full-width; the final VALID/TAMPERED result
      and the **hash diff** stay inside the viewport (byte chips wrap).
- [ ] The page scrolls freely (no sticky/fixed step card); existing register→verify behavior works.

### C11. Global responsive sweep

Check **no horizontal scrollbar / no clipped card / no overlapping badge or title** at each width:

```text
320 / 360 / 390 / 425 / 430 / 768 / 1024 / 1280 / 1366 / 1440 / 1536 / large desktop
```

- [ ] `document.documentElement.scrollWidth === document.documentElement.clientWidth` at every mobile width.
- [ ] Homepage mobile order: hero content → scanner → Live Activity → stats → How It Works → Samples
      → Tamper Demo → footer (one full-width section per row).
- [ ] Buttons and tap targets are comfortable; text wraps safely; focus states remain visible.

---

## Acceptance sign-off

- [x] Part A passes end-to-end (unconfigured demo is convincing and honest). — owner-verified
- [x] Part B core passes — a real testnet settlement releases the report (owner-verified live HCS/x402
      acceptance: Mirror-confirmed, HashScan proof). Still to tick after running: B6 replay-rejection
      and B7 idempotent re-access.
- [x] Part C passes — layout, navigation, sample cards, compact laptop header, both mobile fixes, the
      Tamper Demo mobile flow, and no horizontal overflow at
      320/360/390/425/430/768/1024/1280/1366/1440/1536/large-desktop. — owner-verified
- [x] Production checks pass: `npm run lint`, `npm run typecheck`, `npm test` (**86/86**), `npm run build`
      (see [TESTING.md](TESTING.md)). — verified
- [ ] The [Known Limitations](KNOWN_LIMITATIONS.md) match your understanding — nothing is hidden.

If all boxes are ticked, the project is accepted.
