# Cred402 — Demo / Video Script

> A ~2–3 minute walkthrough for the demo video. It highlights the two hero moments: the
> **original-vs-tampered** certificate pair, and the **x402 402 → settlement → report** flow.

Record in **configured mode** (real testnet settlement) if you can — the real transaction id is the
strongest proof. If you must record in unconfigured mode, use the `?demo=1` report view and say
plainly that settlement is simulated (the 402 itself is still genuine).

Total target: **2:30–3:00**. Keep it moving; the animations tell most of the story.

---

## Before you hit record

- [ ] `npm run db:setup && npm run certs:generate && npm run db:seed`
- [ ] (configured) Hedera keys set, `npm run hedera:anchor` done, demo wallet created.
- [ ] `npm run dev` running; browser at <http://localhost:3000>, zoomed so panels are legible.
- [ ] Have both files handy: `samples/valid/data-structures-original.pdf` and
      `samples/tampered/data-structures-tampered.pdf`.
- [ ] A terminal open for the agent demo (optional but great B-roll).

---

## Script

### 0:00 — Hook (15s)

> "This is Cred402 — pay-per-use credential verification on Hedera. Anyone, or any AI agent, can
> upload a certificate, hit a real HTTP 402 paywall, pay a fraction of a testnet HBAR, and get back
> a machine-readable verification report backed by tamper-evident Hedera Consensus Service records.
> No accounts. Let me show you the part that makes it click."

*(Show the animated hero and the live activity counters.)*

### 0:15 — The original (30s)

> "Here's a genuine certificate — Data Structures and Algorithms."

- Drag `data-structures-original.pdf` into the upload workspace.

> "The server hashes it in memory — it never stores the file — and identifies it as credential
> CRED-2026-0004. Watch the scan and the SHA-256 form."

*(Let the scanning/hashing animation play. Open the report — via `?demo=1` if unconfigured.)*

> "VALID. All six checks pass: the uploaded hash matches the hash anchored on Hedera at issuance,
> the issuer is registered, it's not revoked, not expired, and there's an HCS proof."

### 0:45 — The tamper (45s) — the money shot

> "Now the same certificate — but someone edited it after it was issued. To a human it looks
> identical."

- Drag `data-structures-tampered.pdf` in. Put the two side by side if your UI allows.

> "One field — the grade — was changed. That's enough."

*(Open the report.)*

> "TAMPERED. Same credential ID, the HCS issuance proof still exists — but the uploaded SHA-256 no
> longer matches the anchored hash. Look at the diff: two hashes, provably different. Cred402
> caught a post-issuance edit against an immutable anchor. That's the whole pitch in one screen."

### 1:30 — The 402 paywall + settlement (50s)

> "But the full report isn't free. It's gated by a genuine HTTP 402."

*(Either show the browser 402 gate + "Pay with demo wallet", or cut to the terminal.)*

Terminal option:

```bash
npm run agent:demo
```

> "This is an autonomous agent — a program, not a browser. It requests the report and gets a real
> 402 Payment Required, with the payment terms: the Hedera exact scheme, 0.1 testnet HBAR, and the
> facilitator's fee-payer account, injected live."

*(Configured mode:)*

> "It signs a Hedera transfer, the facilitator co-signs the fee and submits it, and — crucially —
> our server independently re-confirms on the Mirror Node that exactly 0.1 tHBAR reached the
> recipient before releasing anything. Here's the released report, and here's the real transaction."

- Click the HashScan link.

> "There it is on HashScan: a SUCCESS transfer on Hedera Testnet. The report is unlocked, and that
> transaction can never unlock a second report — replay is rejected."

### 2:20 — Close (20s)

> "So: accountless, machine-readable, pay-per-use verification. A real x402 payment on Hedera, a
> real HCS anchor, and a tamper check anyone can trust. It's an open-source testnet proof of
> concept — repo and docs in the description. Thanks for watching."

*(End on the live activity feed showing the new HCS event and settled payment.)*

---

## Shot list / B-roll

| Moment | Grab this on screen |
|---|---|
| Hero | The animated hero + headline stats |
| Upload | Drag-and-drop + the scanning line + hash forming |
| VALID report | The verified seal + six green checks |
| TAMPERED report | The two-hash diff panel side by side |
| 402 | The decoded `PAYMENT-REQUIRED` (scheme exact / hedera:testnet / 10000000 / feePayer) |
| Settlement | The `PAYMENT-RESPONSE` + released report JSON in the terminal |
| Proof | The HashScan transaction page (SUCCESS, 0.1 tHBAR) |
| Live activity | New HCS event + settled payment in the feed |

## Talking-point cheat sheet

- Price: **0.1 tHBAR = 10,000,000 tinybars**, asset `0.0.0` (HBAR-native).
- The 402 is **real** — not a donate button, not an "I paid" checkbox.
- Settlement is **independently re-verified** on Mirror Node (we don't trust the facilitator).
- The tamper case: **known credential + HCS evidence + hash mismatch = edited after issuance**.
- Verification is **deterministic** — six checks, no AI.
- Everything is **Hedera Testnet**; testnet HBAR has no monetary value.
