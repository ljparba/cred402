# Cred402 — Implementation Plan

> Pay-per-use credential verification on Hedera.

**Status:** living document. Updated whenever architecture or implementation changes.
**Last updated:** 2026-07-21

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
4. **Resource-bound nonce** — issued in the 402, stored with a TTL against `{requestId, nonce}`, and burned on use. **Confirmed final design:** the Hedera `exact` scheme cannot cryptographically bind the nonce into the signed transaction, so the nonce provides **challenge freshness / TTL only**. Replay protection therefore rests entirely on layers 1–3 above — Hedera single-use transaction IDs, the DB-`UNIQUE` settlement `transaction_id`, and independent Mirror Node verification — which stand regardless of the nonce. This residual scheme gap is documented honestly in `KNOWN_LIMITATIONS.md`.

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

---

## 8. Enhancement update — responsive UI, `/how-it-works`, and Create Tamper Demo

This update adds three connected improvements without changing the core model. Design decisions:

### 8.1 Navigation + routing
`/how-it-works` becomes a **real Next.js route** (`src/app/how-it-works/page.tsx`), never a homepage
anchor. The single-page verification flow stays on `/` (state machine). Nav: Logo → `/`,
How It Works → `/how-it-works`, Samples → `/#samples`, GitHub → `NEXT_PUBLIC_GITHUB_URL`,
Verify another → `/` scan state. A shared `SiteNav` works from every state and on mobile.

### 8.2 Homepage layout
- **Row 1:** Sample Certificates, full-width responsive grid (4→3→2→1 by breakpoint).
- **Row 2:** How It Works *preview* (compact, links to `/how-it-works`) left, Live Activity right.
- Mobile: hero feature cards, the four stats, samples, and activity are all **one per row**
  (no cramped 2×2). Global horizontal-overflow audit at 320/360/390/430/768px.

### 8.3 Create Tamper Demo — maximal reuse
A demo registration is a **synthetic credential under the existing `ISS-CRED402-DEMO` issuer**, so
the existing deterministic engine and x402 report gate handle everything — no new verdict logic.

- **Register** (`POST /api/demo/register`, multipart `file` + optional `label`): validate → hash in
  memory → generate `demoCredentialId` (`CRED-DEMO-<rand>`) → insert a `credentials` row
  (`source='demo'`, issuer forced to `ISS-CRED402-DEMO`, `sha256=originalHash`, status ACTIVE) +
  a `CREDENTIAL_ISSUED` `credential_events` row → **when configured**, submit to HCS + record
  `hcs_records`. Returns `demoCredentialId`, hash, HCS coords + HashScan link (or `anchored:false`
  in unconfigured mode). The uploaded file is never persisted.
- **Re-verify the modified copy:** `POST /api/verify` gains an optional `credentialId` field used as
  the engine's `claimedCredentialId`. Modified file + `demoCredentialId` → hash mismatch + HCS
  evidence exists → **TAMPERED**, released through the **existing genuine x402 report gate** (or
  `?demo=1` in unconfigured mode). Original file → **VALID**.
- **Lookup:** `GET /api/demo/[demoCredentialId]` returns the demo registration + proof.

Honest MVP boundary: the stable `demoCredentialId` MUST be supplied explicitly on re-verification
(a modified arbitrary file has a different hash and usually no embedded ID). No OCR, no visual match.

### 8.4 Schema changes (minimal, migration `0001`)
- `credentials.source` — `text` `$type<'seed'|'demo'>` default `'seed'` (synthetic/demo marker).
- `rate_limit_hits` — `id` PK, `key` (`demo_register:<ipHash>`), `at` timestamptz, indexed on
  `(key, at)`. Powers the **DB-backed** limiter (portable across PGlite/Postgres; reliable across
  Render instances, unlike in-memory). Old rows pruned opportunistically.

The HCS envelope reuses the versioned `CREDENTIAL_ISSUED` shape (v, type, eventId, credentialId,
issuerId, sha256, issuedAt, status) — minimal proof only; no file bytes or personal data on-chain.

