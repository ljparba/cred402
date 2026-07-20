# Cred402 — Render Deployment

> Deploy the public demo to Render: a **Render Web Service** (the Next.js app) + a **Render
> PostgreSQL** database. Set env vars, run migrations + seed, and go.

Deployment is an **owner action** (it needs your Render + GitHub accounts). This doc is the exact
recipe; the owner runs it. Related: [DATABASE.md](DATABASE.md), [HEDERA_SETUP.md](HEDERA_SETUP.md),
[LOCAL_SETUP.md](LOCAL_SETUP.md).

---

## 1. Push the repo to GitHub

Render deploys from a GitHub repo.

```bash
git add .
git commit -m "Cred402 initial public release"
git branch -M main
git remote add origin https://github.com/<you>/cred402.git
git push -u origin main
```

Ensure `.env.local` is **not** committed (it is gitignored). Never push real secrets.

---

## 2. Create the Render PostgreSQL database

1. In the Render dashboard: **New → PostgreSQL**.
2. Name it (e.g. `cred402-db`), pick a region, choose a plan (the free tier works for the demo).
3. Create it, then open the database page and copy the **Internal Database URL** (for the web
   service in the same region) — it looks like
   `postgres://USER:PASS@dpg-xxx-a/db`. You'll also want the **External Database URL**
   (`...render.com/db`) if you plan to run migrations from your laptop.
4. Cred402 requires SSL. If the copied URL has no SSL parameter, append `?sslmode=require`:

   ```
   postgres://USER:PASS@dpg-xxx.render.com/db?sslmode=require
   ```

---

## 3. Create the Render Web Service

1. **New → Web Service**, connect your GitHub repo, pick the `main` branch.
2. **Runtime:** Node.
3. **Build Command:**

   ```
   npm install && npm run build
   ```

4. **Start Command:**

   ```
   npm run start
   ```

5. **Instance type:** free or starter is fine for the demo.

> `next.config.ts` already lists `@electric-sql/pglite`, `@hiero-ledger/sdk`, `pdf-lib`, and
> `postgres` in `serverExternalPackages`, so the Hedera SDK and Postgres driver run as real Node
> modules on Render (nothing extra to configure). Because `DATABASE_URL` is set on Render, the app
> uses the **postgres.js** driver, not PGlite.

---

## 4. Set environment variables on the Web Service

In the web service's **Environment** tab, add:

### Required

| Key | Value |
|---|---|
| `DATABASE_URL` | the Render Postgres URL from step 2 (with `?sslmode=require`) |
| `NEXT_PUBLIC_APP_URL` | your Render app URL, e.g. `https://cred402.onrender.com` |
| `NEXT_PUBLIC_HEDERA_NETWORK` | `testnet` |
| `NEXT_PUBLIC_HASHSCAN_BASE_URL` | `https://hashscan.io/testnet` |

The app **runs in unconfigured mode** with just the above — genuine 402 challenges, offline HCS
fixtures, `?demo=1` report bypass enabled. That's a valid public demo.

### To enable real Hedera + x402 settlement (optional, recommended for the bounty)

Add the Hedera/x402 secrets from [HEDERA_SETUP.md](HEDERA_SETUP.md):

| Key | Value |
|---|---|
| `HEDERA_NETWORK` | `testnet` |
| `HEDERA_OPERATOR_ID` | your operator account id |
| `HEDERA_OPERATOR_PRIVATE_KEY` | your operator HEX private key (**secret**) |
| `HEDERA_HCS_TOPIC_ID` | the topic id from `npm run hedera:create-topic` |
| `MIRROR_NODE_BASE_URL` | `https://testnet.mirrornode.hedera.com` |
| `X402_NETWORK` | `hedera:testnet` |
| `X402_PAYMENT_RECIPIENT` | your operator id (receives payment) |
| `X402_FACILITATOR_URL` | `https://x402.org/facilitator` |
| `X402_PRICE` | `10000000` |
| `X402_ASSET` | `0.0.0` |
| `X402_DEMO_PAYER_ID` | the demo-payer id from `npm run hedera:create-wallet` |
| `X402_DEMO_PAYER_PRIVATE_KEY` | the demo-payer HEX key (**secret**) |

> Setting the demo-payer + operator keys **disables the `?demo=1` bypass** in production — real
> settlement becomes mandatory. That's the correct posture for a live demo.

Mark the two private keys as **secret** in Render. They are server-only and never sent to the
browser.

---

## 5. Run migrations and seed (once, against Render Postgres)

The build does not run migrations automatically. Run them once after the first deploy. Two options:

### Option A — from the Render Shell (recommended)

Open the web service's **Shell** tab (it has `DATABASE_URL` already set) and run:

```bash
npm run db:migrate
npm run certs:generate
npm run db:seed
```

`certs:generate` also produces the sample PDFs on the instance so `/api/samples/{slug}` can serve
them. Then, if you configured Hedera keys and want on-chain evidence:

```bash
npm run hedera:anchor
```

### Option B — from your laptop against the External URL

```bash
export DATABASE_URL='postgres://USER:PASS@dpg-xxx.render.com/db?sslmode=require'
npm run db:migrate
npm run certs:generate
npm run db:seed
```

(Anchoring from your laptop requires the operator keys in your local `.env.local`.)

Verify:

```bash
curl https://<your-app>.onrender.com/api/health
# → mode: "configured" or "unconfigured"; db.driver: "postgres"; db.ok: true
```

---

## 6. Redeploys

- Pushing to `main` triggers an automatic redeploy (build + start).
- Env-var changes require a manual redeploy (Render prompts you).
- Migrations only need re-running when you add a new migration file to `drizzle/` — re-run
  `npm run db:migrate` from the Shell. `db:seed` is idempotent and safe to re-run.

---

## 7. Gotchas

- **`serverExternalPackages` is already handled** in `next.config.ts` — do not remove those entries
  or the build/runtime will fail (PGlite WASM and the Hedera SDK must stay external).
- **SSL:** Render Postgres needs `?sslmode=require` on the URL. A connection error on first migrate
  is almost always a missing SSL parameter.
- **`db:reset` does not work on Render** (it refuses when `DATABASE_URL` is set). To wipe, recreate
  the database in the Render console and re-run `db:migrate` + `db:seed`.
- **Cold starts:** free-tier services sleep; the first request after idle is slow. Fine for a demo,
  but mention it when recording the video.
- **Sample files missing (404 on download)** → you didn't run `certs:generate` on the instance. Run
  it in the Render Shell.
- **Facilitator reachability:** the app calls `https://x402.org/facilitator`. Render allows outbound
  HTTPS by default; if the 402 shows `x402Ready: false`, the facilitator was briefly unreachable —
  it retries on the next request.
