# Cred402 — Hedera Setup

> Exactly how to make Cred402 run in **CONFIGURED** mode: get a testnet operator account, create
> the HCS topic, anchor the credential events, create the x402 demo-payer wallet, and verify
> everything on HashScan and the Mirror Node.

Everything here is **owner-run** by design — it needs your Hedera keys. These steps were completed
during owner acceptance (a real topic + messages, a completed x402 settlement, Mirror + HashScan
proof). Cred402 also runs fine without any of it (see [LOCAL_SETUP.md](LOCAL_SETUP.md)); this doc
turns on the real on-chain behaviour. Testnet HBAR has **no monetary value**.

All environment variables go in a `.env.local` file at the repo root (gitignored). Start from
`.env.example`. **Never commit real secrets.**

---

## 0. Prerequisites

- The app installed and building locally (see [LOCAL_SETUP.md](LOCAL_SETUP.md)).
- A `.env.local` file. Create it by copying the template:

  ```bash
  cp .env.example .env.local
  ```

---

## 1. Get a testnet operator account (portal.hedera.com)

1. Go to <https://portal.hedera.com> and create an account (or sign in).
2. Choose the **Testnet** network. The portal provisions a funded testnet account for you.
3. Copy two values it shows:
   - the **Account ID** (looks like `0.0.123456`)
   - the **DER/HEX private key**. Portal testnet accounts are typically **ECDSA** — that is fine;
     Cred402 parses ECDSA first, then falls back to ED25519.
4. Put them in `.env.local`:

   ```dotenv
   HEDERA_NETWORK=testnet
   HEDERA_OPERATOR_ID=0.0.123456
   HEDERA_OPERATOR_PRIVATE_KEY=<your hex private key>
   ```

   > **Server-only.** `HEDERA_OPERATOR_PRIVATE_KEY` must never appear in a `NEXT_PUBLIC_*` variable
   > or reach the browser. `serverConfig` throws if you try to read it client-side.

5. Confirm the app now sees the keys:

   ```bash
   npm run dev
   # in another terminal:
   curl http://localhost:3000/api/health
   ```

   `"mode"` should be `"configured"` and `hedera.configured` should be `true`.

If you need more testnet HBAR later, use the portal's faucet for your operator account.

---

## 2. Create the HCS topic

The topic is the append-only credential-event log. Create it once:

```bash
npm run hedera:create-topic
```

The script (`scripts/create-topic.ts`) creates a topic with your operator as **admin + submit key**
(so only you can post events) and prints:

```
✓ Topic created
  Topic ID : 0.0.XXXXXXX
  HashScan : https://hashscan.io/testnet/topic/0.0.XXXXXXX

Next step — add this to .env.local:
  HEDERA_HCS_TOPIC_ID=0.0.XXXXXXX
```

Copy the printed id into `.env.local`:

```dotenv
HEDERA_HCS_TOPIC_ID=0.0.XXXXXXX
```

> If keys are missing, the script exits cleanly with instructions instead of crashing. It never
> hits Hedera until keys exist.

---

## 3. Seed the database, then anchor the events

The anchor step submits one HCS message per row in `credential_events`, so the database must be
seeded first.

```bash
# If you haven't already: create + seed the DB and generate the certificate hashes
npm run db:setup          # migrate + seed
npm run certs:generate    # render the PDFs and write scripts/data/hashes.generated.json
npm run db:seed           # re-seed so anchored hashes match the real files

# Now submit every issuance/revocation event to the topic
npm run hedera:anchor
```

`scripts/anchor-credentials.ts`:

- Submits each event's stored `payload` envelope to `HEDERA_HCS_TOPIC_ID`.
- Records the on-chain coordinates (topic, sequence number, dashed tx id, consensus timestamp,
  running hash) into the `hcs_records` table.
- Stamps `issuers.hedera_topic_id` so the app can link an issuer to its log.
- Is **idempotent**: events that already have an `hcs_records` row are skipped, so it is safe to
  re-run after a partial failure. It never re-submits.

