# Cred402 — x402 Payment Flow

> The genuine HTTP `402 Payment Required` flow that gates the verification report: request → 402 →
> signed transaction → verify + settle → independent Mirror proof → report release. Plus the header
> formats, the security model, and how to test it.

This is **x402 protocol v2** (`@x402/*` scope, governed by the x402 Foundation), using the Hedera
`exact` scheme against the official public facilitator `https://x402.org/facilitator`.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) §5, [HEDERA_SETUP.md](HEDERA_SETUP.md),
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## 1. Why Hedera's `exact` scheme differs from EVM

On EVM chains, x402's `exact` scheme signs an authorization message that includes a `nonce`,
cryptographically binding the payment to a resource. **Hedera does not work this way.** The Hedera
`exact` scheme is a **partially-signed transaction with facilitator fee sponsorship**:

1. The server's 402 advertises `extra.feePayer` — the facilitator's own account, injected at
   startup from the facilitator's public `/supported` endpoint.
2. The client builds a `TransferTransaction` paying `payTo`, sets
   `transactionId.accountId = feePayer`, and signs it locally.
3. The client base64-serializes it into the payment payload `{ transaction: "<base64>" }`.
4. The facilitator verifies it, **co-signs as the fee payer**, and submits it. **The client pays
   zero gas.**

There is no nonce field in the signed transaction and no cryptographic binding to the resource.
Cred402 closes that gap with defence in depth — see §5.

---

## 2. The genuine 402 sequence

```
CLIENT (browser / AI agent)                          CRED402 SERVER
────────────────────────────                         ────────────────────────────
POST /api/verify (file)  ───────────────────────────►  hash + identify, store report (withheld)
   ◄─────────────────── 200 free preview { requestId, locked:true, reportUrl }

GET /api/report/{requestId}  ───────────────────────►  no PAYMENT-SIGNATURE header?
   ◄─── 402 Payment Required                            build accepts via x402ResourceServer
        PAYMENT-REQUIRED: <base64 JSON>                 (facilitator feePayer merged in)
        body: { x402Version:2, accepts:[…], resource }

(build TransferTransaction → payTo,
 transactionId.accountId = feePayer, sign)

GET /api/report/{requestId}
    PAYMENT-SIGNATURE: <base64 JSON>  ─────────────────►  1. REPLAY CHECK FIRST (extract tx id;
                                                             reject 409 if already consumed)
                                                          2. freshness: nonce not expired
                                                          3. facilitator verify → settle
                                                             (REAL fee-sponsored testnet transfer)
                                                          4. INDEPENDENT Mirror Node proof:
                                                             result==SUCCESS ∧ exact credit to payTo
                                                          5. record settlement (UNIQUE tx id)
                                                          6. burn nonce, mark COMPLETED
   ◄─── 200 OK                                            release FULL report
        PAYMENT-RESPONSE: <base64 JSON settlement>
        body: { verdict, checks[], credential, hashes, hcs, payment{…} }
```

The free preview (`/api/verify`) never contains a verdict or checks. The report route is the **only**
place they are emitted, and only after a proven settlement (or, in unconfigured mode only, the
`?demo=1` bypass).

---

## 3. Header formats

All three x402 v2 headers are **base64-encoded JSON**.

| Header | Direction | Carries |
|---|---|---|
| `PAYMENT-REQUIRED` | server → client (on 402) | the `accepts` requirements + resource info |
| `PAYMENT-SIGNATURE` | client → server (retry) | the signed payment payload (base64 transaction) |
| `PAYMENT-RESPONSE` | server → client (on success) | the settlement result (tx id, payer, timestamp) |

Cred402 encodes/decodes these with `@x402/core/http`
(`encodePaymentRequiredHeader` / `decodePaymentSignatureHeader` / `encodePaymentResponseHeader`).

### Decoded 402 `accepts` example

When you `GET /api/report/{id}` with no payment (and the server is configured with a recipient),
the decoded `PAYMENT-REQUIRED` header contains an `accepts` entry like this:

