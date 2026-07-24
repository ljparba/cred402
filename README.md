# Cred402

> Accountless, pay-per-use credential verification on Hedera using x402 payments and tamper-evident HCS records.

[![CI](https://github.com/ljparba/cred402/actions/workflows/ci.yml/badge.svg)](https://github.com/ljparba/cred402/actions/workflows/ci.yml)
[![Hedera Testnet](https://img.shields.io/badge/Hedera-Testnet-8259ef)](https://hashscan.io/testnet)
[![x402 v2](https://img.shields.io/badge/x402-v2-1c1c1c)](https://x402.org)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](#license--disclaimer)

Cred402 checks whether a credential file has been altered since it was issued — with no account or
login for the person verifying. Upload a file; the server validates and hashes it and returns a
**free, locked preview**. The **full report** is gated behind a genuine HTTP `402 Payment Required`
response; the caller settles a small **testnet HBAR** payment through the **x402** protocol, the
server independently re-confirms the settlement on the **Hedera Mirror Node**, and only then releases
a deterministic, machine-readable report backed by tamper-evident **Hedera Consensus Service (HCS)**
records.

**This is a Hedera Testnet proof of concept.** All sample credentials and issuers are synthetic; all
payments use valueless testnet HBAR. It is not a production identity or credentialing system.

---

## Live app & links

| | |
|---|---|
| **Live app** | https://cred402-yxwk.onrender.com |
| **Source** | https://github.com/ljparba/cred402 |
| **HCS topic (HashScan)** | https://hashscan.io/testnet/topic/0.0.9651085 |
| **Settlement transaction (HashScan)** | https://hashscan.io/testnet/transaction/0.0.9185802-1784718257-721825634 |
| **Demo video** | _Pending_ |

Automated gates are green: `npm test` **158/158** (incl. **52** structural frontend guards, **15**
UI-truthfulness guards, the Phase-2 payment-safety suites, and the Phase-3 retention-cleanup and
activity-cache suites; the DB-backed suites use isolated PGlite directories, close them, and exit
naturally), `npm run verify:samples` **7/7**, plus `lint`, `typecheck`, a production build, a
GitHub Actions CI workflow, and a local production smoke test — all passing. The full flow is
**verified live on Hedera Testnet**: a real x402 v2 HBAR settlement with independent Mirror Node
confirmation and HCS evidence, plus **B6 replay-rejection (PASS)** and **B7 idempotent-re-access
(PASS)** live. **B8 concurrent-same-request payment protection** is covered by an automated,
isolated acceptance test (not a live run). See [Live Hedera Testnet evidence](#live-hedera-testnet-evidence).

---

## What Cred402 does

The implemented flow, in order (from the API code):

```
Upload → validate + SHA-256 hash → identify credential → locked preview
       → HTTP 402 → x402 HBAR settlement → independent Mirror Node confirmation
       → deterministic report + HCS evidence
```

- **No account, login, or wallet connect** is needed to upload and get the free preview.
- The paywall is a **real HTTP 402** — not a donate button or an "I paid" checkbox.
- In **configured mode**, settlement is a **real testnet HBAR transfer**, then independently
  re-verified on the Mirror Node — the server never takes the facilitator's word for it.
- Verification is **deterministic** (six checks, no AI). Every result cites HCS evidence.

## Problem & approach

- Digital credentials can be **edited after issuance** — a PDF that "looks right" may have changed.
- Verification is often **manual** and locked behind per-issuer portals.
- Applications and autonomous agents need a **machine-readable, pay-per-call** verification flow.

Cred402 demonstrates a small, deterministic mechanism: an issuer anchors a **minimal proof** (a hash
plus ids and a timestamp — never the file) on HCS; anyone can later check a file against that anchor
and pay per report through x402. The same accountless path serves both humans and machines.

## Original vs. tampered (flagship demo)

Two certificates that look **visually identical**, both for credential `CRED-2026-0004`:

| File | Verdict | Why |
|---|---|---|
| `samples/valid/data-structures-original.pdf` | **VALID** | Its SHA-256 matches the HCS-anchored issuance hash for `CRED-2026-0004`. |
| `samples/tampered/data-structures-tampered.pdf` | **TAMPERED** | The grade was edited after issuance. The credential ID still resolves and HCS evidence still exists, but the SHA-256 **no longer matches** the anchor. |

The report shows a byte-level hash diff and explains that the file changed after issuance. Note that
**SHA-256 detects that the bytes changed — it does not, by itself, prove who issued a document.** HCS
anchors the reference proof that the deterministic engine compares each upload against.

## Verification outcomes

The engine resolves to exactly six verdicts (defined in `src/lib/db/schema.ts`):

`VALID` · `TAMPERED` · `EXPIRED` · `REVOKED` · `UNREGISTERED_ISSUER` · `UNKNOWN`

## How Hedera is used

Only implemented uses (all on **Hedera Testnet**):

- **HCS** — minimal issuance/revocation event records: a hash, ids, a status, and a timestamp. No
  file bytes or personal data are written on-chain.
- **Native HBAR payment** — the x402 exact scheme with HBAR asset `0.0.0`.
- **Mirror Node** — independent confirmation of settlement (result `SUCCESS`, exact amount to the
  configured recipient) before any report is released.
- **HashScan** — public deep links for transactions and topics.
- **`@hiero-ledger/sdk`** — the vendor-neutral Hedera SDK.

## How the x402 flow works

Cred402 uses **genuine x402 v2** with the real header names:

- **`PAYMENT-REQUIRED`** — the 402 challenge the server returns (base64 JSON) advertising the accepted
  payment requirements.
- **`PAYMENT-SIGNATURE`** — the client's signed Hedera `TransferTransaction`, sent on the retry.
- **`PAYMENT-RESPONSE`** — the settlement response returned with the released report.

- **Native HBAR asset `0.0.0`**; the configured price defaults to **0.1 HBAR = `10000000` tinybars**
  (`X402_PRICE`).
- The official **facilitator** (`https://x402.org/facilitator`) advertises a **fee-payer** and
  co-signs/submits the transaction (**fee sponsorship**); the client builds and signs the transfer.
- Before releasing the report, the server **independently re-verifies** the settlement on the Mirror
  Node (SUCCESS + exact tinybar amount + recipient) and records the transaction ID under a
  **first-use-wins** uniqueness constraint.

The Hedera exact scheme is a **partially-signed transaction with facilitator fee sponsorship**, not an
EVM-style signed authorization. The value carried in the challenge is a **server-side request expiry
token (a TTL / challenge-freshness window)**, **not a cryptographically resource-bound nonce** — the
Hedera exact scheme has no nonce field, so it is not part of the signed payment payload. Replay and
double-settle protection comes from four independent, layered controls:

- an **atomic per-request payment claim** (`verification_requests.payment_state`,
  `UNPAID → PAYMENT_IN_PROGRESS → PAID`) so only one caller enters the settlement-critical section;
- a **single-use transaction ID** (`UNIQUE(payment_settlements.transaction_id)`) — a settled tx
  unlocks exactly one report, ever;
- a **one-settlement-per-request** database backstop (`UNIQUE` on the settled `request_id`); and
- **independent Mirror Node confirmation** (SUCCESS + exact tinybar amount + recipient) before any
  report is released.

The 402 challenge, header formats, the concurrency-safe critical section (`payment-flow.ts`), and the
settlement flow live in `src/lib/x402/` and `src/app/api/report/[requestId]/route.ts`.

## What the public UI shows

The landing page states only what the implementation can back:

- **Headline statistics come from `GET /api/activity`** — real counts from this deployment's own
  database. There are no growth percentages, no average-verification-time figure, and no sample or
  placeholder values anywhere in the row.

  | Label | Counted from |
  |---|---|
  | **Registered Credentials** | rows in `credentials` (registered — not a claim that each is anchored) |
  | **Verification Requests** | rows in `verification_requests`, **including locked / unpaid requests** |
  | **HCS Records** | rows in `hcs_records` once anything has been anchored on Hedera; otherwise the local offline event fixtures (`credential_events`) |
  | **x402 Settlements** | `payment_settlements` rows with status `SETTLED` (a failed settlement is not counted) |

- **Configured vs. unconfigured** — the endpoint returns `hcsSource: "network" | "fixture"` alongside
  the count. In unconfigured/offline mode nothing is anchored, so the HCS card shows the local event
  fixtures and says so (*"Local demo fixtures — not live network records"*). Fixture data is never
  presented as live network activity.
- **Loading and failure** — while the request is in flight the row shows `—` / *Loading*; if it fails
  with no earlier real values, `—` / *Unavailable*. Zeros or fallback numbers are never displayed,
  and the count-up animation only runs on real values.
- **Live feed cadence** — the homepage refreshes `GET /api/activity` roughly every **30 seconds** (the
  first fetch is immediate). Recurring polling **pauses while the tab is hidden** and resumes with a
  fresh fetch on return, only one request is ever in flight, and a failed refresh **keeps the last
  known-good values** on screen (never replaced with zeros). The endpoint carries a short **public**
  shared-cache header (`Cache-Control: public, max-age=0, s-maxage=15, stale-while-revalidate=30`) so a
  CDN can absorb the poll — it holds only public aggregate/feed data, with no server-side memory state.
- **One payment action** — the 402 screen offers a single button, **`Use Demo Wallet · <price> tHBAR`**
  (price from the live 402 challenge), which calls `POST /api/pay`: the built-in **server-side testnet
  demo wallet**. There is no wallet connect and no second, different payment method — agents settle
  the same 402 themselves through the API.
- **No settlement-time promise** — the UI states implemented properties (tamper-evident HCS record,
  public Hedera Testnet evidence, deterministic tamper check, independent Mirror Node confirmation)
  instead of an expected number of seconds.
- **The hero certificate panel is illustrative** — fixed example content labelled *Illustrative
  preview* / *Sample anchored credential*, not the result of a live verification and not live network
  statistics. Only the hero's Live Activity feed shows real data.

## Security & privacy

Confirmed behavior in the current code:

- **Accepted uploads:** PDF, PNG, JPEG only. Maximum per-file size **5 MB** (`MAX_UPLOAD_SIZE`,
  default `5242880` bytes), checked after parsing. A separate **early request-body guard**
  (`MAX_UPLOAD_REQUEST_SIZE`, default 6 MB) rejects a clearly-oversized upload with **413
  `PAYLOAD_TOO_LARGE`** from its declared `Content-Length` **before the body is parsed**; a missing or
  understated `Content-Length` still falls through to the authoritative per-file check. This
  complements (does not replace) any deployment/proxy body limit.
- **Magic-byte sniffing** — the real leading bytes are authoritative; a declared type that disagrees
  with the bytes, and empty or oversized files, are rejected.
- **In-memory processing** — uploaded files are validated and hashed in memory; **raw file bytes are
  not stored by the application**.
- **No file bytes or PII on HCS** — only a hash, ids, a status, and a timestamp.
- **The free preview never contains the verdict or the checks**; the full report is released only
  through the 402 / x402 path.
- **One settlement per request** — a request is settled at most once. An **atomic per-request payment
  claim** (`payment_state`) admits only one caller to the settlement-critical section, so two
  concurrent callers can never both settle; a database `UNIQUE` on the settled `request_id` backs this
  up. Exact recipient and exact tinybar amount are verified on the Mirror Node before release; a
  settled transaction ID unlocks exactly one report (first-use-wins); re-accessing a paid report is
  idempotent (no second charge, same transaction ID).
- **Safe payment failures** — a failure that provably preceded submission releases the claim and may
  be retried; an **uncertain or post-submission** failure parks the request (`PAYMENT_CONFIRMATION_PENDING`)
  and **never reopens it for another payment**. Nothing is auto-retried in a way that could send a
  replacement payment.
- **Public-endpoint rate limits** — `POST /api/verify` (default **20/IP/hour**) and `POST /api/pay`
  (stricter, default **5/IP/hour**, because it spends real testnet HBAR) are **DB-backed** and per
  **hashed** IP (the raw IP is never stored or logged). Over-limit requests return **429 `RATE_LIMITED`**
  with a `Retry-After` header. `POST /api/demo/register` keeps its own limit (default **3/IP/hour**).
  Rate limits are a best-effort abuse brake and do not replace the per-request payment lock.
- **Private responses** — every response that can carry user-specific verification or payment data
  (`/api/verify`, `/api/pay`, `/api/report/:id`, `/api/demo/register`, `/api/demo/:id`) is sent with
  `Cache-Control: private, no-store` and `Pragma: no-cache`, on success and error alike. The one
  cacheable route is the **public** aggregate feed `GET /api/activity` (short shared cache, no
  user-specific data); its sanitized generic 500 is never marked cacheable.
- **Baseline security headers** — every response carries `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `X-Frame-Options: DENY`.
- **Expired requests** — an unpaid request that outlives its TTL returns **410 `REQUEST_EXPIRED`**
  (re-upload); no fresh 402 is issued, the TTL is never silently refreshed, and a supplied payment
  signature is rejected before any facilitator call. A **paid** report stays accessible after expiry.
- **No secret leakage** — no private key, `PAYMENT-SIGNATURE`, signed transaction bytes, raw IP, or
  database secret is ever logged or returned; payment errors surface only stable, safe codes.
- **Configuration is reported honestly** — `GET /api/health` exposes three independent booleans
  (`config.hcsWriteConfigured`, `config.x402SettlementConfigured`, `config.demoWalletConfigured`) and
  public identifiers/URLs only — never a key or signature.

Not implemented (and not claimed): OCR, visual/content matching, malware scanning, issuer identity
verification, or universal fraud detection.

## Architecture

```
Browser / Agent
      │  POST /api/verify   (multipart file: PDF / PNG / JPEG)
      ▼
Validate (magic-byte + size)  →  SHA-256 (in memory)  →  identify credential (hash or embedded id)
      ▼
Locked preview (no verdict / no checks) + requestId
      │  GET /api/report/{requestId}
      ▼
HTTP 402  — x402 v2 challenge (PAYMENT-REQUIRED)  ──▶  client signs a Hedera TransferTransaction
      ▼  retries with PAYMENT-SIGNATURE
Facilitator verify + settle  (real testnet HBAR transfer, fee-sponsored)
      ▼
Independent Mirror Node confirmation (SUCCESS + exact amount + recipient) + single-use tx id
      ▼
Deterministic report (six checks → one verdict) + HCS evidence + HashScan links
```

The implementation lives under `src/lib/` (`config`, `db`, `hedera`, `x402`, `verify`) and
`src/app/api/`.

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**, **Tailwind CSS v4**, **framer-motion**
- **`@hiero-ledger/sdk`** — the vendor-neutral Hedera SDK (do not also install `@hashgraph/sdk`)
- **x402 v2** — `@x402/core`, `@x402/hedera`, `@x402/fetch`; official facilitator
  `https://x402.org/facilitator`
- **Drizzle ORM** over a single `DATABASE_URL` abstraction: **PGlite** (embedded, local) when
  `DATABASE_URL` is unset, **postgres.js** (Neon dev / Render prod) when set
- **pdf-lib** (sample generation), **zod** (validation), **lucide-react** (icons)
- **Hedera Mirror Node** + **HashScan** (testnet)

## Quick start (local, zero external services)

Requires **Node.js 20+** (declared as `"engines": { "node": ">=20" }` in `package.json`). No Postgres
server, Docker, or Hedera account needed — the app uses an embedded [PGlite](https://pglite.dev)
database and offline fixtures by default.

```bash
npm install
npm run db:setup        # migrate + seed the embedded PGlite DB
npm run certs:generate  # render the demo certificate PDFs (incl. the tamper pair)
npm run db:seed         # re-seed so anchored hashes match the generated files
npm run dev             # http://localhost:3000
```

Upload a file from `samples/` (or download one from the app's Sample Certificates panel) and request
a report.

- **Unconfigured / offline review mode** (default, no keys): the app builds and runs, HCS evidence is
  a local pre-anchor fixture, and `GET /api/report/{id}` still returns a genuine 402. A `?demo=1`
  report view lets reviewers see the full report UI with settlement clearly labelled *simulated*.
- **Configured Hedera Testnet mode** (operator + demo-payer keys set): real HCS anchoring and a real
  x402 testnet settlement; the `?demo=1` bypass is ignored.

Check the current mode any time: `GET /api/health` reports `"mode": "configured"` or `"unconfigured"`.
Reset the local DB with `npm run db:reset` (deletes the PGlite data dir, then re-migrates + re-seeds;
refuses to run if `DATABASE_URL` is set). Never include real private keys in examples.

## Environment setup

Copy [`.env.example`](.env.example) to `.env.local` and fill in values as needed. Nothing is required
to build or run in unconfigured mode.

- **Public values** (safe in the browser, prefixed `NEXT_PUBLIC_*`): app URL, Hedera network, HashScan
  base URL, GitHub URL.
- **Secrets** (server-only, never commit): `HEDERA_OPERATOR_PRIVATE_KEY`, `X402_DEMO_PAYER_PRIVATE_KEY`,
  and any real `DATABASE_URL`. Account IDs and the HCS topic ID are public identifiers, not secrets.
- `.env*` is gitignored except `.env.example`; **never commit `.env.local`**.

For **configured Hedera Testnet mode**: create a testnet operator account at
[portal.hedera.com](https://portal.hedera.com) and set `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_PRIVATE_KEY`;
then run `npm run hedera:create-topic` (sets `HEDERA_HCS_TOPIC_ID`), `npm run hedera:anchor` (writes the
issuance/revocation events), and `npm run hedera:create-wallet` (creates the demo payer → `X402_DEMO_PAYER_*`),
and set `X402_PAYMENT_RECIPIENT`. These scripts perform live testnet writes and are owner-run. All
variables and their comments are in [`.env.example`](.env.example).

## Scripts

From `package.json`:

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev / production build / production server |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Node's built-in test runner (via `tsx`) — the full suite |
| `npm run verify:samples` | Run every sample through the real engine and assert its verdict |
| `npm run db:migrate` / `db:seed` / `db:reset` / `db:setup` | Database lifecycle (local or `DATABASE_URL`) |
| `npm run db:cleanup` | **Owner-run** retention cleanup — **dry-run by default** (see [Operations](#operations-retention-cleanup)) |
| `npm run certs:generate` | Render the deterministic sample PDFs |
| `npm run hedera:create-topic` / `hedera:anchor` / `hedera:create-wallet` | **Owner-only, live Hedera writes** (need testnet keys) |
| `npm run agent:demo` | Machine-readable x402 client demo (prints the 402; settles only in configured mode) |

The `hedera:*` scripts and configured `agent:demo` perform **live testnet actions** and require keys.

## Operations: retention cleanup

`npm run db:cleanup` is an **owner-run** retention command for keeping a deployed database tidy. It is
**not scheduled by this repository** and never runs during install, test, build, start, migrate, or
deploy — it is only ever an explicit owner action. (A hosting scheduler *may* invoke it after review;
this repo does not configure one.)

- **Dry-run by default.** `npm run db:cleanup` prints a report of what *would* be removed and changes
  nothing:

  ```
  DRY RUN
  Policy: unpaid requests > 30d · rate-limit rows > window + 2d grace
  Unpaid verification requests eligible: 12
  Associated results eligible: 12
  Associated payment challenges eligible: 9
  Expired rate-limit rows eligible: 84
  No rows deleted.
  ```

- **Deletion requires BOTH guards** — the `--execute` flag **and** `CONFIRM_DATABASE_CLEANUP=yes`. With
  only one present it prints a dry-run and makes no changes:

  ```bash
  CONFIRM_DATABASE_CLEANUP=yes npm run db:cleanup -- --execute
  ```

- **What it removes** (conservatively): only `verification_requests` whose `payment_state` is `UNPAID`,
  older than `UNPAID_REQUEST_RETENTION_DAYS` (default **30**), and carrying no settlement row of any
  kind — plus their child preview results and 402-challenge rows (deleted first, FK-safe) — and
  `rate_limit_hits` whose window is fully inactive plus `RATE_LIMIT_RETENTION_DAYS` (default **2** days)
  of grace. Each group is transactional and the command is idempotent (safe to re-run).
- **What it always keeps.** `PAID`, `PAYMENT_UNKNOWN`, and `PAYMENT_IN_PROGRESS` requests; every
  `payment_settlements` row (settled *or* failed evidence); HCS records; credential/issuer data. Old
  `PAYMENT_UNKNOWN` / `PAYMENT_IN_PROGRESS` rows are surfaced as **reconciliation warnings only** —
  never deleted or unlocked (this phase adds no automatic reconciliation).
- **No private data in output.** The report prints counts and categories only — never a filename, hash,
  IP hash, signature, request id, or any other row content.

## API endpoints

| Route | What it does |
|---|---|
| `POST /api/verify` | Free: validate + hash an uploaded file, identify the credential, return a **locked** preview (no verdict/checks) with a request ID. **Rate limited** (default 20/IP/hour); early 413 on an oversized declared body. |
| `GET /api/report/:requestId` | **x402-gated**: returns HTTP 402 without payment; releases the full report only after an independently-confirmed settlement (idempotent on re-access). 410 `REQUEST_EXPIRED` for an expired unpaid request; 409 while another payment is in progress/pending. |
| `POST /api/pay` | Built-in demo-wallet payer (server-side x402 client) used by the UI to settle a report. **Rate limited** (default 5/IP/hour); preserves the downstream typed error codes. |
| `GET /api/samples` | The synthetic sample-certificate catalogue. |
| `GET /api/samples/:slug` | Download one sample PDF (path resolved from a trusted catalogue row). |
| `GET /api/activity` | Recent HCS / payment / verification activity for the live feed, plus the real counts (and `hcsSource`) behind the headline statistics. |
| `GET /api/health` | Readiness + configuration diagnostics (booleans and public endpoints only). |
| `POST /api/demo/register` | Create Tamper Demo: register an original file (gated by a feature flag, testnet-only, DB-backed rate limit; forced demo issuer). |
| `GET /api/demo/:demoCredentialId` | Look up a demo registration and its proof. |

These endpoints are a proof-of-concept surface; no public API stability or versioning is guaranteed.

## Samples

Seven synthetic sample certificates ship with the app (source: `scripts/data/catalog.ts`; asserted by
`npm run verify:samples`):

| Sample file | Expected verdict |
|---|---|
| `samples/valid/hedera-fundamentals.pdf` | `VALID` |
| `samples/valid/data-structures-original.pdf` | `VALID` (original of the tamper pair) |
| `samples/tampered/data-structures-tampered.pdf` | `TAMPERED` |
| `samples/expired/cybersecurity-awareness.pdf` | `EXPIRED` |
| `samples/revoked/digital-identity.pdf` | `REVOKED` |
| `samples/unregistered/web-dev-foundations.pdf` | `UNREGISTERED_ISSUER` |
| `samples/fake/counterfeit-certificate.pdf` | `UNKNOWN` |

## Continuous integration

A GitHub Actions workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the full gate on
every push and pull request to `master` (superseded runs on the same ref are cancelled). It uses
**Node.js 20** with the npm cache, `permissions: contents: read`, and a build timeout, and runs
completely **offline with no secrets**:

```
npm ci → npm run lint → npm run typecheck → npm test → npm run verify:samples → npm run build
```

Sample verification needs a seeded database, so the workflow first migrates and seeds a **fresh,
isolated PGlite directory** (`PGLITE_DATA_DIR=.pglite-ci`, `DATABASE_URL` unset). CI requires **no
Hedera account, no x402 payer key, no facilitator, no external Postgres, no production URL, and makes
no live payment or HCS write** — no secret is referenced by the workflow. The CI status badge is at
the top of this README.

## Testing & verified status

- `npm test` → **158 / 158** passing, with a natural process exit.
- **52** of those are **frontend structural guards** in `tests/frontend-layout.test.ts` — they read
  component source and assert layout/nav invariants. **They are not DOM or browser end-to-end tests.**
- **15** are **UI-truthfulness guards** in `tests/ui-truthfulness.test.ts`: 11 read the public UI and
  README source to keep removed claims removed (no growth percentages, no fixed average verification
  time, no settlement-speed promise, no blanket decentralization claim, one payment action, the hero
  sample labelled), and 4 invoke the real `GET /api/activity` handler against an isolated embedded
  database to prove each displayed statistic maps to actual rows.
- The **Phase-2 payment-safety suites** cover the concurrency and hardening invariants against
  isolated PGlite databases and mocked facilitator/Mirror dependencies (never live Hedera):
  `tests/payment.test.ts` (**B6** replay, **B7** idempotent re-access, **B8** concurrent
  same-request protection with a barrier proving facilitator settle runs exactly once, plus safe/
  uncertain failure classification and the settled-request uniqueness constraint),
  `tests/migration.test.ts` (fresh + upgrade-path migration, duplicate detection),
  `tests/rate-limit.test.ts`, `tests/http.test.ts` (early 413, no-store, security headers), and
  `tests/payment-ui.test.ts` (safe payment-failure UI states). **B8 is an automated/local acceptance
  test, not a live run.**
- The **Phase-3 operations suites** run fully offline against isolated PGlite with a controlled clock:
  `tests/cleanup.test.ts` proves the retention cleanup is dry-run by default, needs both execution
  guards, deletes only old conclusively-UNPAID settlement-free requests (children FK-safe, idempotent),
  retains paid/unknown/in-progress/settled/HCS rows, prunes only fully-expired rate-limit rows, and
  prints counts without private row content; `tests/activity-cache.test.ts` asserts the short public
  cache header on `GET /api/activity` and that the report/payment routes stay `private, no-store`.
- `npm run verify:samples` → **7 / 7** samples classify to their expected verdict.
- `lint`, `typecheck`, and the **production build** pass; a **local production smoke test**
  (`npm run start`) passed the route/API matrix (200s, genuine 402, safe typed errors, no verdict/
  secret leaks).
- **The full flow is verified live on Hedera Testnet** — a real x402 HBAR settlement with independent
  Mirror Node confirmation and HCS evidence (see [Live Hedera Testnet evidence](#live-hedera-testnet-evidence)).
- **B6 (replay rejection) and B7 (idempotent re-access)** acceptance checks **passed live** — details in
  [Live Hedera Testnet evidence](#live-hedera-testnet-evidence).

The suite lives under `tests/` and runs with `npm test` (Node's built-in runner via `tsx`).

## Live Hedera Testnet evidence

Verified on **Hedera Testnet** using **x402 v2** and the native HBAR asset `0.0.0` at a price of
**10,000,000 tinybars (0.1 HBAR)**. Independent **Mirror Node verification: true**; **HCS evidence: PASS**.

| Item | Value |
|---|---|
| Live app | https://cred402-yxwk.onrender.com |
| HCS topic | `0.0.9651085` — [HashScan](https://hashscan.io/testnet/topic/0.0.9651085) |
| HCS sequence | `25` |
| HCS transaction | `0.0.9594641-1784715422-016438799` — [HashScan](https://hashscan.io/testnet/transaction/0.0.9594641-1784715422-016438799) |
| Settlement transaction | `0.0.9185802-1784718257-721825634` — [HashScan](https://hashscan.io/testnet/transaction/0.0.9185802-1784718257-721825634) |

### Replay & re-access verification

- **Replay rejection (B6): PASS** — reusing the exact settled payment against a different, unpaid
  request returned **HTTP 409 `PAYMENT_ALREADY_CONSUMED`**; no report was released, no second
  settlement occurred, and the second request stayed locked.
- **Idempotent re-access (B7): PASS** — reopening the paid request without another payment returned
  **HTTP 200**, `paid: true`, the **same transaction ID**, and the same `TAMPERED` report — no second
  charge.

## Known limitations

- **Hedera Testnet only** — valueless testnet HBAR; not mainnet.
- **Synthetic credentials and issuers** — no real person, institution, or credential is represented.
- **No OCR or visual matching** — images are compared by hash; PDFs may also match by an embedded
  credential ID.
- **Modified arbitrary uploads need a stable Demo ID** — to prove a modified copy is `TAMPERED`, its
  original must have been anchored first and its demo credential ID supplied on re-verification.
- **Rate limits are best-effort** — DB-backed and per hashed IP, they depend on the trusted proxy's
  forwarded headers (on Render, its load balancer) and are an abuse brake, not an authentication
  boundary.
- **Frontend structural tests are not browser E2E** — they guard source-level invariants.
- **The x402 request token is a server-side TTL, not a cryptographically resource-bound nonce** — the
  Hedera exact scheme has no nonce field, so the token is not part of the signed payment; replay and
  double-settle protection is layered (atomic per-request claim + single-use tx id + DB uniqueness +
  Mirror verification).
- **Mainnet readiness and a formal third-party audit are out of scope** for this testnet proof of
  concept.

## License & disclaimer

Licensed under the **MIT License** — see [`LICENSE`](LICENSE).

This is a **Hedera Testnet proof of concept**. Testnet HBAR has **no monetary value**. All sample
credentials and issuers are **synthetic** — no real person, institution, or credential is represented.