### 8.5 Abuse protection (`/api/demo/register` writes to HCS)
Feature flag `TAMPER_DEMO_ENABLED` (**default false**), testnet-only guard, strict upload validation
+ existing `MAX_UPLOAD_SIZE`, DB-backed rate limit (default **3 / IP / hour**), issuer **forced**
server-side to `ISS-CRED402-DEMO` (no client issuer/topic/payer), sanitized labels, no raw-file
storage, safe-metadata logging only, clean typed errors (403 disabled / 403 not-testnet /
429 rate-limited / 415 invalid file). IP is hashed before storage.

### 8.6 New environment variables
`TAMPER_DEMO_ENABLED=false`, `TAMPER_DEMO_RATE_LIMIT_MAX=3`,
`TAMPER_DEMO_RATE_LIMIT_WINDOW_SECONDS=3600`, `NEXT_PUBLIC_GITHUB_URL`.

### 8.7 Testing + safety
Because the deployment is now **configured** (live testnet keys), all automated tests run on the
**offline/deterministic** path and never call `POST /api/pay` or `POST /api/demo/register` live. The
live HCS anchor + x402 settlement remain **owner acceptance steps**. Responsive checks are
deterministic layout assertions + an owner browser checklist (no headless browser installed).

## 9. Final frontend layout & mobile refinement (supersedes §8.2)

A layout/usability pass only — no changes to the Hedera/HCS/x402/verification/DB behavior. This
section is authoritative for the homepage/report/upload layout; §8.2 is superseded.

### 9.1 Header logo → always `/`
The shared `Nav` logo stays a **real `<Link href="/">`** (never a scroll anchor), keyboard-focusable
with a visible focus ring. It gains an optional `onLogoClick`; the homepage passes `goHome`, which
resets the in-page flow state machine to the landing stage and scrolls to the top — so the logo
"returns home" even from an in-page flow stage (scan / payment / progress / report), where a plain
same-route link would be a no-op. From every other route the link navigates normally.

### 9.2 Hero right column → Live Activity
The hero's right column previously repeated the HCS/x402/tamper "proof cards" already shown
elsewhere. It now renders the real **`LiveActivity`** feed (recent HCS/payment/verification items
with HashScan links, contained vertical scroll). `Hero` takes `activity`/`activityLoading`/`now`
from the page. On mobile the three hero areas (headline+CTAs+feature cards, scanner, Live Activity)
each become one full-width row.

### 9.3 Homepage order (final)
Header → Hero (content · scanner · Live Activity) → Stats → **How It Works preview (35%) + Sample
Certificates (65%)** as a responsive `lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]` row → **Original
vs. Tampered — Create Tamper Demo** full-width band (`TamperDemoTeaser`, CTA → `/how-it-works#tamper-demo`,
concise synthetic-data disclaimer; it does **not** duplicate the full `/how-it-works` workflow) →
Footer. Samples keep their 4→3→2→1 responsive grid and all actions. Mobile: one full-width section
per row in reading order.

### 9.4 Upload/scan sidebar + Sample Files
Right column order is **Sample Files → Scan Process → Issuer Hints** (Scan Process moved above Issuer
Hints). Sample Files drops the unreliable **“View All”** link and lists **all** samples in a
contained vertical scroll (`max-h` + `overflow-y-auto`, never horizontal), preserving status/type
labels and select behavior.

### 9.5 Final report cleanup
The **Reference Samples** box is removed (and with it the `samples`/`onUseSample` props on `Report`
and its callers). New layout: a top row of **Credential · Verdict · Payment Proof** (verdict leads on
mobile via `order-*`), then a wide **Verification Checks** area beside a supporting column of **HCS
Proof + Verification Activity**, aligned from the top with tighter gaps and no tall empty columns.
Long values keep `min-w-0` + `break-all`/middle-truncation + copy buttons + HashScan links.

### 9.6 Mobile scan-progress scroll fix
Root cause: `SystemLog` called `endRef.scrollIntoView()` on every new log line, which scrolls **all**
scroll ancestors including the window — on mobile this yanked the page down each ~850 ms during
scanning and felt like a scroll-lock. Fix: scroll only the log panel's **own** container
(`el.scrollTop = el.scrollHeight`), and only when the reader is already near the bottom. The
scan-progress layout uses normal document flow — no `position: fixed`, no `100vh`/`h-screen`, no body
scroll-lock; live logs keep a small internal scroll while the page scrolls freely both ways.

