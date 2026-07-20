# Cred402 — Implementation Plan

> Pay-per-use credential verification on Hedera.

**Status:** living document. Updated whenever architecture or implementation changes.
**Last updated:** 2026-07-20

---

## 1. Product summary

Cred402 is an API-first, accountless, pay-per-verification trust service on Hedera Testnet.

A human, application, or autonomous AI agent uploads a credential file. The server hashes it,
identifies the credential, and offers a **free preview**. The **full verification report** sits
behind a genuine HTTP `402 Payment Required` gate. The caller settles a real testnet HBAR payment
through the x402 protocol; the server independently confirms settlement on Hedera Mirror Node and
only then releases the machine-readable report, which is backed by tamper-evident Hedera Consensus
Service (HCS) records.

The flagship demonstration is a **visually identical original / tampered certificate pair** whose
SHA-256 hashes diverge, proving post-issuance edits against an immutable HCS anchor.

---

## 2. Confirmed technical findings (verified 2026-07-20, not assumed)

These findings materially changed the initial stack assumptions. Each was independently verified
against live endpoints and the npm registry, not taken from model memory.

| Assumption in original brief | Verified reality | Action |
|---|---|---|
| `@hashgraph/sdk` is the Hedera JS SDK | Hedera SDKs moved to the vendor-neutral **Hiero** project. `@hashgraph/sdk` frozen at 2.81.0 (2026-03-13); `@hiero-ledger/sdk` is at **2.85.0**. Drop-in rename, no breaking signature changes. | Use `@hiero-ledger/sdk`. **Never install both** — duplicate on-disk SDKs break the SDK's internal brand checks (`t.startsWith is not a function`). |
| x402 uses `X-PAYMENT` header | That is **v1**. Current is **x402Version 2**, governed by the x402 Foundation (Linux Foundation, 2026-04-02). Headers are `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE` — all base64 JSON. | Implement v2 headers. |
| `x402` / `x402-next` npm packages | Unscoped `x402-*` family is frozen at **1.2.x (v1 legacy)**. v2 lives under the **`@x402/*` scope at 2.19.0**. | Use `@x402/core`, `@x402/hedera`, `@x402/next`, `@x402/fetch`. |
| Hedera x402 support may not exist | **Officially merged.** `specs/schemes/exact/scheme_exact_hedera.md` upstream. Live facilitator confirmed by direct request: `GET https://x402.org/facilitator/supported` → `{"x402Version":2,"scheme":"exact","network":"hedera:testnet","extra":{"feePayer":"0.0.9185802"}}` | Use the official facilitator. No hand-rolled 402. |
| Payment must be USDC | HBAR-native is supported: `asset: "0.0.0"`, amounts in **tinybars** (1 HBAR = 10^8). | Price `0.1 HBAR` = `"10000000"` tinybars, matching the mockup's "0.10 tHBAR". |

### Hedera x402 flow shape (differs from EVM)

It is **not** a signed authorization message. It is a **partially-signed transaction with
facilitator fee sponsorship**:

1. Server's 402 advertises `extra.feePayer` (facilitator's account, injected automatically at startup).
2. Client builds a `TransferTransaction` to `payTo`, sets `transactionId.accountId = feePayer`, signs locally.
3. Client base64-serializes it into `payload: { transaction: "<base64>" }`.
4. Facilitator verifies, co-signs as fee payer, submits. **Client pays zero gas.**

### Known SDK footguns to code around

- `receipt.topicSequenceNumber` is a **`Long`**, not a JS number → always `.toNumber()` / `.toString()`.
- `TransactionReceipt` has **no** `consensusTimestamp`. It lives on `TransactionRecord`, or read it free from Mirror Node.
- SDK `TransactionId.toString()` emits `0.0.X@sss.nnn`. **Mirror Node rejects this (HTTP 400)** — must convert to `0.0.X-sss-nnn`. HashScan tolerates both.
- Mirror Node has **ingestion lag** (~2–3s consensus + propagation). Never assume read-after-write; poll with backoff from 2s up to ~10s.
- `PrivateKey.fromString()` is deprecated → use `fromStringECDSA()` / `fromStringED25519()`. Portal testnet accounts are typically ECDSA.
- Mirror Node `message` and `memo_base64` fields are **base64-encoded**.

---

## 3. Architecture

### 3.1 Module map

