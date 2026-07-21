# Cred402 — Bounty Submission Checklist

> Everything needed to submit Cred402. Work top to bottom; tick each box. Items marked **(owner)**
> need your accounts/keys and cannot be done autonomously.

Related: [OWNER_ACCEPTANCE_TEST.md](OWNER_ACCEPTANCE_TEST.md), [DEMO_SCRIPT.md](DEMO_SCRIPT.md),
[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md), [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## 1. Code quality gates (all must pass)

- [x] `npm run lint` passes — verified
- [x] `npm run typecheck` passes — verified
- [x] `npm test` — **86/86 tests pass** (52 frontend guards; DB suites exit naturally) — verified
- [x] `npm run verify:samples` — all **7/7** samples classify correctly — verified
- [x] `npm run build` succeeds — verified
- [ ] `npm run start` boots the production build — *owner (production smoke test, not yet run here)*

## 2. Repository

- [ ] **(owner)** Repo is **public** on GitHub
- [x] `LICENSE` file present (MIT — matches the README badge/section)
- [ ] `.env.local` and secrets are **not** committed (verify `git log`/`git status`; `.env*` is
      gitignored except `.env.example`)
- [ ] `README.md` present with: product overview, the differentiator, the tamper demo, quickstart,
      the two modes, doc links, and the testnet disclaimer
- [ ] All 13 docs present under `docs/` (see the table in the README)
- [ ] `.env.example` present and complete

## 3. The core requirements are demonstrably met

- [x] Upload → hash → identify works (PDF/PNG/JPEG) — verified (upload + engine tests)
- [x] All six credential states classify correctly: **VALID, TAMPERED, EXPIRED, REVOKED,
      UNREGISTERED_ISSUER, UNKNOWN** — verified (`verify:samples` 7/7 + engine test)
- [x] The **original-vs-tampered pair** produces divergent SHA-256 and a clear TAMPERED verdict with
      a hash diff — verified
- [x] The protected report returns a **genuine HTTP 402** before payment — verified
- [x] The full report **cannot** be fetched for free (free preview leaks no verdict/checks) — verified
- [x] HCS is used as a tamper-evident event log (issuance/revocation envelopes; no PDFs/PII on-chain) — verified
- [x] Downloadable samples available from the main page — verified

## 4. Real Hedera + x402 proof **(owner)**

**Live HCS anchoring and a real x402 HBAR settlement were owner-verified on Hedera Testnet** during
acceptance (real topic + messages, settlement completed, Mirror-confirmed, HashScan proof observed).
The boxes below stay open only to **record the exact public evidence values** in the submission — fill
them from your own safe records; **never invent IDs and never include private keys**. Replay rejection
(last box) stays open unless you have actually run it.

- [ ] Testnet **operator account id** (public, no private key): `0.0.__________`
- [ ] **HCS topic id**: `0.0.__________` — HashScan: `https://hashscan.io/testnet/topic/0.0.____`
- [ ] `npm run hedera:anchor` run; `hcs_records` populated; sample HCS **sequence numbers** recorded
- [ ] At least one **real x402 settlement** performed (`npm run agent:demo` in configured mode)
- [ ] Sample settlement **transaction id(s)** (dashed form) recorded, e.g. `0.0.____-____-____`
- [ ] HashScan link to that transfer shows **SUCCESS**, **0.1 tHBAR**, payer → recipient
- [ ] Replay rejection verified (409 `PAYMENT_ALREADY_CONSUMED`)

> Record these values in your submission text. **Never include private keys.**

## 5. Deployment **(owner)**

- [ ] **(owner)** Render web service live; public URL: `https://__________.onrender.com`
- [ ] **(owner)** Render PostgreSQL created; `DATABASE_URL` set with `?sslmode=require`
- [ ] Migrations + seed run on the instance (`db:migrate`, `certs:generate`, `db:seed`)
- [ ] `GET /api/health` on the live URL returns the expected mode + `db.ok:true`
- [ ] (if keys set) `hedera:anchor` run on/against the production DB

## 6. Demo video **(owner)**

- [ ] Recorded following [DEMO_SCRIPT.md](DEMO_SCRIPT.md) (~2–3 min)
- [ ] Shows the tamper pair and the 402 → settlement → report flow
- [ ] Shows a real HashScan transaction (or clearly states unconfigured/simulated if not)
- [ ] Video uploaded and linked in the submission

## 7. Honesty

- [ ] [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) is accurate and linked from the submission
- [ ] The nonce-binding limitation of the Hedera exact scheme is disclosed (freshness-only; layers
      1–3 provide replay protection)
- [ ] Any unconfigured/simulated behaviour in the video is called out
- [ ] All certificates/issuers are labelled synthetic

## 8. Submission text — suggested structure

1. **One-liner:** "Cred402 — accountless, pay-per-use credential verification on Hedera using x402
   payments and tamper-evident HCS records."
2. **Links:** public repo, live URL, demo video.
3. **What it does:** the upload → 402 → settle → report flow; the six deterministic checks.
4. **Hedera proof:** operator id, HCS topic id, a sample HCS sequence number, a sample settlement
   transaction id, HashScan links. (No private keys.)
5. **The hero demo:** the original-vs-tampered pair.
6. **How to run it:** point to the README quickstart.
7. **Honest limitations:** link [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## Owner-run items (summary)

These are the only things the autonomous build could not do for you (IMPLEMENTATION_PLAN §6). Items
1–3 have since been **completed during owner acceptance** — live HCS anchoring and a real x402 HBAR
settlement were verified on Hedera Testnet (Mirror-confirmed, HashScan proof):

1. Provide the Hedera Testnet **operator** account id + private key (portal.hedera.com). ✅ done
2. Create the **demo-payer** account (`npm run hedera:create-wallet`). ✅ done
3. Authorize spending testnet HBAR (valueless), and run the live settlement. ✅ verified
4. Perform **Render + GitHub** deploy/push actions. — still owner-run

Everything else — code, schema, migrations, samples, tests, docs — is done.
