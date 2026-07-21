# Cred402 — Owner Acceptance Test

> A concrete, step-by-step checklist you (the owner) run to accept the project. Follow it top to
> bottom. Each step lists the exact action and the expected result. Tick the boxes as you go.

Do **Part A** with zero setup (unconfigured mode). Do **Part B** only once you've added Hedera keys
(see [HEDERA_SETUP.md](HEDERA_SETUP.md)) — it proves the real on-chain settlement.

Related: [LOCAL_SETUP.md](LOCAL_SETUP.md), [X402_FLOW.md](X402_FLOW.md), [TESTING.md](TESTING.md),
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

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

### C2. Homepage

- [ ] The hero **right side shows Live Activity** (recent HCS/payment/verification items with HashScan
      links) — the old repeated HCS/x402/tamper "proof cards" panel is gone.
- [ ] Desktop: **How It Works (left) and Sample Certificates (right)** in roughly a **35 / 65** split.
- [ ] The **Original vs. Tampered — Create Tamper Demo** section is present, with a CTA that opens
      `/how-it-works#tamper-demo`, and a concise synthetic-data disclaimer.
- [ ] Sample cards: no clipped titles, no overlapping buttons; **Use this sample** and **Download**
      both still work.

### C3. Upload / Scan page

- [ ] Right column order is **Sample Files → Scan Process → Issuer Hints**.
- [ ] There is **no “View All”** control; **all** samples are listed in the Sample Files panel,
      scrolling **vertically inside the panel** (never sideways), each row readable and selectable.

### C4. Final report

- [ ] There is **no “Reference Samples”** box.
- [ ] Top row reads **Credential · Verdict · Payment Proof**; below it, **Verification Checks** sit
      beside **HCS Proof + Verification Activity** with tight spacing (no tall empty columns).
- [ ] Long values (hashes, tx/request/topic ids, filenames, consensus timestamps) stay contained —
      they wrap/truncate with copy buttons and HashScan links intact; no horizontal overflow.

### C5. Mobile (test at 320 / 360 / 390 / 430 px, plus 768 px)

- [ ] **No page-level horizontal scrollbar** on any page; nothing is wider than the viewport.
- [ ] Homepage stacks in order: hero content → scanner → Live Activity → stats → How It Works →
      Samples → Tamper Demo → footer; one full-width section per row.
- [ ] **Scan progress scrolls freely up and down while scanning** — the live logs no longer yank the
      page down; the page is not locked/sticky/full-screen. Only the log box scrolls internally.
- [ ] Buttons and tap targets are comfortable; text wraps safely; focus states remain visible.

---

## Acceptance sign-off

- [ ] Part A passes end-to-end (unconfigured demo is convincing and honest).
- [ ] Part B passes end-to-end (a real testnet settlement releases the report; replay is rejected).
- [ ] Part C passes — layout, navigation, and mobile responsiveness at 320/360/390/430/768/desktop.
- [ ] Production checks pass: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
      (see [TESTING.md](TESTING.md)).
- [ ] The [Known Limitations](KNOWN_LIMITATIONS.md) match your understanding — nothing is hidden.

If all boxes are ticked, the project is accepted.