Expected output (per event):

```
  ✓ evt_CRED-2026-0004_ISSUED → seq 5 · tx 0.0.123456-1690000000-000000001
...
✓ anchor complete — 14 submitted, 0 skipped (already anchored).
```

There are **14 events** in the seed: **1** `ISSUER_REGISTERED` event (only the single registered
issuer gets one — the unregistered issuer deliberately gets none), **12** `CREDENTIAL_ISSUED`
events (one per credential), and **1** `CREDENTIAL_REVOKED` event. 1 + 12 + 1 = 14.

After anchoring, uploading a valid sample shows the `hcs_evidence` check as **PASS** with a real
topic/sequence/tx (before anchoring it was a WARN "local offline fixture").

---

## 4. Create the x402 demo-payer wallet

A valid transfer needs **distinct** payer and recipient accounts. The recipient is your operator
(the payment goes to `X402_PAYMENT_RECIPIENT`, which defaults to the operator id). The payer is a
second funded account. Derive it from the operator:

```bash
npm run hedera:create-wallet
```

`scripts/create-demo-wallet.ts` generates a fresh key, creates a new testnet account funded with
**5 tHBAR** from your operator, and prints:

```
✓ Demo payer account created
  Account ID  : 0.0.YYYYYYY
  Key type    : ECDSA
  HashScan    : https://hashscan.io/testnet/account/0.0.YYYYYYY

⚠ Copy the private key now — it is shown only once:
  Private key : <hex>

Add these to .env.local:
  X402_DEMO_PAYER_ID=0.0.YYYYYYY
  X402_DEMO_PAYER_PRIVATE_KEY=<hex>
```

Add those two lines to `.env.local`, plus the recipient (usually your operator):

```dotenv
X402_PAYMENT_RECIPIENT=0.0.123456          # your operator id (receives the 0.1 tHBAR)
X402_DEMO_PAYER_ID=0.0.YYYYYYY
X402_DEMO_PAYER_PRIVATE_KEY=<hex>
```

> The private key is printed **once** and never stored — capture it immediately. Pass `--ed25519`
> to the command if you want an ED25519 key instead of the default ECDSA.

Now `GET /api/health` should show `x402.configured: true`. The `?demo=1` report bypass is
**automatically disabled** from this point — real settlement is required.

---

## 5. Prove a real settlement

With operator + recipient + demo-payer keys set, run the agent demo against a running dev server:

```bash
# terminal 1
npm run dev

# terminal 2
npm run agent:demo
```

It uploads the flagship tampered sample, prints the genuine HTTP 402 challenge, then settles a real
x402 payment and prints the decoded `PAYMENT-RESPONSE` settlement + released report. See
[X402_FLOW.md](X402_FLOW.md) for the full walkthrough and expected output.

---

## 6. Verify on HashScan and the Mirror Node

Everything you need shows in the app's Live Activity panel and report as HashScan links. To verify
independently:

### HashScan (visual)

- **Topic** (all your events): `https://hashscan.io/testnet/topic/<HEDERA_HCS_TOPIC_ID>`
- **A transaction** (HCS submit or x402 transfer): `https://hashscan.io/testnet/transaction/<txId>`
  — HashScan accepts **both** the `@`-form and the dashed form of a tx id.
- **An account** (operator / demo payer): `https://hashscan.io/testnet/account/<accountId>`

> Per-message deep links (`/topic/<id>/message/<seq>`) are **not officially guaranteed** by
> HashScan and may change. The always-valid path is the topic page above; for a raw single message
> use the Mirror Node API below. This caveat is repeated in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

### Mirror Node (raw JSON)

Base URL: `https://testnet.mirrornode.hedera.com` (override with `MIRROR_NODE_BASE_URL`).

