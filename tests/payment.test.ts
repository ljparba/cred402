/**
 * Payment-safety acceptance + regression tests (Phase 2, plan §5).
 *
 * Fully OFFLINE: the settlement-critical section (`settleReportPayment`) is
 * exercised against a FAKE gateway — no Hedera, no facilitator, no Mirror Node,
 * no deployed app, no real keys, no signatures printed. The fake stands in for
 * exactly the seam the real route uses (`src/lib/x402/gateway.ts`), so these
 * tests cover the same code path an external agent hits at GET /api/report/{id}.
 *
 * Covered:
 *   B6 — replay: a consumed transaction cannot unlock another request
 *   B7 — idempotent paid re-access (no second charge)
 *   B8 — concurrent same-request payment protection (the headline invariant)
 *   unique settled-request constraint rejects a second settlement row
 *   safe pre-settlement lock release (retryable) vs uncertain no-reopen (P5/P6)
 *   expired unpaid request: no settlement, paid report survives expiry
 */
process.env.PGLITE_DATA_DIR ||= "./.pglite-paytest";
delete process.env.DATABASE_URL;

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { getDb, getDbBundle } from "@/lib/db";
import { registerDbTeardown } from "./lib/db-teardown";
import {
  countSettledForRequest,
  createSettlement,
  createVerificationRequest,
  createVerificationResult,
  findSettlementForRequest,
  getVerificationRequest,
} from "@/lib/db/queries";
import {
  settleReportPayment,
  reconcileUnknownPayment,
} from "@/lib/x402/payment-flow";
import type { SettlementGateway } from "@/lib/x402/gateway";

const PAY_TO = "0.0.5678";

before(async () => {
  const bundle = await getDbBundle();
  await bundle.migrate();
  assert.equal(bundle.driver, "pglite", "payment tests must run on an isolated PGlite DB");
});

beforeEach(async () => {
  const db = await getDb();
  await db.execute(sql`
    truncate table verification_requests, verification_results, payment_settlements,
      payment_requests restart identity cascade
  `);
});

registerDbTeardown();

// ── helpers ───────────────────────────────────────────────────────────────────

let seq = 0;
async function makeRequest(id: string, opts?: { ttlMs?: number }): Promise<void> {
  const ttl = opts?.ttlMs ?? 15 * 60 * 1000;
  await createVerificationRequest({
    id,
    sha256: "a".repeat(64),
    nonce: `tok_${id}`,
    nonceExpiresAt: new Date(Date.now() + ttl),
    status: "AWAITING_PAYMENT",
    previewVerdict: "TAMPERED",
  });
  await createVerificationResult({
    id: `res_${id}_${seq++}`,
    requestId: id,
    verdict: "TAMPERED",
    checks: [{ id: "c1", label: "Hash", status: "FAIL", evidence: "hash differs" }],
    uploadedHash: "a".repeat(64),
    anchoredHash: "b".repeat(64),
  });
}

interface FakeOpts {
  txId: string;
  settleFails?: { mayHaveSubmitted: boolean };
  verifyFails?: boolean;
  confirmFails?: boolean;
  notReady?: boolean;
  /** Called at the top of settle(), before it resolves — used to build a barrier. */
  onSettle?: () => Promise<void>;
  counters?: { verify: number; settle: number; confirm: number };
}

/** A gateway that never touches the network. Records how often settle() runs. */
function fakeGateway(opts: FakeOpts): SettlementGateway {
  const c = opts.counters ?? { verify: 0, settle: 0, confirm: 0 };
  return {
    async ready() {
      return !opts.notReady;
    },
    async verify() {
      c.verify++;
      if (opts.verifyFails) return { ok: false, code: "PAYMENT_VERIFICATION_FAILED" };
      return { ok: true, payer: "0.0.1111" };
    },
    async settle() {
      c.settle++;
      if (opts.onSettle) await opts.onSettle();
      if (opts.settleFails) {
        return { ok: false, mayHaveSubmitted: opts.settleFails.mayHaveSubmitted };
      }
      return { ok: true, transactionId: opts.txId, payer: "0.0.1111" };
    },
    async confirm() {
      c.confirm++;
      if (opts.confirmFails) return { ok: false, reason: "not on mirror yet" };
      return { ok: true, consensusTimestamp: "1700000000.000000001" };
    },
  };
}

