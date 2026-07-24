/**
 * GET /api/report/{requestId}  —  PROTECTED by a genuine HTTP 402 gate.
 *
 * This is the pay-per-report resource. The full verification report (verdict,
 * six checks, credential detail, HCS proof) is released ONLY after a real
 * x402 (protocol v2) Hedera settlement that we independently confirm on the
 * Mirror Node. The free preview lives at POST /api/verify; nothing here ever
 * leaks the verdict or checks without payment.
 *
 * Handled in this exact order, because the order IS the safety property:
 *   1. Already paid → idempotent release. Checked FIRST, so a paid report stays
 *      reachable forever, including after the original request TTL expires.
 *   2. Unpaid + TTL elapsed → 410 REQUEST_EXPIRED, re-upload. No fresh 402 is
 *      issued, the TTL is never silently refreshed, and a supplied
 *      PAYMENT-SIGNATURE is rejected here — before any facilitator call.
 *   3. An unresolved earlier payment → reconcile read-only, else a safe
 *      409 (never a second payment).
 *   4. No PAYMENT-SIGNATURE → the 402 challenge.
 *   5. PAYMENT-SIGNATURE → decode + replay-check the transaction id, then hand
 *      the whole critical section to `settleReportPayment` (atomic per-request
 *      claim, settle, independent Mirror confirmation, first-use-wins record).
 *
 * The concurrency and failure invariants (P1–P8) live in
 * `src/lib/x402/payment-flow.ts`; this route is the HTTP adapter for them.
 */
