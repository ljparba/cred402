# Cred402 — Progress Tracker

> Pay-per-use credential verification on Hedera.
> Status labels: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `PASS` · `FAIL` · `COMPLETE`

**Last updated:** 2026-07-21

---

## Current phase

**Mobile width-overflow root-cause fix — `COMPLETE (implementation)` (2026-07-21):** eliminated the
last horizontal-overflow sources in the two remaining broken mobile states (Upload / Ready-to-Scan
and post-payment Verification Progress). Root cause: the 4-step progress rail used **fixed-width
connectors** (`w-8`/`sm:w-14`) in a non-`w-full`, `justify-center` flex with non-shrinking labels, so
its ~340px intrinsic width overflowed a ~288–360px phone column; several flex/grid children also
lacked `min-w-0` (default `min-width:auto`). Fixes: `StepProgress` rebuilt as a shrink-safe
`grid-cols-4 w-full min-w-0` rail with half-width connector lines and truncating labels; both state
grids default to `grid-cols-1` (3-col only at `xl`); every wrapper/card/motion.div now carries
`w-full min-w-0 max-w-full` (cards `overflow-hidden`); the certificate preview media is
`w-full min-w-0 max-w-full` capped only from `sm`; hashes/labels wrap (`break-all`/`break-words`); the
log panel is contained and scrolls only its own container. No behavior change. `frontend-layout` tests
extended to **33** guards (**67** total). Details: `IMPLEMENTATION_PLAN.md` §10.3–§10.4.

**Final frontend, responsive, security & docs closeout — `COMPLETE (implementation)` (2026-07-21):**
Sample Certificate cards redesigned (preview → status badge on its own row above the title → title →
description → actions; full "Use this sample" label; grid **1 col mobile / 2 col tablet-laptop /
3 col only at 1536px+**). Laptop header made compact at 1024–1535px (tighter gaps, compact Verify
pill, network badge shortened to "Hedera Testnet", redundant circular icon hidden) with mobile below
1024px. Two remaining broken mobile states fixed: **Upload / Ready-to-Scan** (full-width, Begin Scan
full-width, sidebar returns to normal flow) and **post-payment Verification Progress** (one section
per row, `min-w-0`, safe wrapping, freely scrollable — no fixed/`100vh`/body-lock). A focused
**security review** confirmed the secrets / upload / Tamper Demo / x402 / HCS / error-handling
controls are intact (no code changes required). Docs corrected (live HCS/x402 owner-verified, rate-limit
distinction, breakpoints, bundle sizes, test counts). Details: `IMPLEMENTATION_PLAN.md` §10.
Remaining: owner browser visual checks (`OWNER_ACCEPTANCE_TEST.md` Part C).

**Final frontend layout & mobile refinement — `COMPLETE` (2026-07-21):** a layout/usability pass
(no feature rewrite). Header logo is a real `/` route link that also resets the in-page flow; the
hero's redundant proof panel is replaced by **Live Activity**; homepage reordered to Hero → Stats →
**How It Works (35%) + Sample Certificates (65%)** → **Original vs. Tampered — Create Tamper Demo**;
upload sidebar reordered to **Sample Files → Scan Process → Issuer Hints** with the “View All”
control removed and all samples shown in a contained scroll; the final report drops **Reference
Samples** and adopts a Credential · Verdict · Payment top row over Checks + HCS/Activity with tighter
spacing; and the **mobile scan-progress scroll-lock is fixed** (the live-log panel now scrolls its
own container instead of `scrollIntoView`-ing the whole window). Also fixed a latent test-isolation
bug so the DB-backed suite no longer collides with a running `next dev`. Details:
`IMPLEMENTATION_PLAN.md` §9.

**Enhancement update — `COMPLETE`:** responsive UI fixes, a dedicated `/how-it-works` route, and
a controlled Create Tamper Demo feature (register an original on HCS → prove a modified copy is
`TAMPERED`). See `IMPLEMENTATION_PLAN.md` §8. Base build (Phases 0–9) remains complete/handoff-ready.

Deployment is **configured** (owner added live testnet keys). **Live HCS anchoring and real x402
settlement were owner-verified on Hedera Testnet** (real topic + messages, a completed HBAR
settlement, independent Mirror Node confirmation, HashScan proof observed — owner-run acceptance
actions). Automated tests still run on the offline/deterministic path (they never spend HBAR). The
`TAMPER_DEMO_ENABLED` flag defaults **false** so no endpoint writes to HCS during development.