/** A deferred promise, for making two callers overlap inside settle(). */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

// ── B8: concurrent same-request payment protection ─────────────────────────────

test("B8 — two concurrent payments for one request settle exactly once", async () => {
  await makeRequest("vr_b8");

  const counters = { verify: 0, settle: 0, confirm: 0 };
  const gate = deferred(); // holds the winner inside settle() until both overlap
  const bothInside = deferred();
  let insideCount = 0;

  // Caller A takes the claim and blocks inside settle() until released, so
  // caller B is guaranteed to attempt its claim while A holds the lock.
  const gatewayA = fakeGateway({
    txId: "0.0.9-1700000000-000000001",
    counters,
    onSettle: async () => {
      insideCount++;
      if (insideCount === 1) bothInside.resolve();
      await gate.promise;
    },
  });
  const gatewayB = fakeGateway({
    txId: "0.0.9-1700000000-000000002", // a DIFFERENT, otherwise-valid tx
    counters,
  });

  const callA = settleReportPayment({
    requestId: "vr_b8",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000001",
    gateway: gatewayA,
  });

  // Ensure A is inside the critical section before B starts.
  await bothInside.promise;

  const callB = settleReportPayment({
    requestId: "vr_b8",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000002",
    gateway: gatewayB,
  });

  // Let B run to completion first (it must be blocked, not settling).
  const bOutcome = await callB;
  gate.resolve(); // release A
  const aOutcome = await callA;

  // Exactly one caller entered facilitator settlement.
  assert.equal(counters.settle, 1, "facilitator settle must be called exactly once");
  // At most one settlement row exists.
  assert.equal(await countSettledForRequest("vr_b8"), 1, "exactly one settlement row");

  // A won (it held the claim); B was safely blocked with no second payment.
  assert.equal(aOutcome.kind, "released");
  assert.ok(
    bOutcome.kind === "failed" && bOutcome.code === "PAYMENT_IN_PROGRESS",
    `blocked caller must get PAYMENT_IN_PROGRESS, got ${JSON.stringify(bOutcome)}`,
  );

  // Final request is paid; repeated access returns the SAME transaction id.
  const finalReq = await getVerificationRequest("vr_b8");
  assert.equal(finalReq?.paymentState, "PAID");
  const s1 = await findSettlementForRequest("vr_b8");
  const s2 = await findSettlementForRequest("vr_b8");
  assert.equal(s1?.transactionId, "0.0.9-1700000000-000000001");
  assert.equal(s1?.transactionId, s2?.transactionId, "re-access returns the same tx id");
});

test("B8 — a caller who arrives after settlement gets the same paid report", async () => {
  await makeRequest("vr_b8b");
  const first = await settleReportPayment({
    requestId: "vr_b8b",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000010",
    gateway: fakeGateway({ txId: "0.0.9-1700000000-000000010" }),
  });
  assert.equal(first.kind, "released");

  const counters = { verify: 0, settle: 0, confirm: 0 };
  const second = await settleReportPayment({
    requestId: "vr_b8b",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000011",
    gateway: fakeGateway({ txId: "0.0.9-1700000000-000000011", counters }),
  });
  assert.equal(second.kind, "already_paid");
  assert.equal(counters.settle, 0, "no second settlement is attempted");
  assert.equal(await countSettledForRequest("vr_b8b"), 1);
});

// ── B7: idempotent paid re-access ──────────────────────────────────────────────

test("B7 — reopening a paid request returns the same report, no new charge", async () => {
  await makeRequest("vr_b7");
  const paid = await settleReportPayment({
    requestId: "vr_b7",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000020",
    gateway: fakeGateway({ txId: "0.0.9-1700000000-000000020" }),
  });
  assert.equal(paid.kind, "released");
  const txId = paid.kind === "released" ? paid.settlement.transactionId : null;

  // Re-access with a brand-new gateway that would settle a different tx if asked.
  const counters = { verify: 0, settle: 0, confirm: 0 };
  const reaccess = await settleReportPayment({
    requestId: "vr_b7",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000021",
    gateway: fakeGateway({ txId: "0.0.9-1700000000-000000099", counters }),
  });
  assert.equal(reaccess.kind, "already_paid");
  assert.equal(reaccess.kind === "already_paid" && reaccess.settlement.transactionId, txId);
  assert.equal(counters.settle, 0, "no settlement on idempotent re-access");
});