### 9.7 Test-isolation fix (supporting)
The DB-backed `engine.test.ts` silently used the dev DB `./.pglite` because `scripts/seed` imports
`scripts/lib/env` (loads `.env`, which sets `PGLITE_DATA_DIR=./.pglite`) during the import phase,
before the test's own `||=`. With a `next dev` holding that single-writer dir open, PGlite aborted.
Fixed with a first-evaluated `tests/lib/isolate-db.ts` that pins `./.pglite-test` before `.env` is
read, matching the test's documented "never touches your dev DB" intent.

### 9.8 Frontend tests
No DOM/E2E runner is wired up, so `tests/frontend-layout.test.ts` adds **structural guards** (read the
component source; assert stable tokens: the logo `/` route link, Live Activity in the hero, the 35/65
row, the Tamper Demo section, the upload sidebar order + no “View All”, the report’s Reference-Samples
removal + new layout, and the system-log container-scroll fix). Human-eye responsive checks (320 /
360 / 390 / 430 / 768 / desktop) are the owner browser checklist in `OWNER_ACCEPTANCE_TEST.md` Part C.

## 10. Final frontend, responsive, security & docs closeout

The closeout pass — Sample-card + laptop-header polish, the two remaining broken mobile states, a
security review, and doc corrections. No product/behavior changes.

### 10.1 Sample Certificate cards
Card content order is now preview → **status badge on its own row, above the title, aligned left**
(no longer inline beside the title) → title (up to 3 lines) → clamped description → bottom-aligned
actions with the **full "Use this sample" label** (the truncating span is gone) and a same-height
download button. Responsive grid `grid-cols-1 md:grid-cols-2 2xl:grid-cols-3` — **1 column on mobile,
2 on tablet/laptop, 3 only at 1536px+** (the panel is only 65% of the desktop row, so 3-up is too
cramped on a normal laptop). Cards are `h-full min-w-0` so a row keeps consistent height with no
overflow; status colors, keyboard access, and focus states are preserved.

### 10.2 Compact laptop header
Three tiers: `< 1024px` mobile (logo + compact circular verify icon + slide-down drawer); `1024–1535`
compact laptop (tighter gaps, compact Verify pill, the network badge shortened to "Hedera Testnet",
the redundant circular Hedera icon hidden); `1536px+` full desktop ("Built on Hedera Testnet",
comfortable spacing, icon shown). The mobile/desktop boundary moved from `md` (768) to `lg` (1024) so
laptop widths get the one-line compact header instead of a crowded desktop row. The logo stays a real
`<Link href="/">`; keyboard nav + visible focus preserved.

### 10.3 Upload / Ready-to-Scan mobile
Single column below `xl` with a full-width upload box and preview (`max-w-full`), the **Begin Scan /
Continue buttons full-width on mobile** (`w-full sm:w-auto`), 16px page padding, and the Sample Files
list back in **normal document flow** on mobile (its internal scroll is gated to `xl:` so there's no
nested scroll trap). Long filenames wrap (`break-words`). All upload validation/scan behavior intact.