```jsonc
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "hedera:testnet",
      "asset": "0.0.0",            // HBAR-native
      "amount": "10000000",        // tinybars = 0.1 tHBAR
      "payTo": "0.0.123456",       // X402_PAYMENT_RECIPIENT (usually the operator)
      "maxTimeoutSeconds": 180,
      "extra": {
        "feePayer": "0.0.9185802"  // the facilitator's fee-sponsoring account (LIVE-injected)
      }
    }
  ],
  "resource": {
    "url": "http://localhost:3000/api/report/vr_...",
    "description": "Cred402 full credential verification report",
    "mimeType": "application/json"
  }
}
```

> **Be precise about what is and isn't proven — three distinct levels:**
>
> 1. **Facilitator capability + `feePayer` discovery — proven live, no keys needed.** The
>    facilitator's `/supported` endpoint is public, so `x402ResourceServer.initialize()` succeeds and
>    injects a **real** `extra.feePayer` (e.g. `0.0.9185802`) into the challenge in unconfigured mode.
> 2. **A configured challenge with a real `payTo` — requires `X402_PAYMENT_RECIPIENT`.** With a
>    recipient set, the advertised `payTo` is your real account (above it is a placeholder). This is
>    still just the *challenge*, not a payment.
> 3. **An actual, completed on-chain settlement — NOT executed in this build.** Settling needs the
>    operator + demo-payer keys and authorization to spend testnet HBAR; it is an owner acceptance
>    step (see [HEDERA_SETUP.md](HEDERA_SETUP.md) and
>    [OWNER_ACCEPTANCE_TEST.md](OWNER_ACCEPTANCE_TEST.md)). The full code path exists and typechecks
>    but has not been run against live Hedera.

### Unconfigured 402 (no recipient set)

If `X402_PAYMENT_RECIPIENT` is unset, the server cannot advertise a real `payTo`, so it returns an
honest 402 with no `accepts` and `configured: false` — never a fake report:

```jsonc
{
  "x402Version": 2,
  "error": "Payment required, but live settlement is not configured on this deployment.",
  "accepts": [],
  "configured": false,
  "requestId": "vr_...",
  "price": { "asset": "0.0.0", "amount": "10000000", "amountHbar": "0.1", "network": "hedera:testnet" }
}
```

---

## 4. Server implementation (where each step lives)

| Step | File |
|---|---|
| Build `accepts` requirements + resource info | `src/lib/x402/server.ts` (`buildReportRequirements`, `reportResourceInfo`) |
| Initialize facilitator client + register `exact` Hedera scheme | `src/lib/x402/server.ts` (`getResourceServer`) |
| The 402/verify/settle/release handler | `src/app/api/report/[requestId]/route.ts` |
| Extract signed tx id (replay check first) | `@x402/hedera` `extractTransactionFromPayload` + `inspectHederaTransaction` |
| Independent Mirror Node settlement proof | `src/lib/x402/settlement.ts` (`verifySettlementOnChain`) |
| Challenge-freshness nonce (TTL) | `src/lib/x402/nonce.ts` |
| Built-in "demo wallet" server-side payer | `src/app/api/pay/route.ts` |
| Machine-readable agent client | `scripts/agent-client.ts` |

The report route rejects with clear, typed errors: `404 REQUEST_NOT_FOUND`, `400 BAD_PAYMENT_SIGNATURE`,
`400 BAD_PAYMENT_TRANSACTION`, `409 PAYMENT_ALREADY_CONSUMED`, `402 CHALLENGE_EXPIRED`,
`402 REQUIREMENTS_MISMATCH`, `402 PAYMENT_INVALID`, `402 SETTLEMENT_FAILED`, `402 PROOF_FAILED`,
`503 FACILITATOR_UNAVAILABLE`.

---

## 5. Security model (defence in depth)