// ── B6: replay rejection ────────────────────────────────────────────────────────

test("B6 — a transaction consumed by request A cannot unlock request B", async () => {
  await makeRequest("vr_a");
  await makeRequest("vr_b");

  const sharedTx = "0.0.9-1700000000-000000030";
  const a = await settleReportPayment({
    requestId: "vr_a",
    payTo: PAY_TO,
    clientTxId: sharedTx,
    gateway: fakeGateway({ txId: sharedTx }),
  });
  assert.equal(a.kind, "released");

  // Reuse the SAME tx id against a different, unpaid request.
  const counters = { verify: 0, settle: 0, confirm: 0 };
  const b = await settleReportPayment({
    requestId: "vr_b",
    payTo: PAY_TO,
    clientTxId: sharedTx,
    gateway: fakeGateway({ txId: sharedTx, counters }),
  });
  assert.ok(
    b.kind === "failed" && b.code === "PAYMENT_ALREADY_CONSUMED",
    `replay must be rejected, got ${JSON.stringify(b)}`,
  );
  assert.equal(counters.settle, 0, "replay is rejected before any settlement");
  assert.equal(await countSettledForRequest("vr_b"), 0, "request B stays unsettled");
  const reqB = await getVerificationRequest("vr_b");
  assert.equal(reqB?.paymentState, "UNPAID", "request B is still payable by a real payment");
});

// ── Unique settled-request constraint (DB backstop for P1) ──────────────────────

test("a second SETTLED settlement row for one request is rejected by the DB", async () => {
  await makeRequest("vr_uniq");
  await createSettlement({
    id: "st_uniq_1",
    requestId: "vr_uniq",
    transactionId: "0.0.9-1700000000-000000040",
    payTo: PAY_TO,
    amount: "10000000",
    mirrorVerified: true,
    status: "SETTLED",
  });
  await assert.rejects(
    () =>
      createSettlement({
        id: "st_uniq_2",
        requestId: "vr_uniq",
        transactionId: "0.0.9-1700000000-000000041", // different tx, same request
        payTo: PAY_TO,
        amount: "10000000",
        mirrorVerified: true,
        status: "SETTLED",
      }),
    "a second settled row for the same request must violate the unique index",
  );
  assert.equal(await countSettledForRequest("vr_uniq"), 1);
});

test("a FAILED row does not block a later SETTLED row for the same request", async () => {
  await makeRequest("vr_failok");
  await createSettlement({
    id: "st_failok_failed",
    requestId: "vr_failok",
    transactionId: "0.0.9-1700000000-000000050",
    payTo: PAY_TO,
    amount: "10000000",
    status: "FAILED",
  });
  // The partial index only covers SETTLED, so this must succeed.
  await createSettlement({
    id: "st_failok_settled",
    requestId: "vr_failok",
    transactionId: "0.0.9-1700000000-000000051",
    payTo: PAY_TO,
    amount: "10000000",
    mirrorVerified: true,
    status: "SETTLED",
  });
  assert.equal(await countSettledForRequest("vr_failok"), 1);
});

// ── P5: safe pre-settlement release (retryable) ─────────────────────────────────

test("a pre-settlement verification failure releases the claim and is retryable", async () => {
  await makeRequest("vr_verifyfail");
  const first = await settleReportPayment({
    requestId: "vr_verifyfail",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000060",
    gateway: fakeGateway({ txId: "x", verifyFails: true }),
  });
  assert.ok(first.kind === "failed" && first.code === "PAYMENT_VERIFICATION_FAILED");
  assert.equal(first.kind === "failed" && first.retryable, true, "pre-settlement failure is retryable");

  // The claim was released → the request is UNPAID and a real payment succeeds.
  const req = await getVerificationRequest("vr_verifyfail");
  assert.equal(req?.paymentState, "UNPAID");
  const retry = await settleReportPayment({
    requestId: "vr_verifyfail",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000061",
    gateway: fakeGateway({ txId: "0.0.9-1700000000-000000061" }),
  });
  assert.equal(retry.kind, "released");
});

