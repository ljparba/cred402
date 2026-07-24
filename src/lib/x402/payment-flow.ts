/**
 * The settlement-critical section for ONE verification request.
 *
 * Every payment invariant lives here, and every caller (the x402-gated report
 * route today, any future one) goes through it — so an external agent hitting
 * `GET /api/report/{id}` directly is protected exactly like the browser flow:
 *
 *  P1  a request has at most ONE successful settlement
 *  P2  at most one caller is inside the critical section at a time
 *  P3  a transaction consumed by request A can never unlock request B
 *  P4  reopening a paid request returns the same report + tx id, no new charge
 *  P5  a retry is offered ONLY when we can prove nothing was submitted
 *  P6  an uncertain or post-submission failure never reopens the request
 *  P7  no report is released before independent Mirror Node confirmation
 *  P8  no key, signature, signed bytes, IP, or DB secret is logged or returned
 *
 * P2 is enforced by an ATOMIC compare-and-set on `verification_requests
 * .payment_state` (UNPAID → PAYMENT_IN_PROGRESS), not an in-memory mutex, so it
 * holds across multiple Render processes/instances. P1 is additionally backed
 * by a database UNIQUE index on the settled `request_id`, and P3 by the UNIQUE
 * index on `transaction_id` — the application lock and the database agree.
 *
 * FAILURE CLASSIFICATION is the heart of this module:
 *   released       → provable, Mirror-confirmed settlement; report unlocked
 *   safe-to-retry  → the failure provably happened BEFORE any submission, so
 *                    the claim is released and the request is payable again
 *   uncertain      → the failure happened at or after submission (or its state
 *                    is unknowable), so the request is parked in
 *                    PAYMENT_UNKNOWN: no report, and NO further payment ever
 */
import { newSettlementId } from "@/lib/ids";
import { serverConfig } from "@/lib/config";
import { hashscanTransactionUrl } from "@/lib/hedera/hashscan";
import {
  claimPaymentInProgress,
  createSettlement,
  findSettlementByTxId,
  findSettlementForRequest,
  getVerificationRequest,
  markPaymentPaid,
  markPaymentUnknown,
  releasePaymentClaim,
} from "@/lib/db/queries";
import { markRequestCompleted } from "@/lib/x402/request-ttl";
import type { SettlementGateway } from "@/lib/x402/gateway";
import type { PaymentSettlement, VerificationRequest } from "@/lib/db/schema";

/** Client-visible payment error codes. Safe, stable, and free of internals. */
export type PaymentFailureCode =
  | "PAYMENT_ALREADY_CONSUMED"
  | "PAYMENT_IN_PROGRESS"
  | "PAYMENT_CONFIRMATION_PENDING"
  | "FACILITATOR_UNAVAILABLE"
  | "REQUIREMENTS_MISMATCH"
  | "PAYMENT_VERIFICATION_FAILED"
  | "PAYMENT_SETTLEMENT_FAILED";

export type SettlementOutcome =
  | { kind: "released"; settlement: PaymentSettlement; raw?: unknown }
  | { kind: "already_paid"; settlement: PaymentSettlement }
  | {
      kind: "failed";
      code: PaymentFailureCode;
      status: number;
      message: string;
      /**
       * True ONLY for failures proven to precede any submission. The UI may
       * offer "Retry" for these and must never auto-retry the others.
       */
      retryable: boolean;
    };

function failed(
  code: PaymentFailureCode,
  status: number,
  message: string,
  retryable: boolean,
): SettlementOutcome {
  return { kind: "failed", code, status, message, retryable };
}

const IN_PROGRESS = failed(
  "PAYMENT_IN_PROGRESS",
  409,
  "Another payment for this request is already being settled. No second payment was sent.",
  false,
);

const CONFIRMATION_PENDING = failed(
  "PAYMENT_CONFIRMATION_PENDING",
  409,
  "A payment for this request was submitted but is not yet confirmed. " +
    "This request will not accept another payment; check its status again shortly.",
  false,
);

/**
 * Decide what a caller who could NOT take the claim should see. Never invents a
 * new payment path: the only good outcomes are the existing report, "someone
 * else is settling", or "an earlier payment is unresolved".
 */
