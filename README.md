# Cred402

> **Pay-per-use credential verification on Hedera.**

[![Hedera Testnet](https://img.shields.io/badge/Hedera-Testnet-8259ef)](https://hashscan.io/testnet)
[![x402 v2](https://img.shields.io/badge/x402-v2-1c1c1c)](https://x402.org)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](#license)

Cred402 is an **accountless, API-first, pay-per-verification trust service** on Hedera Testnet.

A human, application, or autonomous AI agent uploads a credential file. The server hashes it,
identifies the credential, and returns a **free preview**. The **full verification report** sits
behind a genuine HTTP `402 Payment Required` gate. The caller settles a real testnet HBAR payment
through the **x402** protocol; the server independently re-confirms settlement on the Hedera Mirror
Node, and only then releases a machine-readable report backed by tamper-evident **Hedera Consensus
Service (HCS)** records.

> ⚠️ **This is a Hedera Testnet proof of concept.** All certificates and issuers are synthetic. All
> payments use valueless testnet HBAR. It is not a production identity or credentialing system.

---

## What makes it different

Not "certificates on a blockchain." The differentiator is:

> **Accountless, machine-readable, pay-per-use credential verification using x402 payments and
> tamper-evident Hedera records.**

- No sign-up and no wallet connect to get the free preview — just upload and get a hash.
- The paywall is a **real HTTP 402**, not a donate button or an "I paid" checkbox.
- In **configured mode**, settlement is a **real testnet HBAR transfer**, independently re-verified
  against Mirror Node — the server never takes the facilitator's word for it.
- Verification is **deterministic** (six checks, no AI) and every result cites HCS evidence.

## The flagship demo: the tamper pair

Two certificates that look **visually identical** to a human:

| File | Verdict | Why |
|---|---|---|
| `samples/valid/data-structures-original.pdf` | **VALID** | SHA-256 matches the HCS-anchored issuance hash for `CRED-2026-0004`. |
| `samples/tampered/data-structures-tampered.pdf` | **TAMPERED** | One field (the grade) was edited after issuance. The credential ID still resolves and HCS evidence still exists, but the SHA-256 **no longer matches** the anchor. |

Upload both. The report shows the hash diff and explains the file was altered after issuance. This
is the legible, one-glance proof that Cred402 detects post-issuance edits against an immutable
anchor.

There are also samples for **Expired**, **Revoked**, **Unregistered issuer**, and **Unknown**
results — see [Owner Acceptance Test](docs/OWNER_ACCEPTANCE_TEST.md).

---

## Two operating modes

Cred402 builds and runs **with or without** Hedera keys.

| Mode | When | Behaviour |
|---|---|---|
| **UNCONFIGURED** | No `HEDERA_OPERATOR_*` / demo-payer keys | Offline fixtures. The app still builds and runs, HCS evidence shows as a local (pre-anchor) fixture, and `GET /api/report/{id}` still returns a **genuine HTTP 402** with a **real `feePayer`** injected live by the public x402.org facilitator. A `?demo=1` bypass lets reviewers see the full report UI with settlement clearly labelled *simulated*. **This bypass is automatically disabled once keys are configured.** |
| **CONFIGURED** | Operator + demo-payer keys present | Real HCS anchoring (`npm run hedera:anchor`) and **real x402 testnet settlement**. The `?demo=1` bypass is ignored; the report is released only after a real, independently-confirmed payment. |

Check which mode you're in at any time: `GET /api/health` reports `"mode": "configured"` or
`"unconfigured"`.

### Project status

**Code-complete and handoff-ready.** Everything builds, tests, and demonstrates end-to-end today in
unconfigured mode — including a *genuine* HTTP 402 challenge whose `feePayer` is discovered live from
the public x402.org facilitator. What has **not** been executed is a fully keyed run: **live HCS
anchoring (`npm run hedera:anchor`) and live x402 on-chain settlement remain owner acceptance steps
that require Hedera Testnet keys** (see [OWNER_ACCEPTANCE_TEST.md](docs/OWNER_ACCEPTANCE_TEST.md) and
[HEDERA_SETUP.md](docs/HEDERA_SETUP.md)). No code changes are needed to activate them.

---

## Quickstart (local, zero external services)

Requires **Node.js 20+**. No Postgres server, Docker, or Hedera account needed — the app uses an
embedded [PGlite](https://pglite.dev) database and offline fixtures by default.

```bash
# 1. Install dependencies
npm install

# 2. Create the local database (embedded PGlite) + seed demo data
npm run db:setup        # = db:migrate then db:seed

# 3. Generate the demo certificate PDFs (incl. the tamper pair)
npm run certs:generate

# 4. Re-seed so the DB uses the real generated file hashes
npm run db:seed

# 5. Run the app
npm run dev
```

Open <http://localhost:3000>. Upload a sample from `samples/` (or download one from the app's
Sample Certificates panel), request the report, and — in unconfigured mode — use the `?demo=1`
report view to see the full result.

> **Note on step 4:** `certs:generate` writes the real SHA-256 of each generated PDF to
> `scripts/data/hashes.generated.json`. Re-seeding after generation makes the anchored hashes in
> the DB match the actual files, so VALID/TAMPERED classify correctly. If you skip generation, the
> seed falls back to clearly-labelled placeholder hashes.

To reset the local database at any time: `npm run db:reset` (deletes the PGlite data dir, then
re-migrates and re-seeds; refuses to run if `DATABASE_URL` is set).

---

## The one-page experience (high level)

Cred402 is a **single interactive page** — an "interactive verification machine," not a multi-page
site. It walks the whole product journey in one flow with meaningful animations for each waiting
state:

1. Animated hero — headline + CTAs, the certificate scanner, and the **live Hedera activity feed**
   in the right column (from `/api/activity`)
2. Headline stats, then **How It Works preview (35%) beside Sample Certificates (65%)**
3. **Original vs. Tampered — Create Tamper Demo** homepage section (links to the full demo)
4. Credential upload workspace (drag-and-drop; PDF/PNG/JPEG) with a Sample Files → Scan Process →
   Issuer Hints sidebar
5. Scanning + SHA-256 hashing visualization
6. HTTP 402 payment-required gate
7. x402 payment settlement (real transfer, or simulated in demo mode)
8. HCS proof lookup
9. Per-check verification progress (the six checks, individually)
10. Final report — Credential · Verdict · Payment Proof over Verification Checks + HCS/Activity
   (VALID seal, TAMPERED hash-diff, REVOKED timeline, etc.)
11. A dedicated **`/how-it-works`** route (8-step flow, six checks/verdicts, interactive Create
   Tamper Demo)
12. Minimal footer with GitHub link + testnet disclaimer

The frontend honours `prefers-reduced-motion` and is responsive down to mobile. (This README
describes the UI at a high level; the API and infrastructure are the fully documented surface.)

---

## Tech stack

- **Next.js 15** (App Router, React 19), **TypeScript**, **Tailwind CSS v4**, **framer-motion**
- **Drizzle ORM** over a single `DATABASE_URL` abstraction: **PGlite** (embedded, local) when
  `DATABASE_URL` is unset, **postgres.js** (Neon dev / Render prod) when set
- **`@hiero-ledger/sdk`** — the vendor-neutral Hedera SDK (never also install `@hashgraph/sdk`)
- **x402 v2** via `@x402/core`, `@x402/hedera`, `@x402/fetch`; official facilitator
  `https://x402.org/facilitator`
- Price: **0.1 tHBAR = `10000000` tinybars**, HBAR-native asset `0.0.0`

---

## Documentation

| Doc | What it covers |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module map, data flow, engine, HCS design, x402 flow, DB portability, the two modes |
| [HEDERA_SETUP.md](docs/HEDERA_SETUP.md) | Getting a testnet operator account, creating the HCS topic, anchoring events, the demo wallet, HashScan/Mirror verification |
| [X402_FLOW.md](docs/X402_FLOW.md) | The genuine 402 sequence, header formats, security model, testing with `npm run agent:demo` |
| [DATABASE.md](docs/DATABASE.md) | The 9 tables, the `DATABASE_URL` abstraction, PGlite↔Neon↔Render portability, migrate/seed/reset |
| [LOCAL_SETUP.md](docs/LOCAL_SETUP.md) | From clone to running locally with zero external services (and optionally with Neon) |
| [RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md) | Render web service + Render PostgreSQL, env vars, migrations, build/start commands |
| [TESTING.md](docs/TESTING.md) | Running the suite, what each test covers, the isolated engine DB, production checks |
| [OWNER_ACCEPTANCE_TEST.md](docs/OWNER_ACCEPTANCE_TEST.md) | Step-by-step checklist the owner runs to accept the project |
| [DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | A ~2–3 minute demo/video walkthrough script |
| [BOUNTY_SUBMISSION_CHECKLIST.md](docs/BOUNTY_SUBMISSION_CHECKLIST.md) | Everything needed to submit |
| [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | Honest list of what is demo-only or owner-blocked |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | The living architecture + phase plan |
| [PROGRESS.md](docs/PROGRESS.md) | Build progress tracker with evidence |

---

## Repository layout

```
src/app/            Next.js App Router — the one page + /api routes
src/lib/            config, db (Drizzle), hedera, x402, verify (engine)
scripts/            migrate, seed, reset, certs:generate, hedera:* , agent:demo
samples/            downloadable demo certificates (valid/tampered/expired/…)
drizzle/            generated SQL migrations
tests/              node:test suite (run with tsx)
docs/               all documentation
```

---

## License

MIT — see [`LICENSE`](LICENSE). All demo data is synthetic.
