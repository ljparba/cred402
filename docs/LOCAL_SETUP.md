# Cred402 — Local Setup

> From `git clone` to a running app on your machine, with **zero external services** (embedded
> PGlite DB, offline fixtures, no Hedera account). Optionally, how to point at Neon instead.

Related: [DATABASE.md](DATABASE.md), [HEDERA_SETUP.md](HEDERA_SETUP.md) (to turn on real on-chain
behaviour), [TESTING.md](TESTING.md).

---

## 1. Prerequisites

- **Node.js 20+** and npm. (Check: `node -v`.)
- Nothing else. No Postgres server, no Docker, no Hedera account. The default local database is
  **PGlite** — an embedded WASM Postgres that lives in a folder (`./.pglite`).

---

## 2. Clone and install

```bash
git clone <your-repo-url> cred402
cd cred402
npm install
```

`npm install` pulls `@hiero-ledger/sdk` (the Hedera SDK), `@x402/*` (x402 v2),
`@electric-sql/pglite`, `postgres`, `drizzle-orm`, `next`, `framer-motion`, etc.

> **Do not also install `@hashgraph/sdk`.** Cred402 uses `@hiero-ledger/sdk` only; two Hedera SDKs
> in one process break the SDK's internal brand checks (`t.startsWith is not a function`).

---

## 3. Environment (optional for local)

**Nothing is required to build or run in unconfigured mode.** If you want to set any values, copy
the template:

```bash
cp .env.example .env.local
```

For the default zero-service local run you can leave `.env.local` empty (or not create it at all).
Relevant defaults when unset:

| Variable | Default when unset | Meaning |
|---|---|---|
| `DATABASE_URL` | — (uses PGlite) | Leave unset to use the embedded local DB |
| `PGLITE_DATA_DIR` | `./.pglite` | Where the embedded DB stores its files |
| `MAX_UPLOAD_SIZE` | `5242880` (5 MB) | Max upload size in bytes |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Base URL the app/agent uses |
| `NEXT_PUBLIC_HASHSCAN_BASE_URL` | `https://hashscan.io/testnet` | HashScan link base |

Do **not** create a `.env.local` with Hedera keys unless you intend configured mode — see
[HEDERA_SETUP.md](HEDERA_SETUP.md).

---

## 4. Set up the database and demo data

```bash
# 1. Create the local PGlite database and seed the demo catalogue
npm run db:setup          # = db:migrate + db:seed

# 2. Generate the demo certificate PDFs (writes real hashes to scripts/data/hashes.generated.json)
npm run certs:generate

# 3. Re-seed so the DB's anchored hashes match the generated files
npm run db:seed
```

Why step 3: the first seed uses placeholder hashes because the PDFs don't exist yet.
`certs:generate` produces them and records their real SHA-256; re-seeding makes VALID/TAMPERED
classify correctly.

Verify the seed worked (optional): the sample verifier runs every sample file through the real
pipeline and asserts the expected verdicts:

```bash
npm run verify:samples
# → ✓ all 7 samples verified with the expected verdict.
```

---

## 5. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. Then:

1. Download a sample from the "Sample Certificates" panel (or use the files under `samples/`).
2. Upload it in the workspace — the app hashes it and shows a locked preview.
3. Request the report. In **unconfigured mode**, the report is gated by a genuine HTTP 402; to see
   the full report UI, use the `?demo=1` bypass the app exposes (settlement is clearly labelled
   *simulated*).

Confirm the mode any time:

```bash
curl http://localhost:3000/api/health
# → { "status":"ok", "mode":"unconfigured", "db":{ "driver":"pglite", "ok":true }, ... }
```

---

## 6. Reset the local database

```bash
npm run db:reset
```

Deletes `./.pglite`, then re-migrates and re-seeds. It **refuses to run if `DATABASE_URL` is set**,
so it can never touch a remote database.

---

## 7. Optional: use Neon instead of PGlite

Neon gives you a real hosted Postgres for local dev (closer to production).

1. Create a free project at <https://neon.tech> and copy its connection string.
2. Set it in `.env.local`:

   ```dotenv
   DATABASE_URL=postgres://USER:PASS@ep-xxx.neon.tech/db?sslmode=require
   ```

3. Migrate + seed against Neon (same commands — the driver switches automatically):

   ```bash
   npm run db:migrate
   npm run db:seed
   npm run certs:generate && npm run db:seed
   ```

4. `npm run dev`. `GET /api/health` now shows `"driver":"postgres"`.

> `npm run db:reset` won't work against Neon (by design). To reset, drop/recreate the database in
> the Neon console, then run `db:setup`.

---

## 8. Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server (after `build`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:setup` / `db:seed` / `db:reset` | Database (see [DATABASE.md](DATABASE.md)) |
| `npm run certs:generate` | Generate demo PDFs + hashes |
| `npm run verify:samples` | Run every sample through the engine (CI gate) |
| `npm run agent:demo` | Machine-readable x402 client demo (needs the dev server running) |

---

## 9. Troubleshooting

- **Sample download returns "Run `npm run certs:generate`"** → you seeded the catalogue but never
  generated the PDF files. Run `npm run certs:generate`.
- **The VALID sample verifies as TAMPERED/UNKNOWN** → you generated PDFs but didn't re-seed. Run
  `npm run db:seed` after `certs:generate` so anchored hashes match the files.
- **PGlite / WASM error at runtime** → ensure you didn't remove `@electric-sql/pglite` from
  `serverExternalPackages` in `next.config.ts`; PGlite must not be bundled by webpack.
- **Port 3000 in use** → set `NEXT_PUBLIC_APP_URL` and pass a port to Next (`next dev -p 3001`), or
  free the port.