**Width-overflow root-cause fix.** The concrete overflow source was the 4-step **progress rail**: a
non-`w-full`, `justify-center` flex with **fixed-width connectors** (`w-8` / `sm:w-14`) and
non-shrinking labels, giving it a ~340px intrinsic width that overflowed a ~288–360px phone column.
`StepProgress` is rebuilt as a shrink-safe `grid w-full min-w-0 grid-cols-4` rail — connectors are
half-width absolutely-positioned lines flanking each circle (no fixed widths), labels `truncate`. In
addition, the main workspace grid is `grid-cols-1` (3-col only at `xl`), the inner scanner grid is
`grid-cols-1` (2-up only from `sm`, dropping the phantom `auto` track on mobile), and **every** grid/
flex child + `motion.div` + card carries `w-full min-w-0 max-w-full` (cards `overflow-hidden`). The
certificate preview media is `w-full min-w-0 max-w-full`, capped to a comfortable size only from `sm`
(`sm:max-w-md`) so it can never exceed a narrow parent. No fixed-pixel or `min-w-[…]` utilities remain
in the scan-state tree (only the page container's `max-w-[1440px]`).

### 10.4 Post-payment Verification Progress mobile
Single-column below `xl` in the correct order (title → certificate preview → checks → overall
progress → live logs → Proof & Trace). Same width-overflow audit as §10.3: the main grid is
`grid-cols-1` (3-col only at `xl`); every column, check card, progress wrapper, log panel, and Proof &
Trace card is `w-full min-w-0 max-w-full` (`overflow-hidden` on cards); check labels/evidence
`break-words`; hashes use `min-w-0`/`truncate`/`break-all`; Proof & Trace stacks
(`grid-cols-1 sm:grid-cols-2`). The log auto-scroll (from §9.6) only moves the log container — never
the page. No `position: fixed`, no `100vh`/`h-screen`, no body scroll-lock; the page scrolls freely
while processing; reduced-motion preserved.

### 10.5 Security review (verify-and-preserve; no code changes)
Confirmed intact: **secrets** — no secret **values** reach the client bundle (`/` client chunks were
scanned: no private-key/DER/64-hex material), `/api/health` returns booleans + public endpoints
(never key values or the raw recipient), and logs use a hash prefix + a SHA-256-hashed IP. One
minor, non-leaking finding + recommendation: because client components (Nav, Footer, `hashscan.ts`)
import `publicConfig` from the same `src/lib/config.ts` that also reads server env vars, the server
env-var **names** (e.g. `HEDERA_OPERATOR_PRIVATE_KEY`) appear as string literals in a client chunk.
No **values** are inlined — Next.js only inlines `NEXT_PUBLIC_*`, and a browser `process.env[name]`
is `undefined` — and the names are already public in `.env.example`, so this is hygiene, not a leak.
*Recommendation (not implemented — avoids an architecture change to working, non-leaking code):*
split `publicConfig` into its own `src/lib/public-config.ts` so the server-config module never enters
the client bundle at all.
**Uploads** — magic-byte sniff (PDF/PNG/JPEG), size + empty + declared-type-mismatch rejection, never
persisted. **Tamper Demo** — flag off by default, testnet-only, issuer forced server-side (no
client-chosen issuer/topic/payer), DB-backed 3/IP/hour limit with SHA-256-hashed IP, minimal HCS
proof (no bytes/PII), synthetic/demo/testnet/demo-issuer labels, disclaimer before + after.
**General `/api/verify`** — no global rate limit (documented honestly; recommend edge limits for
production). **x402** — no verdict/checks leak pre-payment, configured mode ignores `?demo=1`,
replay-check-first, DB-UNIQUE single-use tx binding, independent Mirror confirmation of SUCCESS +
exact amount + recipient, idempotent re-access, 409 on reuse, no client claim trusted without Mirror.
**HCS** — minimal proof only, correct HashScan links, Mirror lag handled, re-seeding never re-anchors.
**Errors** — `safeHandler` returns typed clean errors with no stack traces; no live writes on render;
state changes require explicit clicks.

### 10.6 Documentation corrections
`KNOWN_LIMITATIONS.md` §1 rewritten: **live HCS anchoring + x402 settlement were owner-verified on
Hedera Testnet** (real topic/messages, completed HBAR settlement, Mirror confirmation, HashScan
proof — owner-run acceptance; mainnet out of scope; no secrets/tx details recorded). Rate-limiting is
documented per-endpoint (Tamper Demo DB limit vs no global limit on general verification) across
KNOWN_LIMITATIONS / PROGRESS / this plan. Stale "owner-blocked / not executed" wording corrected in
README, PROGRESS, HEDERA_SETUP, X402_FLOW; test counts updated to **58**; sample-grid breakpoints and
bundle sizes refreshed; OWNER_ACCEPTANCE_TEST Part C extended.
