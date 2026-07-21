# Cred402 — Known Limitations

> An honest, complete list of what is demo-only, owner-blocked, or a genuine constraint of the
> underlying infrastructure. Nothing here is hidden; several items are disclosed directly in the UI
> and API responses.

Related: [X402_FLOW.md](X402_FLOW.md) §5 (security model), [HEDERA_SETUP.md](HEDERA_SETUP.md),
[ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. Live settlement is owner-blocked (no keys shipped)

The full x402 settlement path (build → 402 → sign → facilitator verify + settle → independent Mirror
proof → report release) is **implemented and typechecks**, but it was **NOT executed against a live
transaction during the build**, because that requires the owner's Hedera keys and authorization to
spend testnet HBAR (IMPLEMENTATION_PLAN §6).

- What *has* been proven without keys: a **genuine HTTP 402** with a **real `feePayer`** injected
  live by the public x402.org facilitator; the replay/verify/settle/proof code paths; and rejection
  behaviour (404/400/402/409).
- What needs the owner to demonstrate: an actual on-chain settlement. One command chain does it —
  see [HEDERA_SETUP.md](HEDERA_SETUP.md). Until then, treat the settlement as "code-complete,
  awaiting a live run."

## 2. The `?demo=1` report bypass (unconfigured mode only)

When the deployment has **no x402 keys**, `GET /api/report/{id}?demo=1` returns the full report with
the settlement clearly labelled **`simulated: true`** and a note explaining no real payment
occurred. This exists so reviewers can see the report UI without keys.

- It is **automatically disabled** the moment x402 keys are configured (`x402Configured` becomes
  true) — a keyed deployment ignores `?demo=1` entirely and enforces the real 402 gate.
- It never fabricates a transaction id or HashScan link; the simulated payment block is explicit.

## 3. The nonce cannot be cryptographically bound in the Hedera exact scheme

Unlike EVM's `authorization.nonce`, the Hedera `exact` scheme has **no nonce field** and **no
cryptographic binding between the signed transaction and the resource being purchased**. Cred402's
resource-bound nonce therefore provides **challenge freshness / TTL only** — it proves the buyer is
acting on a live, un-expired challenge, not a stale one.

The **actual replay protection** comes from layers that don't depend on the nonce:

1. Hedera-native single-use transaction ids (`DUPLICATE_TRANSACTION` on resubmit).
2. The DB-**UNIQUE** `payment_settlements.transaction_id` (first-use-wins: a settled tx unlocks
   exactly one report, ever), with a replay-check performed **before** any settlement effort.
3. Independent Mirror Node re-verification of an exact-amount credit to the recipient.

This residual scheme gap is disclosed here by design (see [X402_FLOW.md](X402_FLOW.md) §5).

## 4. HashScan per-message URL is not officially guaranteed

Cred402 can build a per-topic-message deep link (`/topic/<id>/message/<seq>`), but HashScan does not
officially guarantee a dedicated per-message route and may change it. The **always-valid** link is
the **topic page** (`/topic/<id>`), which shows the full message stream. For a raw single message,
use the Mirror Node API (`/api/v1/topics/<id>/messages/<seq>`). This caveat is documented in the
code (`src/lib/hedera/hashscan.ts`).

## 5. Mirror Node ingestion lag

The Hedera Mirror Node trails consensus by roughly **2–3 seconds** (plus propagation). Cred402 never
assumes read-after-write: it polls with exponential backoff (2s → ~10s) before giving up. A raw
`curl` immediately after a submit may 404 briefly — retry. Independent settlement proof can
therefore add a short delay before a report is released.

## 6. Five of the twelve credentials have no downloadable sample

The seed catalogue defines **12 credentials** but only **7 downloadable sample files** (valid ×2,
tampered, expired, revoked, unregistered, fake/unknown). The remaining 5 credentials exist in the
registry (and are anchored) to make the activity feed and stats realistic, but have no generated PDF
to download. This is intentional scope control for a proof of concept.

## 7. Image uploads are identified by hash only

Credential-ID extraction reads the ID from a **PDF's** Keywords/Subject/Title metadata. **PNG and
JPEG uploads carry no such metadata**, so an image is identified by its file hash alone. If an image
doesn't hash-match an anchored record, it resolves to **UNKNOWN** — the engine cannot fall back to a
claimed ID for images. (All shipped samples are PDFs, so this doesn't affect the demo, but a
reviewer uploading a photo of a certificate should expect UNKNOWN.)

## 8. Scope: this is a testnet proof of concept

By explicit design (IMPLEMENTATION_PLAN §7 / CLAUDE brief §22), Cred402 does **not** include:
university onboarding, real identity verification, NFT credentials, multi-chain support, admin
permissions, OCR, AI verification logic, messaging, subscriptions, social profiles, dashboards, or
marketing pages. Verification is deterministic and synthetic by design.

- All certificates and issuers are **fictional/synthetic**.
- All payments use **valueless Hedera Testnet HBAR**.
- It is **not** a production credentialing or identity system.

## 9. Other honest notes

- **No rate limiting** is enabled by default. For a public deployment, add Render/edge rate limiting
  if abuse is a concern (uploads are already size/type-restricted and never persisted).
- **HCS evidence check is WARN before anchoring.** In unconfigured mode, the `hcs_evidence` check
  reports WARN ("local offline fixture") rather than PASS; it becomes PASS only after
  `npm run hedera:anchor` writes real `hcs_records`.
- **Facilitator dependency.** The 402 challenge relies on `https://x402.org/facilitator` being
  reachable to inject `feePayer`. A transient outage degrades gracefully (`x402Ready:false`,
  `503 FACILITATOR_UNAVAILABLE` on settle) rather than crashing; it retries on the next request.
- **Frontend tests are structural, not DOM/E2E.** No headless browser or React DOM testing stack is
  installed, so `tests/frontend-layout.test.ts` asserts the layout/navigation refinements by reading
  component source for stable tokens (routes, prop names, ordering). It cannot catch a purely visual
  regression. The actual responsive/visual pass is the owner browser checklist
  ([OWNER_ACCEPTANCE_TEST.md](OWNER_ACCEPTANCE_TEST.md) Part C) at 320/360/390/430/768/desktop.
- **PGlite is single-writer.** The DB-backed unit tests isolate to their own dirs (so they pass even
  with `next dev` running), but `npm run verify:samples` uses the app's own PGlite dir — stop the dev
  server or point it at an isolated `PGLITE_DATA_DIR` (see [TESTING.md](TESTING.md)).
