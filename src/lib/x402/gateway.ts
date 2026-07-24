/**
 * The settlement gateway: everything the payment-critical section needs from
 * the outside world (facilitator + Mirror Node), behind one small interface.
 *
 * `src/lib/x402/payment-flow.ts` owns the payment INVARIANTS (claim, release,
 * uncertainty, uniqueness) and depends only on this interface, never on the
 * `@x402/*` SDK. That keeps the invariants testable against a fake gateway —
 * no network, no Hedera, no facilitator — while production wires in the real
 * one below.
 *
 * A gateway instance is bound to ONE payment attempt: the decoded payload and
 * `payTo` are captured at construction, so the flow never passes SDK types
 * around (and can never mix two payloads up).
 */
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { serverConfig } from "@/lib/config";
import { toDashedTxId } from "@/lib/hedera/mirror";
import { verifySettlementOnChain } from "@/lib/x402/settlement";
import { buildReportRequirements, getResourceServer } from "@/lib/x402/server";

export type GatewayVerifyResult =
  | { ok: true; payer?: string | null }
  | {
      ok: false;
      code: "REQUIREMENTS_MISMATCH" | "PAYMENT_VERIFICATION_FAILED";
      reason?: string;
    };

export type GatewaySettleResult =
  | { ok: true; transactionId: string; payer?: string | null; raw?: unknown }
  | {
      ok: false;
      /**
       * TRUE when a Hedera submission may already have happened, so the caller
       * must NOT reopen the request for another payment. The real gateway is
       * deliberately conservative and reports `true` for every settlement
       * failure: neither a thrown error nor a facilitator `success:false`
       * tells us reliably that nothing was submitted.
       */
      mayHaveSubmitted: boolean;
      reason?: string;
    };

export interface GatewayConfirmResult {
  ok: boolean;
  reason?: string;
  consensusTimestamp?: string | null;
}

export interface SettlementGateway {
  /** Facilitator reachable and initialised. */
  ready(): Promise<boolean>;
  /** Match the payload against our advertised requirements and verify it. Pre-settlement. */
  verify(): Promise<GatewayVerifyResult>;
  /** Submit the settlement. This is the step that can move money. */
  settle(): Promise<GatewaySettleResult>;
  /** Independent Mirror Node confirmation of a transaction id. Read-only. */
  confirm(transactionId: string, opts?: { maxAttempts?: number }): Promise<GatewayConfirmResult>;
}

/**
 * The production gateway: x402 facilitator for verify/settle, Hedera Mirror
 * Node for confirmation. `verify()` memoises the matched requirements so
 * `settle()` uses exactly what was verified.
 */
export function createSettlementGateway(args: {
  payload: PaymentPayload;
  payTo: string;
}): SettlementGateway {
  const { payload, payTo } = args;
  let matched: PaymentRequirements | undefined;

  return {
    async ready(): Promise<boolean> {
      const { x402Ready } = await getResourceServer();
      return x402Ready;
    },

    async verify(): Promise<GatewayVerifyResult> {
      const { server } = await getResourceServer();
      const requirements = await buildReportRequirements(payTo);
      matched = server.findMatchingRequirements(requirements, payload);
      if (!matched) {
        return { ok: false, code: "REQUIREMENTS_MISMATCH" };
      }
      const verified = await server.verifyPayment(payload, matched);
      if (!verified.isValid) {
        return {
          ok: false,
          code: "PAYMENT_VERIFICATION_FAILED",
          reason: verified.invalidReason ?? "invalid",
        };
      }
      return { ok: true, payer: verified.payer ?? null };
    },

    async settle(): Promise<GatewaySettleResult> {
      if (!matched) {
        // verify() must run first; treat a programming slip as pre-submission.
        return { ok: false, mayHaveSubmitted: false, reason: "not verified" };
      }
      const { server } = await getResourceServer();
      try {
        const res = await server.settlePayment(payload, matched);
        if (!res.success) {
          // The facilitator reported failure, but not whether it submitted
          // first. Assume it may have — never auto-retry on this.
          return {
            ok: false,
            mayHaveSubmitted: true,
            reason: res.errorReason ?? "unknown",
          };
        }
        return {
          ok: true,
          transactionId: toDashedTxId(res.transaction),
          payer: res.payer ?? null,
          raw: res,
        };
      } catch (err) {
        // Timeout / lost response / transport error AFTER the request left us:
        // the settlement may well have been submitted. Uncertain by definition.
        console.error("[x402/gateway] settlePayment threw", err);
        return { ok: false, mayHaveSubmitted: true, reason: "settlement transport failure" };
      }
    },

    async confirm(
      transactionId: string,
      opts?: { maxAttempts?: number },
    ): Promise<GatewayConfirmResult> {
      const proof = await verifySettlementOnChain(
        transactionId,
        payTo,
        Number(serverConfig.x402Price),
        opts?.maxAttempts === undefined ? undefined : { maxAttempts: opts.maxAttempts },
      );
      return {
        ok: proof.ok,
        reason: proof.reason,
        consensusTimestamp: proof.consensusTimestamp ?? null,
      };
    },
  };
}

/**
 * Read-only gateway for RECONCILING a request whose settlement outcome is
 * unknown: it can confirm an existing transaction id on the Mirror Node but
 * cannot verify or settle, so a reconciliation path can never send a payment.
 */
export function createReconciliationGateway(payTo: string): SettlementGateway {
  const notPayable = () => {
    throw new Error("reconciliation gateway cannot verify or settle a payment");
  };
  return {
    async ready() {
      return true;
    },
    verify: notPayable,
    settle: notPayable,
    async confirm(transactionId, opts) {
      const proof = await verifySettlementOnChain(
        transactionId,
        payTo,
        Number(serverConfig.x402Price),
        { maxAttempts: opts?.maxAttempts ?? 1 },
      );
      return {
        ok: proof.ok,
        reason: proof.reason,
        consensusTimestamp: proof.consensusTimestamp ?? null,
      };
    },
  };
}