async function outcomeForBlockedCaller(requestId: string): Promise<SettlementOutcome> {
  const settlement = await findSettlementForRequest(requestId);
  if (settlement) return { kind: "already_paid", settlement };

  const request = await getVerificationRequest(requestId);
  if (request?.paymentState === "PAYMENT_UNKNOWN") return CONFIRMATION_PENDING;
  if (request?.paymentState === "PAID") {
    // Marked paid without a readable settlement row — do not offer payment.
    return CONFIRMATION_PENDING;
  }
  return IN_PROGRESS;
}

/**
 * Run one payment attempt for `requestId` to completion.
 *
 * `clientTxId` is the Hedera transaction id extracted from the caller's signed
 * payload (a public identifier — never the signature or the signed bytes). It
 * is replay-checked BEFORE any settlement effort and reused as the
 * reconciliation handle if the attempt ends uncertain.
 */
export async function settleReportPayment(args: {
  requestId: string;
  payTo: string;
  clientTxId: string;
  gateway: SettlementGateway;
}): Promise<SettlementOutcome> {
  const { requestId, payTo, clientTxId, gateway } = args;

  // ── P4: already settled → idempotent release, no charge, no claim ─────────
  const existing = await findSettlementForRequest(requestId);
  if (existing) return { kind: "already_paid", settlement: existing };

  // ── P3: this transaction may already have unlocked another report ─────────
  const consumed = await findSettlementByTxId(clientTxId);
  if (consumed) {
    return failed(
      "PAYMENT_ALREADY_CONSUMED",
      409,
      "This payment has already been consumed for a report.",
      false,
    );
  }

  // ── P2: atomic entry to the critical section. Exactly one caller wins ─────
  const claimed = await claimPaymentInProgress(requestId);
  if (!claimed) return outcomeForBlockedCaller(requestId);

  // From here on the claim is held: EVERY exit path must either release it
  // (proven pre-submission), park it as PAYMENT_UNKNOWN (uncertain), or
  // complete it as PAID.

  // Pre-submission: facilitator not reachable. Nothing was sent → safe release.
  if (!(await gateway.ready())) {
    await releasePaymentClaim(requestId);
    return failed(
      "FACILITATOR_UNAVAILABLE",
      503,
      "Payment facilitator is unavailable. Try again shortly.",
      true,
    );
  }

  // Pre-submission: requirements match + facilitator verification. Both run
  // before anything is submitted, so both are safe to release.
  const verified = await gateway.verify();
  if (!verified.ok) {
    await releasePaymentClaim(requestId);
    return verified.code === "REQUIREMENTS_MISMATCH"
      ? failed(
          "REQUIREMENTS_MISMATCH",
          402,
          "Payment does not match the advertised requirements.",
          true,
        )
      : failed("PAYMENT_VERIFICATION_FAILED", 402, "Payment verification failed.", true);
  }

  // ── The step that can move money ───────────────────────────────────────────
  const settled = await gateway.settle();
  if (!settled.ok) {
    if (settled.mayHaveSubmitted) {
      // P6: may already be on-chain. Park it WITH the client tx id so a
      // read-only reconciliation can later confirm it — never reopen for
      // payment. Reported as CONFIRMATION_PENDING so the code itself tells the
      // UI "do not pay again; you may check status".
      await markPaymentUnknown(requestId, clientTxId);
      return CONFIRMATION_PENDING;
    }
    // P5: provably nothing submitted → safe to release and retry.
    await releasePaymentClaim(requestId);
    return failed("PAYMENT_SETTLEMENT_FAILED", 402, "Payment settlement failed.", true);
  }

  const settledTxId = settled.transactionId;

  // ── P7: never trust the facilitator — confirm on the Mirror Node ──────────
  const proof = await gateway.confirm(settledTxId);
  if (!proof.ok) {
    // Post-submission: a real transaction id exists but is unconfirmed. Park it
    // WITH the tx id so it can be reconciled later without a new payment.
    await markPaymentUnknown(requestId, settledTxId);
    return CONFIRMATION_PENDING;
  }

  // ── Record the settlement (DB constraints are the final backstop) ─────────
  let settlement: PaymentSettlement;
  try {
    settlement = await recordSettlement({
      requestId,
      payTo,
      transactionId: settledTxId,
      payer: settled.payer ?? verified.payer ?? null,
      consensusTimestamp: proof.consensusTimestamp ?? null,
    });
  } catch (err) {
    return classifyInsertFailure(requestId, settledTxId, err);
  }

  await markPaymentPaid(requestId);
  await markRequestCompleted(requestId);
  return { kind: "released", settlement, raw: settled.raw };
}