- **A transaction** — note the **dashed** id form `0.0.X-sss-nnn` (the Mirror Node **rejects** the
  SDK's `@`-form with HTTP 400):

  ```bash
  curl "https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.123456-1690000000-000000001"
  ```

  Look for `"result": "SUCCESS"` and, for a payment, a `transfers` entry crediting your recipient
  exactly `10000000` tinybars.

- **Topic messages** (your credential events, newest first):

  ```bash
  curl "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.XXXXXXX/messages?limit=25&order=desc"
  ```

  The `message` field is **base64** — decode it to see the JSON envelope.

> **Ingestion lag:** the Mirror Node trails consensus by ~2–3 seconds. Cred402 polls with backoff
> (2s → ~10s) rather than assuming read-after-write. A `curl` immediately after a submit may 404
> for a moment; retry.

---

## 7. Environment variable reference

| Variable | Purpose | Example | Server-only | Required local | Required on Render |
|---|---|---|---|---|---|
| `HEDERA_NETWORK` | Which Hedera network | `testnet` | yes | no (default `testnet`) | recommended |
| `HEDERA_OPERATOR_ID` | Operator account id | `0.0.123456` | yes | no (unconfigured mode) | for on-chain |
| `HEDERA_OPERATOR_PRIVATE_KEY` | Operator key (HEX) | `302e02…` / raw hex | **yes** | no | for on-chain |
| `HEDERA_HCS_TOPIC_ID` | Credential-event topic | `0.0.7654321` | yes | after `create-topic` | for HCS anchoring |
| `MIRROR_NODE_BASE_URL` | Mirror Node REST base | `https://testnet.mirrornode.hedera.com` | yes | no (default) | no (default) |
| `X402_NETWORK` | CAIP-2 network | `hedera:testnet` | yes | no (default) | no (default) |
| `X402_PAYMENT_RECIPIENT` | Account that receives payment | `0.0.123456` | yes | for settlement | for settlement |
| `X402_FACILITATOR_URL` | Facilitator base | `https://x402.org/facilitator` | yes | no (default) | no (default) |
| `X402_PRICE` | Report price in tinybars | `10000000` (0.1 HBAR) | yes | no (default) | no (default) |
| `X402_ASSET` | HBAR-native asset id | `0.0.0` | yes | no (default) | no (default) |
| `X402_DEMO_PAYER_ID` | Demo payer account | `0.0.7777777` | yes | for settlement | optional |
| `X402_DEMO_PAYER_PRIVATE_KEY` | Demo payer key (HEX) | raw hex | **yes** | for settlement | optional |

Public (browser-safe) variables — `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_HEDERA_NETWORK`,
`NEXT_PUBLIC_HASHSCAN_BASE_URL` — and `DATABASE_URL` / `PGLITE_DATA_DIR` / `MAX_UPLOAD_SIZE` are
covered in [LOCAL_SETUP.md](LOCAL_SETUP.md) and [DATABASE.md](DATABASE.md).

---

## 8. Troubleshooting

- **`Hedera is not configured`** from a script → `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_PRIVATE_KEY`
  not set in `.env.local`, or the file isn't being loaded. Scripts load `.env.local` via
  `scripts/lib/env`.
- **`Could not parse HEDERA_OPERATOR_PRIVATE_KEY as ECDSA or ED25519`** → provide the **HEX** key
  from the portal, not a mnemonic.
- **`t.startsWith is not a function`** → two Hedera SDKs are installed. Cred402 uses
  **`@hiero-ledger/sdk`** only; never also install `@hashgraph/sdk` (duplicate SDKs break the SDK's
  internal brand checks).
- **Mirror Node returns HTTP 400 for a tx id** → you passed the `@`-form; use the dashed form
  `0.0.X-sss-nnn`. The app converts this automatically via `toDashedTxId`.
- **HCS `hcs_evidence` check still shows WARN after anchoring** → re-run `npm run hedera:anchor`
  and confirm `hcs_records` has rows; also confirm `HEDERA_HCS_TOPIC_ID` is set.