```
src/
  app/
    layout.tsx                       Root layout, fonts, metadata
    page.tsx                         The single-page experience (all states)
    api/
      verify/route.ts                POST  upload → hash → identify → free preview + requestId
      report/[requestId]/route.ts    GET   PROTECTED — x402 gated full report
      pay/route.ts                   POST  demo-wallet payer (server-side x402 client)
      samples/route.ts               GET   sample catalogue
      samples/[slug]/route.ts        GET   sample file download
      activity/route.ts              GET   live Hedera/HCS activity feed
      health/route.ts                GET   readiness + config diagnostics
  lib/
    db/
      schema.ts                      Drizzle schema (9 tables)
      index.ts                       DATABASE_URL abstraction (postgres.js | PGlite)
      queries.ts                     Typed data access
    hedera/
      client.ts                      Hiero client + operator, unconfigured-safe
      hcs.ts                         Topic create, issuance/revocation event submit
      mirror.ts                      Mirror Node REST (messages, transactions) + backoff
      hashscan.ts                    HashScan URL builders
      types.ts                       HCS event envelope (versioned)
    x402/
      server.ts                      x402ResourceServer + Hedera scheme registration
      settlement.ts                  Independent Mirror Node settlement verification
      nonce.ts                       Resource-bound nonce issue/verify/burn
    verify/
      hash.ts                        SHA-256
      upload.ts                      Type/size/MIME validation
      engine.ts                      Deterministic verification pipeline
    config.ts                        Typed env access, server-only guards
    utils.ts
  components/                        UI + motion components
scripts/
  create-topic.ts                    One-time HCS topic provisioning
  create-demo-wallet.ts              Derive second funded testnet account for demo payer
  generate-certificates.ts           PDF generation incl. original/tampered pairs
  anchor-credentials.ts              Submit HCS issuance/revocation events
  seed.ts                            Idempotent DB seed
  agent-client.ts                    Machine-readable x402 client (AI-agent demo)
samples/ valid/ tampered/ expired/ revoked/ fake/
drizzle/                             Generated migrations
docs/                                All required documentation
```

### 3.2 Data flow

```
Browser/Agent
   │  POST /api/verify  (multipart file)
   ▼
Validate (type, ext, MIME sniff, size) ──► SHA-256 (server-side, in memory)
   │
   ▼  match by hash → else by embedded credential ID → else UNKNOWN
Create verification_request { id, hash, credentialId?, nonce, status=AWAITING_PAYMENT }
   │
   ▼  FREE PREVIEW ONLY: filename, size, hash, locked=true
   │
   │  GET /api/report/{requestId}
   ▼
x402 middleware → no PAYMENT-SIGNATURE?
   │
   ├──► 402 + PAYMENT-REQUIRED header
   │       accepts:[{ scheme:"exact", network:"hedera:testnet",
   │                  asset:"0.0.0", amount:"10000000", payTo:<operator>,
   │                  maxTimeoutSeconds:180, extra:{ feePayer:<facilitator> } }]
   │
   ▼  client signs TransferTransaction, retries with PAYMENT-SIGNATURE
Facilitator verify → settle (real testnet HBAR transfer)
   │
   ▼  afterSettle hook
INDEPENDENT VERIFY: Mirror Node GET /transactions/{dashed-id}
   assert result==SUCCESS ∧ transfer to payTo == exact tinybars
   assert transaction_id unused (UNIQUE) → burn nonce
   │
   ▼
Run verification engine:
   hash match? · issuer registered? · revoked? · expired? · HCS evidence?
   │
   ▼  persist verification_result + payment_settlement
Release full report + HashScan links
```

### 3.3 Verification engine — deterministic, no AI

Six independent checks, each producing `PASS | FAIL | WARN | SKIP` with evidence:

1. **Hash integrity** — uploaded SHA-256 vs HCS-anchored issuance hash.
2. **Credential known** — credential ID resolves in registry.
3. **Issuer registered** — issuer exists and is trusted.
4. **Revocation** — latest HCS status event is not `REVOKED`.
5. **Expiration** — `expiresAt` in the future (or absent).
6. **HCS evidence** — issuance event retrievable from Mirror Node with matching hash.

Overall verdict resolves by precedence:
`UNKNOWN` → `UNREGISTERED_ISSUER` → `TAMPERED` → `REVOKED` → `EXPIRED` → `VALID`.

Tampering is specifically: credential ID **is** known and HCS evidence **exists**, but the
uploaded hash **differs** from the anchored hash. This is what makes the flagship demo legible.

### 3.4 HCS event design

Topic acts as an append-only credential event log. **No PDFs, no personal data on-chain.**

```jsonc
{
  "v": 1,                      // event schema version
  "type": "CREDENTIAL_ISSUED", // | CREDENTIAL_REVOKED | ISSUER_REGISTERED
  "eventId": "evt_...",        // app-generated, idempotency key
  "credentialId": "CRED-...",
  "issuerId": "ISS-...",
  "sha256": "<64 hex>",
  "issuedAt": "2026-01-15T00:00:00Z",
  "expiresAt": "2029-01-15T00:00:00Z",  // optional
  "status": "ACTIVE",
  "prevEventId": "evt_..."     // optional chain reference
}
```

### 3.5 Payment security model

