# Cred402 — Database

> The 9 tables, the single `DATABASE_URL` abstraction (PGlite ↔ postgres.js ↔ Neon ↔ Render), and
> the migrate / seed / reset commands. Drizzle ORM, PostgreSQL dialect, no provider-specific SQL.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) §6, [LOCAL_SETUP.md](LOCAL_SETUP.md),
[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md).

---

## 1. The `DATABASE_URL` abstraction

One env var selects the driver. Same Drizzle schema (`src/lib/db/schema.ts`) and same migrations
(`drizzle/*.sql`) run against both.

| `DATABASE_URL` | Driver | Use |
|---|---|---|
| **unset** | **PGlite** (embedded WASM Postgres, data at `PGLITE_DATA_DIR`, default `./.pglite`) | local dev/test with no server — the default |
| set | **postgres.js** | Neon (dev) or Render (prod) |

Example connection strings:

```dotenv
# Neon (dev)
DATABASE_URL=postgres://USER:PASS@ep-xxx.neon.tech/db?sslmode=require
# Render (prod)
DATABASE_URL=postgres://USER:PASS@dpg-xxx.render.com/db?sslmode=require
```

**Switching providers = change `DATABASE_URL` + run migrations. Nothing else.** No code changes, no
schema edits. The app never uses provider-specific SQL; status/verdict columns are `text` with a
TypeScript union `$type` rather than PG enums, keeping migrations painless and portable.

`src/lib/db/index.ts` builds the driver, exposes `getDb()` (Drizzle instance) and `getDbBundle()`
(driver name + `migrate()`), and `next.config.ts` lists `@electric-sql/pglite` and `postgres` in
`serverExternalPackages` so neither is bundled by webpack.

---

## 2. The 9 tables

Schema: `src/lib/db/schema.ts`. Migration: `drizzle/0000_wonderful_paper_doll.sql`.

| Table | Holds | Key columns / constraints |
|---|---|---|
| `issuers` | Demo issuers | `id` PK; `registered` boolean (`false` powers the unregistered-issuer demo); `hedera_topic_id` |
| `credentials` | Current indexed credential state | `id` PK; `issuer_id` FK; `sha256` (anchored expected hash, indexed); `status` `ACTIVE\|REVOKED\|EXPIRED`; `issued_at`, `expires_at`, `revoked_at` |
| `credential_events` | Local mirror of the HCS envelopes we submit | `id` PK (eventId, idempotency key); `type` `CREDENTIAL_ISSUED\|CREDENTIAL_REVOKED\|ISSUER_REGISTERED`; `payload` jsonb (exact envelope); `prev_event_id` |
| `hcs_records` | On-chain proof coordinates for each event | `event_id` FK (**UNIQUE**); `topic_id` + `sequence_number` (**UNIQUE** together); `transaction_id` (dashed form); `consensus_timestamp`; `running_hash` |
| `verification_requests` | Lifecycle of one verification | `id` PK (requestId); `sha256` (uploaded, indexed); `credential_id`; `nonce` + `nonce_expires_at`; `status` `AWAITING_PAYMENT\|PAID\|COMPLETED\|FAILED`; `preview_verdict` |
| `verification_results` | The released full report | `request_id` FK (**UNIQUE**); `verdict`; `checks` jsonb (the six checks); `uploaded_hash`; `anchored_hash`; `hcs_sequence_number`; `hcs_transaction_id` |
| `payment_requests` | The 402 challenge we advertised | `request_id` FK; `scheme` (`exact`); `network`; `asset`; `amount` (tinybars); `pay_to`; `fee_payer`; `max_timeout_seconds`; `nonce`; `expires_at` |
| `payment_settlements` | Proven settlements (first-use-wins) | `request_id` FK; **`transaction_id` UNIQUE** (a settled tx unlocks exactly one report, ever); `payer`; `pay_to`; `amount`; `mirror_verified` boolean; `status` `SETTLED\|FAILED`; `hashscan_url` |
| `demo_samples` | Downloadable test catalogue | `slug` PK; `credential_id` FK; `category`; `label`; `description`; `filename` (path under `samples/`); `expected_verdict`; `sha256` |

