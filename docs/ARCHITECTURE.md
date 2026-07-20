# Cred402 — Architecture

> Pay-per-use credential verification on Hedera. This document is the technical map: modules, data
> flow, the deterministic engine, HCS design, the x402 flow, database portability, and the two
> operating modes.

See also: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (the living plan), [X402_FLOW.md](X402_FLOW.md),
[DATABASE.md](DATABASE.md), [HEDERA_SETUP.md](HEDERA_SETUP.md).

---

## 1. Module map

```
src/
  app/
    layout.tsx                       Root layout, fonts, metadata
    page.tsx                         The single-page experience (all states)
    api/
      verify/route.ts                POST  upload → hash → identify → FREE locked preview + requestId
      report/[requestId]/route.ts    GET   PROTECTED — genuine HTTP 402 gate → full report
      pay/route.ts                   POST  built-in "demo wallet" payer (server-side x402 client)
      samples/route.ts               GET   downloadable sample catalogue
      samples/[slug]/route.ts        GET   sample file download (path from trusted catalogue row)
      activity/route.ts              GET   live Hedera/HCS/x402 activity feed + headline stats
      health/route.ts                GET   readiness + configuration diagnostics (booleans only)
  lib/
    config.ts                        Typed env access; serverConfig (server-only) + publicConfig
    http.ts                          json / apiError / safeHandler helpers
    ids.ts                           id + nonce generators
    db/
      schema.ts                      Drizzle schema (9 tables) + row types
      index.ts                       DATABASE_URL abstraction (postgres.js | PGlite) + migrate
      queries.ts                     Typed data-access functions
    hedera/
      client.ts                      Hiero client + operator; unconfigured-safe factory
      hcs.ts                         Topic create + issuance/revocation event submit (writes)
      mirror.ts                      Mirror Node REST reads + backoff + toDashedTxId
      hashscan.ts                    HashScan URL builders (browser-safe, pure)
      types.ts                       Versioned HCS event envelope + builders
    x402/
      server.ts                      x402ResourceServer + Hedera exact scheme registration
      settlement.ts                  Independent Mirror Node settlement re-verification
      nonce.ts                       Challenge-freshness nonce (TTL) helpers
    verify/
      hash.ts                        SHA-256 + hashesEqual
      upload.ts                      Type/size/magic-byte validation
      extract.ts                     Embedded credential-ID extraction from PDF metadata
      engine.ts                      Deterministic verification pipeline (six checks)
  components/                        UI + motion components (frontend)
scripts/
  migrate.ts                         Apply migrations (PGlite or postgres.js)
  seed.ts                            Idempotent DB seed (upserts)
  reset.ts                           Reset LOCAL PGlite DB, then migrate + seed
  generate-certificates.ts           Render demo PDFs incl. the original/tampered pair
  verify-samples.ts                  Run every sample through the real pipeline (CI gate)
  create-topic.ts                    Create the HCS topic → HEDERA_HCS_TOPIC_ID
  anchor-credentials.ts              Submit issuance/revocation events → hcs_records (idempotent)
  create-demo-wallet.ts              Derive + fund the x402 demo payer → X402_DEMO_PAYER_*
  agent-client.ts                    Machine-readable x402 client (AI-agent demo)
  data/catalog.ts                    Single source of truth: issuers, credentials, samples
samples/ valid/ tampered/ expired/ revoked/ fake/ unregistered/
drizzle/                             Generated SQL migrations
tests/                               node:test suite
docs/                                All documentation
```

---

## 2. Data flow (reproduces IMPLEMENTATION_PLAN §3.2)