x402's Hedera `exact` scheme has **no nonce field and no cryptographic binding between the
signed transaction and the resource being purchased** (unlike EVM's `authorization.nonce`).
Resource identity travels only in the client-asserted, unsigned `accepted` block. Cred402
closes this with defence in depth:

1. **Hedera-native** — a transaction ID is single-use on-ledger; resubmission yields `DUPLICATE_TRANSACTION`.
2. **Server-side ledger** — `payment_settlements.transaction_id` carries a `UNIQUE` constraint, so any given settled transaction can unlock **exactly one** report, ever (first-use-wins binding).
3. **Independent settlement proof** — we never take the facilitator's word for it; Mirror Node must confirm `SUCCESS` and an exact-amount credit to `payTo`.
4. **Resource-bound nonce** — issued in the 402, stored with TTL against `{requestId, nonce}`, burned on use. Carried in the transaction memo *if* the client scheme exposes memo control (to be confirmed against `@x402/hedera` API surface; if not exposed, layers 1–3 stand and the residual gap is documented honestly in `KNOWN_LIMITATIONS.md`).

### 3.6 Database portability

Single `DATABASE_URL` abstraction. No provider-specific SQL.

- **Local dev/test with no server:** PGlite (embedded Postgres, WASM) — no Docker/psql needed.
  This machine has neither installed, so this is the default local path.
- **Local dev with a server / Neon:** `postgres.js` driver over `DATABASE_URL`.
- **Production (Render):** same driver, same migrations, `?sslmode=require`.

Switching providers = change one env var + run migrations. Nothing else.

---

## 4. Phased execution

| # | Phase | Exit criteria (evidence required) |
|---|---|---|
| 0 | Inspection, plan, tracker | Mockups reviewed, scaffold builds, plan + progress committed |
| 1 | Database, schema, migrations, seed | Migrations apply clean, seed idempotent, tests pass |
| 2 | Hedera + HCS layer | Topic created, event submitted, Mirror Node retrieval verified |
| 3 | Certificate + demo data | 10–15 PDFs generated, tampered pair hashes provably differ |
| 4 | Verification engine + protected API | All six credential states return correct verdicts under test |
| 5 | x402 flow | Real 402 → real testnet settlement → report released; replay rejected |
| 6 | Frontend + animations | All mockup states implemented, reduced-motion honoured, responsive |
| 7 | Test suite | All section-16 tests written and running |
| 8 | Fix, harden, retest | Lint + typecheck + tests + prod build all green; security review done |
| 9 | Docs + handoff | All 12 docs written; owner acceptance checklist actionable |

**Completion rule:** no phase is marked COMPLETE on "code was written". Each needs passing tests,
a successful build, or verified runtime output recorded in `PROGRESS.md`.

---

## 5. Agent assignments

Specialist agents are dispatched per workstream; the orchestrator reviews every output before
accepting it.

| Agent | Workstream | Phase |
|---|---|---|
| Research / x402 | Protocol + SDK reality check | 0 ✅ complete |
| Database Agent | Schema, Drizzle, migrations, seed, portability | 1 |
| Hedera & HCS Agent | Client, topic, events, Mirror Node, HashScan | 2 |
| Certificate Agent | PDF generation, tampering, sample catalogue | 3 |
| Verification Agent | Hashing, upload validation, engine | 4 |
| x402 Agent | 402 flow, settlement, replay protection, agent client | 5 |
| Frontend & Motion Agent | One-page experience, branding, animation | 6 |
| QA Agent | Full test suite | 7 |
| Hardening Agent | Root-cause fixes, security review | 8 |
| Docs Agent | All documentation + handoff | 9 |

---

## 6. Owner-blocking requirements

Only these genuinely require the owner. Everything else proceeds autonomously.

| # | Requirement | Why it blocks | Workaround while waiting |
|---|---|---|---|
| 1 | Hedera Testnet **operator** account ID + private key (from portal.hedera.com) | Cannot create the HCS topic, submit real events, or receive payment without it. Keys are secrets and must never be invented. | Build the full path; run in **unconfigured mode** with clearly-labelled offline fixtures until keys arrive. |
| 2 | Hedera Testnet **demo payer** account (second account, funded) | Payer and recipient must be distinct accounts for a valid transfer. | `scripts/create-demo-wallet.ts` derives and funds it from the operator once #1 exists — so this is *not* a separate ask. |
| 3 | Authorization to spend testnet HBAR | Settlement is a real (valueless testnet) transaction; the brief forbids irreversible external actions without consent. | Testnet HBAR has no monetary value; will confirm before first live settlement. |
| 4 | Render + GitHub account actions (deploy, push) | Explicitly out of scope without authorization. | Full deployment docs prepared; owner executes. |

No other decisions will be escalated.

---

## 7. Non-goals (scope control)

Explicitly **not** building: university onboarding, real identity verification, NFT credentials,
multi-chain support, admin permissions, OCR, AI verification logic, messaging, subscriptions,
social profiles, dashboards, or marketing subpages. Verification is deterministic by design.