### Enhancement task list
- [x] Backend: `credentials.source` + `rate_limit_hits` table + migration `0001`; config env vars +
  testnet guard; `/api/verify` optional `credentialId`; `/api/demo/register` + `/api/demo/[id]`;
  DB-backed rate limiter; `/api/health` exposes `tamperDemo.enabled`; offline unit tests.
- [x] Frontend: nav → real routes; homepage layout; mobile one-per-row cards/stats/samples/activity;
  report responsive + mobile stack order; global overflow audit; `/how-it-works` page (sections A–J);
  Create Tamper Demo multi-step UI.
- [x] Docs, production gates, checkpoint commit.

---

## Phase status

| # | Phase | Status | Evidence |
|---|-------|--------|----------|
| 0 | Inspection, plan, tracker | `COMPLETE` | Mockups present; `IMPLEMENTATION_PLAN.md` + this tracker committed; core deps installed |
| 1 | Database, schema, migrations, seed | `COMPLETE` | Migration `0000_wonderful_paper_doll.sql` (9 tables) applies clean to fresh PGlite; seed idempotent (2 runs → issuers 2 / credentials 12 / events 14 / samples 7); relational queries verified; `tsc --noEmit` clean |
| 2 | Hedera + HCS layer | `COMPLETE` | `src/lib/hedera/{types,client,hcs,mirror,hashscan}.ts` + provisioning scripts; unconfigured-safe; self-test passed (dashed-tx-id, envelope shape, HashScan URLs); caught+fixed a `toDashedTxId` bug; `tsc` clean. **Live topic creation + HCS anchoring owner-verified on testnet** (HashScan proof observed) |
| 3 | Certificate + demo data | `COMPLETE` | `certs:generate` renders 7 deterministic sample PDFs; byte-stable across 2 runs; tamper pair hashes provably differ (`a05bac…` vs `13f7a6…`, both embed CRED-2026-0004); real hashes seeded; `tsc` clean |
| 4 | Verification engine + protected API | `COMPLETE` | Engine classifies all 7 samples correctly (`verify:samples` → VALID×2/TAMPERED/EXPIRED/REVOKED/UNREGISTERED_ISSUER/UNKNOWN). Live dev-server smoke test: `/api/verify` returns locked preview with NO verdict leaked; `/api/samples`, `/api/samples/[slug]` (serves PDF), `/api/activity`, `/api/health` all 200; invalid upload → 415. PGlite works under Next via `serverExternalPackages` |
| 5 | x402 flow | `COMPLETE` | Genuine x402 v2: `GET /api/report/[id]` with no payment → **HTTP 402** carrying a valid `PAYMENT-REQUIRED` header (scheme exact / hedera:testnet / asset 0.0.0 / amount 10000000 / maxTimeout 180) with a **real `extra.feePayer: 0.0.9185802` injected live by x402.org's public facilitator**. No verdict/checks leak pre-payment. Replay-check-first → verify → settle → independent Mirror proof → UNIQUE-tx binding. Rejections verified: 404 REQUEST_NOT_FOUND, 400 BAD_PAYMENT_SIGNATURE, 400 pay-unconfigured. `tsc` clean. **Live x402 settlement owner-verified on Hedera Testnet** — real fee-sponsored HBAR settlement, independent Mirror Node confirmation (SUCCESS + exact-amount credit), HashScan proof observed |
| 6 | Frontend + animations | `COMPLETE` | Components covering all 5 mockup states (hero/scan/402/engine/report), rebranded to Cred402, new SVG logo, framer-motion animations, `prefers-reduced-motion` honoured, responsive, a11y (aria-live/focus/keyboard). `next build` succeeds. Live prod check: page renders all sections; full flow works (tampered → `?demo=1` → verdict TAMPERED with hash-diff + 6 checks). Layout later refined — see §9/§10 for the current homepage, header, sample-card, and mobile behavior |
| 7 | Test suite | `PASS` | `npm test` → **67 tests pass** (Node built-in runner + tsx, no new deps): hash 5 / config 4 / upload 7 / hedera 6 / engine 7 (all six credential states vs real PDFs) / demo 5 / frontend-layout 33 (structural UI/nav/responsive guards). DB-backed suites self-isolate (`./.pglite-test`, `./.pglite-demotest`) |
| 8 | Fix, harden, retest | `COMPLETE` | Production gates all green: no hardcoded secrets/keys in source; no server secret under `NEXT_PUBLIC`; `tsc --noEmit` 0 errors; `eslint` clean; `npm test` 67/67; `next build` succeeds; live prod smoke test passes |
| 9 | Docs + handoff | `COMPLETE` | 13 files: README + 12 docs (ARCHITECTURE, HEDERA_SETUP, X402_FLOW, DATABASE, LOCAL_SETUP, RENDER_DEPLOYMENT, TESTING, OWNER_ACCEPTANCE_TEST, DEMO_SCRIPT, BOUNTY_SUBMISSION_CHECKLIST, KNOWN_LIMITATIONS). Cross-linked; correctly branded |