```
Browser / AI Agent
   │  POST /api/verify   (multipart "file")
   ▼
Validate (magic-byte type sniff, size ≤ MAX_UPLOAD_SIZE) ──► SHA-256 (server-side, in memory)
   │  (raw bytes are NEVER persisted)
   ▼  identify: match by hash → else by embedded credential ID → else UNKNOWN
Create verification_request { id, hash, credentialId?, nonce, status=AWAITING_PAYMENT }
Store verification_result   (full report, withheld until payment)
   │
   ▼  RESPONSE = FREE PREVIEW ONLY: filename, size, hash, identified?, locked=true, reportUrl
   │            (NO verdict, NO checks are ever leaked here)
   │
   │  GET /api/report/{requestId}
   ▼
Report route → is there a PAYMENT-SIGNATURE header?
   │
   ├── NO  ──► HTTP 402 + PAYMENT-REQUIRED header
   │            accepts:[{ scheme:"exact", network:"hedera:testnet",
   │                       asset:"0.0.0", amount:"10000000", payTo:<recipient>,
   │                       maxTimeoutSeconds:180, extra:{ feePayer:<facilitator account> } }]
   │
   └── YES ──► 1. REPLAY-CHECK FIRST: extract tx id the client signed; if it already
               │  unlocked a report (DB-UNIQUE), reject 409 PAYMENT_ALREADY_CONSUMED.
               ▼
               2. Freshness: request nonce must not be expired (else 402 CHALLENGE_EXPIRED).
               ▼
               3. Facilitator verify → settle (REAL fee-sponsored testnet HBAR transfer).
               ▼
               4. INDEPENDENT PROOF: Mirror Node GET /transactions/{dashed-id}
                  assert result == SUCCESS ∧ net credit to payTo == exactly 10000000 tinybars.
               ▼
               5. Record payment_settlement (UNIQUE transaction_id = first-use-wins).
                  Mark request PAID → burn nonce (COMPLETED).
               ▼
               6. Release FULL report (verdict, six checks, credential, HCS proof, HashScan links)
                  + PAYMENT-RESPONSE header.
```

The verification engine runs at **preview time** (inside `/api/verify`) and its result is stored
but withheld; the report route attaches live payment + on-chain proof that only exists after
settlement.

---

## 3. Verification engine — deterministic, no AI

File: `src/lib/verify/engine.ts`. Six independent checks, each producing `PASS | FAIL | WARN | SKIP`
with an evidence string:

| # | Check id | What it asserts |
|---|---|---|
| 1 | `hash_integrity` | Uploaded SHA-256 == the HCS-anchored issuance hash for the identified credential |
| 2 | `credential_known` | The credential ID resolves in the registry (by hash, else by embedded ID) |
| 3 | `issuer_registered` | The issuer exists and is a registered/trusted Cred402 issuer |
| 4 | `revocation` | No `CREDENTIAL_REVOKED` event and status ≠ REVOKED |
| 5 | `expiration` | `expiresAt` is in the future, or absent |
| 6 | `hcs_evidence` | An issuance event is retrievable (anchored on Hedera → PASS; local pre-anchor fixture → WARN; none → FAIL) |

**Identification:** by file hash first; if that misses, by the credential ID embedded in the PDF's
Keywords/Subject/Title metadata (`extract.ts`). Images (PNG/JPEG) carry no such metadata, so they
are hash-only.

**Verdict precedence** (first match wins):

```
UNKNOWN → UNREGISTERED_ISSUER → TAMPERED → REVOKED → EXPIRED → VALID
```

- **UNKNOWN** — nothing identifies the file (no hash match, no known claimed ID).
- **UNREGISTERED_ISSUER** — identified, but the issuer is not registered/trusted.
- **TAMPERED** — the flagship case: credential ID **is** known and HCS evidence **exists**, but the
  uploaded hash **differs** from the anchor → the file was edited after issuance.
- **REVOKED / EXPIRED / VALID** — hash matches; resolved by revocation → expiry → otherwise valid.

The engine is pure with respect to its inputs plus the DB; `now` is injectable, which makes
expiration deterministic and the whole engine unit-testable.

---

## 4. HCS event design

The HCS topic is an **append-only credential event log**. **No PDFs and no personal data go
on-chain** — only the minimal proof envelope (`src/lib/hedera/types.ts`):

```jsonc
{
  "v": 1,                         // event schema version
  "type": "CREDENTIAL_ISSUED",    // | CREDENTIAL_REVOKED | ISSUER_REGISTERED
  "eventId": "evt_...",           // app-generated idempotency key
  "credentialId": "CRED-2026-0004",
  "issuerId": "ISS-CRED402-DEMO",
  "sha256": "<64 hex>",           // the anchored file hash
  "issuedAt": "2026-01-28T00:00:00Z",
  "expiresAt": "2031-01-28T00:00:00Z",  // optional
  "status": "ACTIVE",
  "prevEventId": "evt_..."        // optional chain reference (revocation → issuance)
}
```

**Write path** (`hcs.ts`): `createTopic()` provisions the topic with the operator as admin + submit
key; `submitEvent()` posts an envelope and returns the sequence number, dashed transaction id, and
(best-effort) consensus timestamp.

**Read path** (`mirror.ts`): all reads go through the Hedera Mirror Node REST API — no SDK. It
handles the known footguns: dashed tx-id conversion, ~2–3s ingestion lag (polling with backoff),
and base64-decoding `message`/`memo_base64`.

The DB holds the **current indexed state**; `hcs_records` stores only the coordinates (topic,
sequence, consensus timestamp, tx id) needed to re-verify the proof externally.