async function recordSettlement(args: {
  requestId: string;
  payTo: string;
  transactionId: string;
  payer: string | null;
  consensusTimestamp: string | null;
}): Promise<PaymentSettlement> {
  return createSettlement({
    id: newSettlementId(),
    requestId: args.requestId,
    transactionId: args.transactionId,
    payer: args.payer,
    payTo: args.payTo,
    amount: serverConfig.x402Price,
    consensusTimestamp: args.consensusTimestamp,
    mirrorVerified: true,
    status: "SETTLED",
    hashscanUrl: hashscanTransactionUrl(args.transactionId),
  });
}

/**
 * The settlement insert failed. Money has already moved, so no branch here may
 * reopen the request. Distinguish the two UNIQUE indexes:
 *  - settled `request_id` → a concurrent caller won the race; release its
 *    report idempotently (this is P1 enforced by the database).
 *  - `transaction_id`     → the tx belongs to another request (P3).
 *  - anything else        → unknown; park it for reconciliation.
 */
async function classifyInsertFailure(
  requestId: string,
  settledTxId: string,
  err: unknown,
): Promise<SettlementOutcome> {
  // Log the shape of the failure, never the row or the payment payload.
  console.error(
    "[x402/payment-flow] settlement insert rejected",
    err instanceof Error ? err.message : "unknown error",
  );

  const winner = await findSettlementForRequest(requestId);
  if (winner) {
    await markPaymentPaid(requestId);
    await markRequestCompleted(requestId);
    return { kind: "already_paid", settlement: winner };
  }

  const consumed = await findSettlementByTxId(settledTxId);
  if (consumed) {
    await markPaymentUnknown(requestId, settledTxId);
    return failed(
      "PAYMENT_ALREADY_CONSUMED",
      409,
      "This payment has already been consumed for a report.",
      false,
    );
  }

  await markPaymentUnknown(requestId, settledTxId);
  return CONFIRMATION_PENDING;
}

/**
 * PAYMENT-FREE reconciliation for a request parked in PAYMENT_UNKNOWN.
 *
 * Re-reads the recorded transaction id on the Mirror Node. If it confirms, the
 * settlement is recorded and the report released; otherwise the request stays
 * parked. This path cannot verify or settle anything (see
 * `createReconciliationGateway`), so checking status can never send a payment.
 *
 * Returns `null` when there is nothing to reconcile.
 */
export async function reconcileUnknownPayment(args: {
  request: VerificationRequest;
  payTo: string;
  gateway: SettlementGateway;
}): Promise<SettlementOutcome | null> {
  const { request, payTo, gateway } = args;
  if (request.paymentState !== "PAYMENT_UNKNOWN" || !request.paymentClaimTxId) return null;

  const txId = request.paymentClaimTxId;

  // The transaction may meanwhile have unlocked a different request (P3).
  const consumed = await findSettlementByTxId(txId);
  if (consumed) {
    return consumed.requestId === request.id
      ? { kind: "already_paid", settlement: consumed }
      : failed(
          "PAYMENT_ALREADY_CONSUMED",
          409,
          "This payment has already been consumed for a report.",
          false,
        );
  }

  const proof = await gateway.confirm(txId, { maxAttempts: 1 });
  if (!proof.ok) return CONFIRMATION_PENDING;

  let settlement: PaymentSettlement;
  try {
    settlement = await recordSettlement({
      requestId: request.id,
      payTo,
      transactionId: txId,
      payer: null,
      consensusTimestamp: proof.consensusTimestamp ?? null,
    });
  } catch (err) {
    return classifyInsertFailure(request.id, txId, err);
  }

  await markPaymentPaid(request.id);
  await markRequestCompleted(request.id);
  return { kind: "released", settlement };
}