The Hedera `exact` scheme cannot bind a nonce into the signed transaction, so resource identity
travels only in the client-asserted, unsigned `accepted` block. Cred402 closes this with four
layers (IMPLEMENTATION_PLAN §3.5):

1. **Hedera-native single-use** — a transaction id is single-use on-ledger; resubmission yields
   `DUPLICATE_TRANSACTION`.
2. **Server-side first-use-wins binding** — `payment_settlements.transaction_id` has a **UNIQUE**
   constraint, so any given settled transaction can unlock **exactly one** report, ever. The report
   route also replay-checks the tx id **before** spending any settlement effort.
3. **Independent settlement proof** — Cred402 never trusts the facilitator's word. `settlement.ts`
   re-verifies against the Mirror Node that the transaction reached `SUCCESS` **and** that `payTo`
   received a **net credit of exactly `10000000` tinybars** (summing signed transfer amounts for
   that account). If the money didn't provably move, no report.
4. **Challenge-freshness nonce (TTL)** — a nonce is issued with the request and carried in the 402
   with a TTL. **Honest limitation:** because the Hedera scheme can't bind the nonce into the
   signed transaction, the nonce provides only **freshness** (the buyer is acting on a live,
   un-expired challenge), not cryptographic resource binding. Layers 1–3 provide the actual replay
   protection and stand regardless of the nonce. This gap is documented in
   [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## 6. How to test the flow

### Option A — the AI-agent demo (recommended)

`npm run agent:demo` runs a real machine-readable x402 client. It uploads the flagship tampered
sample, shows the genuine 402, then (if configured) settles for real.

```bash
# terminal 1 — the app must be running
npm run dev

# terminal 2
npm run agent:demo
# or, to pay for an already-created request:
npm run agent:demo <requestId>
```

**Unconfigured mode** (no demo-payer keys) prints the decoded 402 challenge and exits 0 with:

```
ℹ Demo-payer keys are not configured, so no live settlement was performed.
  The HTTP 402 above IS the genuine paywall. To settle for real:
    1. set HEDERA_OPERATOR_ID/KEY + X402_PAYMENT_RECIPIENT,
    2. run `npm run hedera:create-wallet` and set X402_DEMO_PAYER_ID/KEY,
    3. re-run `npm run agent:demo`.
```

**Configured mode** additionally prints the decoded `PAYMENT-RESPONSE` settlement and the released
report JSON (verdict `TAMPERED`, the six checks, hash diff, HCS proof, and the real transaction id
+ HashScan URL).

Set `APP_URL` (or `NEXT_PUBLIC_APP_URL`) if your dev server is not on `:3000`.

### Option B — the built-in demo wallet (browser)

`POST /api/pay` with `{ "requestId": "..." }` makes the **server** act as the x402 payer using the
demo-payer account, performing the full handshake against our own `/api/report/{id}` and returning
the released report. Requires demo-payer + operator keys; without them it returns
`400 DEMO_WALLET_NOT_CONFIGURED` rather than pretending. This powers the "Pay with demo wallet"
button in the UI.

### Option C — raw curl (see the 402)

```bash
# 1. upload a sample to get a requestId
curl -s -F "file=@samples/tampered/data-structures-tampered.pdf" \
  http://localhost:3000/api/verify | jq

# 2. hit the protected report with no payment → HTTP 402
curl -i http://localhost:3000/api/report/<requestId>
# → 402, with a base64 PAYMENT-REQUIRED header. Decode it:
#   echo "<header value>" | base64 -d | jq
```

You cannot complete a settlement with plain curl (you'd have to build and sign a Hedera transaction)
— use Option A or B for that.

### What proves it's a real paywall

- The report route returns **HTTP 402** (not 200) until a valid `PAYMENT-SIGNATURE` is presented.
- The full report **cannot** be fetched for free — the free `/api/verify` response has
  `locked: true` and no verdict/checks.
- In configured mode, the released report carries a **real testnet transaction id** and HashScan
  link, and the settlement is independently Mirror-verified (`mirrorVerified: true`).