import type { NextRequest } from "next/server";
import { apiError, json, safePrivateHandler } from "@/lib/http";
import { serverConfig, publicConfig, tinybarsToHbar } from "@/lib/config";
import {
  getResourceServer,
  buildReportRequirements,
  reportResourceInfo,
} from "@/lib/x402/server";
import { isRequestExpired } from "@/lib/x402/request-ttl";
import { createReconciliationGateway, createSettlementGateway } from "@/lib/x402/gateway";
import {
  reconcileUnknownPayment,
  settleReportPayment,
  type SettlementOutcome,
} from "@/lib/x402/payment-flow";
import { toDashedTxId } from "@/lib/hedera/mirror";
import {
  encodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import {
  extractTransactionFromPayload,
  inspectHederaTransaction,
  type ExactHederaPayloadV2,
} from "@x402/hedera";
import type { SettleResponse } from "@x402/core/types";
import {
  getVerificationRequest,
  getVerificationResult,
  findSettlementForRequest,
} from "@/lib/db/queries";
import type {
  PaymentSettlement,
  VerificationRequest,
  VerificationResult,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";
const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

const EXPIRED_RESPONSE = {
  message:
    "This verification request has expired. Upload the file again to get a fresh report challenge.",
  status: 410,
  code: "REQUEST_EXPIRED",
} as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ requestId: string }> }) {
  return safePrivateHandler("api/report/[requestId]", async () => {
    const { requestId } = await ctx.params;

    const request = await getVerificationRequest(requestId);
    if (!request) {
      return apiError("Verification request not found.", 404, { code: "REQUEST_NOT_FOUND" });
    }
    const result = await getVerificationResult(requestId);

    // ── 1. Idempotent re-access: this request was already paid for ────────────
    // Deliberately before the expiry check — a paid report never expires.
    const existing = await findSettlementForRequest(requestId);
    if (existing) {
      return json(releasedReport(request, result, existing));
    }

    // ── 2. Unpaid + expired → 410, re-upload. No challenge, no settlement ─────
    if (isRequestExpired(request)) {
      return apiError(EXPIRED_RESPONSE.message, EXPIRED_RESPONSE.status, {
        code: EXPIRED_RESPONSE.code,
        requestId,
      });
    }

    // ── 3. An earlier payment attempt is unresolved ───────────────────────────
    if (request.paymentState === "PAYMENT_UNKNOWN") {
      const payToForReconcile = serverConfig.x402PaymentRecipient;
      if (payToForReconcile) {
        // Read-only Mirror re-check. Cannot verify or settle → cannot pay.
        const reconciled = await reconcileUnknownPayment({
          request,
          payTo: payToForReconcile,
          gateway: createReconciliationGateway(payToForReconcile),
        });
        if (reconciled) {
          return respondToOutcome(reconciled, request, result);
        }
      }
      return apiError(
        "A payment for this request was submitted but is not yet confirmed. " +
          "This request will not accept another payment; check its status again shortly.",
        409,
        { code: "PAYMENT_CONFIRMATION_PENDING", requestId },
      );
    }

    // Another caller currently owns the settlement-critical section.
    if (request.paymentState === "PAYMENT_IN_PROGRESS") {
      return apiError(
        "Another payment for this request is already being settled. No second payment was sent.",
        409,
        { code: "PAYMENT_IN_PROGRESS", requestId },
      );
    }

    // ── Demo bypass — ONLY when the deployment cannot settle at all ───────────
    // A deployment configured for x402 settlement ignores this entirely and
    // enforces the real 402 gate below. In the default no-keys state it lets
    // reviewers see the full report UI with settlement clearly labelled
    // simulated.
    const demoRequested = req.nextUrl.searchParams.get("demo") === "1";
    if (demoRequested && !serverConfig.x402SettlementConfigured) {
      return json(releasedReport(request, result, undefined, { demo: true }));
    }

    const signatureHeader = req.headers.get(PAYMENT_SIGNATURE_HEADER);

    // ── 4. No payment presented → 402 challenge ───────────────────────────────
    if (!signatureHeader) {
      return challenge402(request);
    }

    // ── 5. Payment presented → decode, then run the critical section ──────────
    let payload;
    try {
      payload = decodePaymentSignatureHeader(signatureHeader);
    } catch {
      return apiError("Malformed PAYMENT-SIGNATURE header.", 400, {
        code: "BAD_PAYMENT_SIGNATURE",
      });
    }

    // Extract the PUBLIC transaction id the client signed (never the signature
    // or the signed bytes). Used for the replay check and, if the attempt ends
    // uncertain, as the reconciliation handle.
    let clientTxId: string;
    try {
      const base64Tx = extractTransactionFromPayload(payload.payload as ExactHederaPayloadV2);
      clientTxId = toDashedTxId(inspectHederaTransaction(base64Tx).transactionId);
    } catch {
      return apiError("PAYMENT-SIGNATURE did not contain a decodable Hedera transaction.", 400, {
        code: "BAD_PAYMENT_TRANSACTION",
      });
    }

    // Recipient must be configured to actually settle.
    const payTo = serverConfig.x402PaymentRecipient;
    if (!payTo) {
      return challenge402(request);
    }

    const outcome = await settleReportPayment({
      requestId,
      payTo,
      clientTxId,
      gateway: createSettlementGateway({ payload, payTo }),
    });

    return respondToOutcome(outcome, request, result);
  });
}

/**
 * Map a settlement outcome to HTTP. Error bodies carry only the stable code and
 * a safe sentence — never a facilitator/SDK/database message, a stack trace, or
 * any part of the payment payload.
 */
function respondToOutcome(
  outcome: SettlementOutcome,
  request: VerificationRequest,
  result: VerificationResult | undefined,
) {
  if (outcome.kind === "already_paid") {
    return json(releasedReport(request, result, outcome.settlement));
  }
  if (outcome.kind === "released") {
    const body = releasedReport(request, result, outcome.settlement);
    const settleResponse = outcome.raw as SettleResponse | undefined;
    return json(
      body,
      settleResponse
        ? { headers: { [PAYMENT_RESPONSE_HEADER]: encodePaymentResponseHeader(settleResponse) } }
        : undefined,
    );
  }
  return apiError(outcome.message, outcome.status, {
    code: outcome.code,
    requestId: request.id,
  });
}