---

## Completed tasks

- **Phase 0**
  - Repository + `design-mockup/` (5 images) inspected.
  - x402 v2 + Hiero SDK reality verified against live endpoints (see plan §2).
  - `docs/IMPLEMENTATION_PLAN.md` written (architecture, data flow, engine, security model).
  - Core dependencies installed: `drizzle-orm`, `@electric-sql/pglite`, `postgres`, `framer-motion`, `zod`, `lucide-react`, UI utils.
  - `docs/PROGRESS.md` tracker created.

## Active tasks

- None — implementation is complete; awaiting owner-configured Hedera acceptance testing.

## Blocked tasks

- None currently. (Owner-blocking items — Hedera keys — do not block until Phase 2 live submission; see plan §6. App runs in **unconfigured mode** with offline fixtures until keys arrive.)

## Test status

- `npm test` → **67/67 pass** (hash 5, config 4, upload 7, hedera 6, engine/6-states 7, demo 5, frontend-layout 33). `verify:samples` → 7/7 correct verdicts. `typecheck`, `lint`, `next build` all clean (`/` 185 kB, `/how-it-works` 184 kB First Load JS).
- Note: `verify:samples` and the DB-backed unit tests use PGlite (single-writer). The unit suite isolates its dirs even with `next dev` running; `verify:samples` still needs the dev server stopped or an isolated `PGLITE_DATA_DIR` (see `TESTING.md`).

## Known issues

- None blocking. Honest limitations captured in `docs/KNOWN_LIMITATIONS.md`: **live HCS anchoring + x402 settlement were owner-verified on Hedera Testnet** (owner-run acceptance; testnet PoC scope only); the `?demo=1` report bypass exists only in unconfigured mode; the Hedera `exact` scheme can't bind a nonce into the signed tx (replay is covered by DB-unique tx + independent Mirror proof); **Tamper Demo has a DB-backed rate limit (3/IP/hour when enabled) but general `/api/verify` has no global rate limit** (add edge limits for public/production use).

## Decisions made

- Local dev DB = **PGlite** (embedded WASM Postgres) since this machine has no Postgres server; production/Neon = `postgres.js` over `DATABASE_URL`. Same Drizzle schema + migrations for both.
- Use `@hiero-ledger/sdk` (not `@hashgraph/sdk`); **never install both** (breaks SDK brand checks).
- x402 **v2** headers + official `hedera:testnet` facilitator; HBAR-native pricing `10000000` tinybars = 0.1 HBAR.

## Next autonomous action

None required — the build is complete and handoff-ready. Optional follow-ups: a QA agent could extend the suite with live x402 integration tests once keys exist; add rate limiting before any public (non-testnet) use.

## Owner-required actions

See `docs/OWNER_ACCEPTANCE_TEST.md` and `docs/HEDERA_SETUP.md`. Only these need the owner (plan §6):
1. Create a Hedera Testnet operator account at portal.hedera.com → set `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_PRIVATE_KEY`.
2. `npm run hedera:create-topic` → set `HEDERA_HCS_TOPIC_ID`; `npm run hedera:anchor`; `npm run hedera:create-wallet` → set `X402_DEMO_PAYER_*`; set `X402_PAYMENT_RECIPIENT`.
3. Authorize spending (valueless) testnet HBAR for the first live settlement.
4. Deploy to Render + push to GitHub (`docs/RENDER_DEPLOYMENT.md`).

## Final readiness status

`HANDOFF-READY` — everything runs end-to-end. In unconfigured mode a reviewer gets a real 402
challenge + a clearly-labelled simulated report with no keys; with the owner's testnet keys, **live
HCS anchoring and real x402 settlement have been owner-verified on Hedera Testnet** (Mirror-confirmed,
HashScan proof). Remaining before final sign-off: the owner browser/visual checklist
(`OWNER_ACCEPTANCE_TEST.md` Part C). Scope stays a Hedera Testnet proof of concept.