### Constraints that matter for correctness

- `payment_settlements.transaction_id` **UNIQUE** — the core replay protection (see
  [X402_FLOW.md](X402_FLOW.md) §5). A concurrent duplicate insert throws and is treated as a replay
  (409).
- `verification_results.request_id` **UNIQUE** — one report per request.
- `hcs_records.event_id` **UNIQUE** and `(topic_id, sequence_number)` **UNIQUE** — one on-chain
  record per event; supports idempotent anchoring.

Indexes exist on `credentials.sha256`, `credentials.issuer_id`, `credential_events.credential_id`,
`verification_requests.sha256`, and `verification_requests.nonce`.

Relationships are declared with Drizzle `relations()` so `queries.ts` can do typed relational reads.

---

## 3. What gets seeded

`scripts/seed.ts` (from `scripts/data/catalog.ts`) — fully synthetic data:

- **2 issuers** — `Cred402 Demo Institute` (registered) and `Northgate Open Academy` (unregistered,
  powers the unregistered-issuer demo).
- **12 credentials** — including the flagship tamper pair `CRED-2026-0004` (Data Structures), plus
  expired, revoked, and unregistered examples. 5 of the 12 have no downloadable sample file (see
  [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)).
- **14 credential_events** — one `ISSUER_REGISTERED` per registered issuer (1), one
  `CREDENTIAL_ISSUED` per credential (12), plus one `CREDENTIAL_REVOKED` (1).
- **7 demo_samples** — the downloadable catalogue: valid ×2 (incl. the tamper original), tampered,
  expired, revoked, unregistered, fake/unknown.

The seed does **not** write `hcs_records` — those hold real on-chain proof coordinates and are
filled by `scripts/anchor-credentials.ts` once you're configured (see [HEDERA_SETUP.md](HEDERA_SETUP.md)).

### Idempotent seeding

Every row is an **upsert keyed on its primary key** (`onConflictDoUpdate`), so `npm run db:seed` is
safe to run repeatedly — re-running converges to the same state. Proven: two consecutive runs yield
issuers 2 / credentials 12 / events 14 / samples 7.

### Hashes are derived, never hand-typed

SHA-256 values come from `scripts/data/hashes.generated.json`, which `npm run certs:generate`
produces from the **actual** PDF bytes. Until the PDFs exist, the seed uses clearly-labelled
deterministic placeholder hashes so the flow is still runnable. **Always run
`certs:generate` then `db:seed` again** so anchored hashes match the real files (otherwise the VALID
sample won't hash-match).

---

## 4. Commands

| Command | What it does |
|---|---|
| `npm run db:generate` | Regenerate SQL migrations from the Drizzle schema (only after schema edits) |
| `npm run db:migrate` | Apply pending migrations from `drizzle/` via the active driver |
| `npm run db:seed` | Idempotent seed (upserts issuers, credentials, events, samples) |
| `npm run db:setup` | `db:migrate` then `db:seed` |
| `npm run db:reset` | **LOCAL ONLY:** delete the PGlite data dir, then migrate + seed |

`db:migrate` picks the PGlite or postgres.js migrator via the same abstraction the app uses, so it
works identically local and in production.

`db:reset` **refuses to run when `DATABASE_URL` is set**, so it can never drop a Neon/Render
database by accident. To reset a remote DB, drop/recreate it in the provider console, then run
`db:setup`.

---

## 5. Typical flows

**First local run (PGlite):**

```bash
npm run db:setup        # migrate + seed
npm run certs:generate  # produce PDFs + real hashes
npm run db:seed         # re-seed with real hashes
```

**Point at Neon instead of PGlite:**

```bash
export DATABASE_URL='postgres://USER:PASS@ep-xxx.neon.tech/db?sslmode=require'
npm run db:setup        # migrate + seed against Neon
```

**Production (Render):** set `DATABASE_URL` to the Render Postgres internal/external URL and run
`npm run db:migrate && npm run db:seed` once — see [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md).