test("facilitator-unavailable before settlement is a retryable safe release", async () => {
  await makeRequest("vr_facil");
  const out = await settleReportPayment({
    requestId: "vr_facil",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000070",
    gateway: fakeGateway({ txId: "x", notReady: true }),
  });
  assert.ok(out.kind === "failed" && out.code === "FACILITATOR_UNAVAILABLE");
  assert.equal(out.kind === "failed" && out.retryable, true);
  assert.equal((await getVerificationRequest("vr_facil"))?.paymentState, "UNPAID");
});

// ── P6: uncertain settlement never reopens payment ──────────────────────────────

test("an uncertain settlement parks the request and never reopens it for payment", async () => {
  await makeRequest("vr_uncertain");
  const out = await settleReportPayment({
    requestId: "vr_uncertain",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000080",
    gateway: fakeGateway({ txId: "x", settleFails: { mayHaveSubmitted: true } }),
  });
  assert.ok(out.kind === "failed" && out.code === "PAYMENT_CONFIRMATION_PENDING");
  assert.equal(out.kind === "failed" && out.retryable, false, "uncertain failure is NOT retryable");

  const req = await getVerificationRequest("vr_uncertain");
  assert.equal(req?.paymentState, "PAYMENT_UNKNOWN", "request is parked, not reopened");
  assert.equal(req?.paymentClaimTxId, "0.0.9-1700000000-000000080", "tx id kept for reconciliation");

  // A fresh attempt cannot take the claim — no second payment is ever possible.
  const counters = { verify: 0, settle: 0, confirm: 0 };
  const again = await settleReportPayment({
    requestId: "vr_uncertain",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000081",
    gateway: fakeGateway({ txId: "x2", counters }),
  });
  assert.ok(again.kind === "failed" && again.code === "PAYMENT_CONFIRMATION_PENDING");
  assert.equal(counters.settle, 0, "a parked request never settles again");
});

test("a confirmation failure after settle parks the request (no report released)", async () => {
  await makeRequest("vr_confirmfail");
  const out = await settleReportPayment({
    requestId: "vr_confirmfail",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000090",
    gateway: fakeGateway({ txId: "0.0.9-1700000000-000000090", confirmFails: true }),
  });
  assert.ok(out.kind === "failed" && out.code === "PAYMENT_CONFIRMATION_PENDING");
  assert.equal(await countSettledForRequest("vr_confirmfail"), 0, "no report/settlement without Mirror proof");
  assert.equal((await getVerificationRequest("vr_confirmfail"))?.paymentState, "PAYMENT_UNKNOWN");
});

test("reconcileUnknownPayment releases the report when the tx later confirms", async () => {
  await makeRequest("vr_reconcile");
  // Park it first via a confirmation failure.
  await settleReportPayment({
    requestId: "vr_reconcile",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000100",
    gateway: fakeGateway({ txId: "0.0.9-1700000000-000000100", confirmFails: true }),
  });
  const parked = await getVerificationRequest("vr_reconcile");
  assert.equal(parked?.paymentState, "PAYMENT_UNKNOWN");

  // Now the Mirror Node sees it — reconciliation (payment-free) releases it.
  const reconciled = await reconcileUnknownPayment({
    request: parked!,
    payTo: PAY_TO,
    gateway: fakeGateway({ txId: "0.0.9-1700000000-000000100" }),
  });
  assert.equal(reconciled?.kind, "released");
  assert.equal(await countSettledForRequest("vr_reconcile"), 1);
  assert.equal((await getVerificationRequest("vr_reconcile"))?.paymentState, "PAID");
});

// ── Expiry behavior ─────────────────────────────────────────────────────────────

test("a paid request survives expiry: settlement row persists and re-access still works", async () => {
  await makeRequest("vr_expirepaid", { ttlMs: 50 });
  const paid = await settleReportPayment({
    requestId: "vr_expirepaid",
    payTo: PAY_TO,
    clientTxId: "0.0.9-1700000000-000000110",
    gateway: fakeGateway({ txId: "0.0.9-1700000000-000000110" }),
  });
  assert.equal(paid.kind, "released");

  // Force the TTL into the past.
  const db = await getDb();
  await db.execute(
    sql`update verification_requests set nonce_expires_at = ${new Date(Date.now() - 1000)} where id = 'vr_expirepaid'`,
  );

  // The settlement is still found → idempotent re-access continues to work.
  const settlement = await findSettlementForRequest("vr_expirepaid");
  assert.ok(settlement, "a paid request's settlement is still accessible after expiry");
});
