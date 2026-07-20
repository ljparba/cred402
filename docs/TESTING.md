# Cred402 — Testing

> How to run the test suite, what each test file covers, the isolated engine database, the
> end-to-end sample verifier, and the production checks (lint / typecheck / build).

Related: [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [X402_FLOW.md](X402_FLOW.md).

---

## 1. Running the suite

Tests use Node's **built-in test runner** with **tsx** — no extra test dependencies. Run the whole
suite with the `test` script:

```bash
npm test
```

This runs all **29 tests** across the five files below (the script lists the files explicitly so it
works identically on Windows, macOS, and Linux — a bare `tests/*.test.ts` glob is not expanded by
Node's `--test` on every shell).

The **engine test is DB-backed** and runs against an **isolated** PGlite database so it never
touches your dev DB — it sets `PGLITE_DATA_DIR` to `./.pglite-test` itself at module load. To run it
alone:

```bash
node --import tsx --test tests/engine.test.ts
```

For belt-and-braces isolation you can also pass the env explicitly:

```bash
PGLITE_DATA_DIR=./.pglite-test node --import tsx --test tests/engine.test.ts
```

**Prerequisite for the engine test:** the sample PDFs must exist and the catalogue hashes must be
generated, because it hashes the real files. Run `npm run certs:generate` first if you haven't.

> **29 tests currently pass** across the five files below.

---

## 2. What each test file covers

| File | Covers (IMPLEMENTATION_PLAN §16 area) |
|---|---|
| `tests/hash.test.ts` | **Hashing** — same bytes → same hash; a known SHA-256 vector (`abc`); a one-byte change flips the hash (tamper sensitivity); output is 64 lowercase hex; `hashesEqual` is case-insensitive. |
| `tests/upload.test.ts` | **Upload validation** — magic-byte sniffing (PDF/PNG/JPEG, reject others); empty rejected; oversized (>5 MiB) rejected; declared-type/content mismatch rejected; `application/octet-stream` tolerated when the bytes are valid. |
| `tests/engine.test.ts` | **Credential states** (DB-backed) — every downloadable sample run through the real pipeline (validate → SHA-256 → PDF ID extract → engine) resolves to its catalogue verdict: VALID ×2, TAMPERED, EXPIRED, REVOKED, UNREGISTERED_ISSUER, UNKNOWN. Asserts the flagship tamper invariant (identified credential + HCS evidence + hash mismatch) and that VALID means hash matches. |
| `tests/hedera.test.ts` | **HCS helpers** — `toDashedTxId` (`@`-form → dashed, preserving account-id dots; idempotent; accepts a `TransactionId`-like object — a real bug was caught here); HashScan URL formats; HCS envelope builders (`buildIssuedEvent` omits `expiresAt` when absent; `buildRevokedEvent` chains to the issuance event). |
| `tests/config.test.ts` | **Price formatting** — `tinybarsToHbar`: `10000000` → `0.1`; whole HBAR has no fraction; trailing zeros trimmed; zero. |

The engine test seeds an isolated DB in a `before()` hook (migrate → seed) so verdicts are computed
against the same registry the app uses, with a **fixed clock** (`2026-07-20`) so expired/valid
classification is deterministic.

---

## 3. The end-to-end sample verifier

`npm run verify:samples` is both a developer smoke test and a CI gate. It runs **every** downloadable
sample file through the real pipeline and asserts the verdict matches the catalogue. It exits
non-zero on any mismatch.

```bash
npm run verify:samples
```

Expected:

```
file                                             expected             actual               result
------------------------------------------------------------------------------------------------
valid/hedera-fundamentals.pdf                    VALID                VALID                ✓ pass
valid/data-structures-original.pdf               VALID                VALID                ✓ pass
tampered/data-structures-tampered.pdf            TAMPERED             TAMPERED             ✓ pass
expired/cybersecurity-awareness.pdf              EXPIRED              EXPIRED              ✓ pass
revoked/digital-identity.pdf                     REVOKED              REVOKED              ✓ pass
unregistered/web-dev-foundations.pdf             UNREGISTERED_ISSUER  UNREGISTERED_ISSUER  ✓ pass
fake/counterfeit-certificate.pdf                 UNKNOWN              UNKNOWN              ✓ pass
------------------------------------------------------------------------------------------------
✓ all 7 samples verified with the expected verdict.
```

Like the engine test it uses a fixed clock (`2026-07-20`) so results don't drift with the calendar.
It runs against your current DB, so make sure you've done `db:seed` after `certs:generate`.

---

## 4. Production checks

Run these before deploying or submitting (IMPLEMENTATION_PLAN §16 "Production"):

```bash
npm run lint        # ESLint — must pass
npm run typecheck   # tsc --noEmit — must pass
npm run build       # Next.js production build — must succeed
npm run start       # app starts with the production command
```

Also confirm no required secret is bundled into client code — `serverConfig` throws if a
server-only value is read in the browser, and only `NEXT_PUBLIC_*` values reach the client bundle.

---

## 5. x402 flow testing

The 402 → settle → report flow is tested manually / by script rather than by unit test, because it
needs a running server (and, for real settlement, keys):

- `npm run agent:demo` — the machine-readable client. In unconfigured mode it prints the genuine
  402 (proof of the paywall). In configured mode it settles for real and prints the released report.
- `POST /api/pay` — the built-in demo-wallet payer.
- Raw `curl` to see the 402 header.

Full details and expected output: [X402_FLOW.md](X402_FLOW.md) §6.

---

## 6. Quick "everything green" sequence

```bash
npm install
npm run db:setup
npm run certs:generate
npm run db:seed
npm run verify:samples
npm test                                   # 29 tests
npm run lint
npm run typecheck
npm run build
```