---

## 5. x402 flow (summary)

Full detail in [X402_FLOW.md](X402_FLOW.md). In brief, this is **x402 protocol v2** with the Hedera
`exact` scheme, against the official public facilitator `https://x402.org/facilitator`:

1. The report route builds `accepts` requirements (scheme `exact`, `hedera:testnet`, asset `0.0.0`,
   amount `10000000`, `maxTimeoutSeconds` 180) via the initialized `x402ResourceServer`. The
   facilitator's `extra.feePayer` (its fee-sponsoring account) is injected automatically.
2. A caller with no payment gets **HTTP 402** with a `PAYMENT-REQUIRED` header (base64 JSON) and a
   JSON `accepts` body.
3. The client builds a `TransferTransaction` to `payTo`, sets `transactionId.accountId = feePayer`,
   signs locally, and retries with a `PAYMENT-SIGNATURE` header. **The client pays zero gas** — the
   facilitator co-signs as fee payer and submits.
4. The server verifies + settles via the facilitator, then **independently** re-verifies the exact
   settlement against Mirror Node (`settlement.ts`), records it under a UNIQUE transaction id, and
   releases the report with a `PAYMENT-RESPONSE` header.

The Hedera SDK footguns (Hiero not Hashgraph, never both; `Long` sequence numbers; dashed tx ids
for Mirror Node; ingestion lag) are handled in `hedera/*` — see IMPLEMENTATION_PLAN §2.

---

## 6. Database portability

Single `DATABASE_URL` abstraction (`src/lib/db/index.ts`), no provider-specific SQL. Same Drizzle
schema and same migrations everywhere.

| Environment | Driver | Selected when |
|---|---|---|
| Local dev/test (no server) | **PGlite** (embedded WASM Postgres) | `DATABASE_URL` is **unset** — the default local path |
| Local dev with Neon / a server | **postgres.js** | `DATABASE_URL` is set |
| Production (Render) | **postgres.js** | `DATABASE_URL` is set (`?sslmode=require`) |

Switching providers = change one env var + run migrations. Nothing else. The 9 tables are
documented in [DATABASE.md](DATABASE.md).

`next.config.ts` lists `@electric-sql/pglite`, `@hiero-ledger/sdk`, `pdf-lib`, and `postgres` in
`serverExternalPackages` so they run as real Node modules on the server rather than being bundled by
webpack (PGlite in particular breaks if its WASM is bundled).

---

## 7. The two operating modes

Config decides behaviour purely from which env vars are present (`src/lib/config.ts`):

- `hederaConfigured` = `HEDERA_OPERATOR_ID` **and** `HEDERA_OPERATOR_PRIVATE_KEY` are set.
- `x402Configured` = `hederaConfigured` **and** a payment recipient **and** demo-payer id + key.

| | UNCONFIGURED | CONFIGURED |
|---|---|---|
| Build & run | ✅ | ✅ |
| DB | PGlite (or Neon if `DATABASE_URL` set) | Neon / Render |
| HCS evidence | local fixture (engine check = WARN) | anchored on Hedera (check = PASS) after `hedera:anchor` |
| `/api/report` 402 | **genuine**, with real facilitator `feePayer` | genuine, and settleable |
| Settlement | not available | real testnet HBAR transfer + Mirror proof |
| `?demo=1` report bypass | **enabled** (settlement labelled *simulated*) | **disabled** (ignored) |

Nothing in `config.ts` throws at import time for missing Hedera/x402 values; callers check
`serverConfig.hederaConfigured` / `x402Configured` and degrade gracefully. `GET /api/health`
reports the active mode and which pieces are set (booleans only — never a secret value).

---

## 8. API surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/verify` | none | Upload → hash → identify → **free locked preview** + `requestId` (no verdict/checks) |
| GET | `/api/report/{requestId}` | **x402** | Full report; `?demo=1` bypass only when unconfigured |
| POST | `/api/pay` | demo wallet | Server-side x402 payer against our own report resource (browser demo) |
| GET | `/api/samples` | none | Downloadable sample catalogue |
| GET | `/api/samples/{slug}` | none | Download one sample file |
| GET | `/api/activity` | none | Live activity feed + headline stats |
| GET | `/api/health` | none | Readiness + config diagnostics |

Security posture (IMPLEMENTATION_PLAN §12): uploads are type/size/magic-byte validated, hashed
server-side, never persisted; sample downloads resolve paths from a trusted catalogue row (no path
traversal); operator private keys never reach the browser (`serverConfig` throws if read
client-side); handlers never leak stack traces (`safeHandler`).