/**
 * Build a 402 challenge. When no recipient is configured we cannot advertise a
 * real payTo, so we return an honest unconfigured 402 with NO report and no
 * accepts. Otherwise we build genuine requirements (with the facilitator's
 * feePayer) and set the PAYMENT-REQUIRED header + JSON accepts for machine
 * clients. NEVER includes verdict/checks, and is never issued for an expired
 * request (that is a 410 above).
 */
async function challenge402(request: VerificationRequest) {
  const payTo = serverConfig.x402PaymentRecipient;

  if (!payTo) {
    return json(
      {
        x402Version: 2,
        error: "Payment required, but live settlement is not configured on this deployment.",
        accepts: [],
        configured: false,
        note: "Live settlement requires X402_PAYMENT_RECIPIENT",
        requestId: request.id,
        price: {
          asset: serverConfig.x402Asset,
          amount: serverConfig.x402Price,
          amountHbar: tinybarsToHbar(serverConfig.x402Price),
          network: serverConfig.x402Network,
        },
      },
      { status: 402 },
    );
  }

  const { server, x402Ready } = await getResourceServer();
  const requirements = await buildReportRequirements(payTo);
  const resourceInfo = reportResourceInfo(request.id, publicConfig.appUrl);
  const paymentRequired = await server.createPaymentRequiredResponse(
    requirements,
    resourceInfo,
    "Payment required to release the full verification report.",
  );

  return json(
    {
      x402Version: paymentRequired.x402Version,
      error: paymentRequired.error,
      accepts: paymentRequired.accepts,
      resource: paymentRequired.resource,
      configured: true,
      x402Ready,
      requestId: request.id,
    },
    {
      status: 402,
      headers: {
        [PAYMENT_REQUIRED_HEADER]: encodePaymentRequiredHeader(paymentRequired),
      },
    },
  );
}

/**
 * Assemble the FULL report released after (or on idempotent re-access of) a
 * settled payment. Includes verdict, checks, credential detail, HCS proof, and
 * payment proof. This is the only place verdict/checks are ever emitted.
 */
function releasedReport(
  request: VerificationRequest,
  result: VerificationResult | undefined,
  settlement: PaymentSettlement | undefined,
  opts?: { demo?: boolean },
) {
  const demo = opts?.demo ?? false;
  const payment = settlement
    ? {
        transactionId: settlement.transactionId,
        payer: settlement.payer ?? null,
        payTo: settlement.payTo,
        amount: settlement.amount,
        amountHbar: tinybarsToHbar(settlement.amount),
        currencyLabel: "tHBAR",
        network: serverConfig.x402Network,
        consensusTimestamp: settlement.consensusTimestamp ?? null,
        mirrorVerified: settlement.mirrorVerified,
        hashscanUrl: settlement.hashscanUrl ?? null,
        simulated: false,
      }
    : {
        // Demo mode: no real settlement occurred.
        transactionId: null,
        payer: serverConfig.demoPayerId ?? null,
        payTo: serverConfig.x402PaymentRecipient ?? null,
        amount: serverConfig.x402Price,
        amountHbar: tinybarsToHbar(serverConfig.x402Price),
        currencyLabel: "tHBAR",
        network: serverConfig.x402Network,
        consensusTimestamp: null,
        mirrorVerified: false,
        hashscanUrl: null,
        simulated: true,
      };

  return {
    requestId: request.id,
    paid: !demo,
    demo,
    ...(demo
      ? {
          note:
            "Simulated settlement — this deployment has no x402 testnet keys. " +
            "With keys configured, the report is released ONLY after a real, " +
            "independently-confirmed x402 payment.",
        }
      : {}),
    verdict: result?.verdict ?? request.previewVerdict ?? null,
    checks: result?.checks ?? [],
    credential: request.credentialId
      ? { id: request.credentialId, issuerId: request.issuerId ?? null }
      : null,
    hashes: {
      uploaded: result?.uploadedHash ?? request.sha256,
      anchored: result?.anchoredHash ?? null,
    },
    hcs: result?.hcsTransactionId
      ? {
          sequenceNumber: result.hcsSequenceNumber ?? null,
          transactionId: result.hcsTransactionId,
        }
      : null,
    payment,
  };
}
