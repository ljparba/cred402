/**
 * GET /api/report/{requestId}  —  PROTECTED by a genuine HTTP 402 gate.
 *
 * This is the pay-per-report resource. The full verification report (verdict,
 * six checks, credential detail, HCS proof) is released ONLY after a real
 * x402 (protocol v2) Hedera settlement that we independently confirm on the
 * Mirror Node. The free preview lives at POST /api/verify; nothing here ever
 * leaks the verdict or checks without payment.
 *
 * Flow (plan §3.2 / §3.5):
 *   1. No PAYMENT-SIGNATURE  → 402 challenge (PAYMENT-REQUIRED header + JSON
 *      accepts). If X402_PAYMENT_RECIPIENT is unset we cannot advertise a real
 *      payTo, so we 402 with `configured:false` and NO report.
 *   2. PAYMENT-SIGNATURE present → replay-check the tx id FIRST, then
 *      verify + settle via the facilitator, then INDEPENDENTLY confirm the
 *      settlement on Mirror Node, record it (UNIQUE tx id = first-use-wins),
 *      burn the nonce, and release the full report.
 *   3. An already-settled request re-accessed by the buyer → idempotent
 *      release (no second payment).
 */
import type { NextRequest } from "next/server";
import { apiError, json, safeHandler } from "@/lib/http";
import { serverConfig, publicConfig, tinybarsToHbar } from "@/lib/config";
import { newSettlementId } from "@/lib/ids";
import { toDashedTxId } from "@/lib/hedera/mirror";
import { hashscanTransactionUrl } from "@/lib/hedera/hashscan";
import {
  getResourceServer,
  buildReportRequirements,
  reportResourceInfo,
} from "@/lib/x402/server";
import { verifySettlementOnChain } from "@/lib/x402/settlement";
import { isRequestNonceValid, burnNonce } from "@/lib/x402/nonce";
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
  findSettlementByTxId,
  createSettlement,
  updateVerificationRequest,
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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ requestId: string }> }) {
  return safeHandler("api/report/[requestId]", async () => {
    const { requestId } = await ctx.params;

    const request = await getVerificationRequest(requestId);
    if (!request) {
      return apiError("Verification request not found.", 404, { code: "REQUEST_NOT_FOUND" });
    }
    const result = await getVerificationResult(requestId);

    // ── Idempotent re-access: this request was already paid for ────────────────
    const existing = await findSettlementForRequest(requestId);
    if (existing) {
      return json(releasedReport(request, result, existing));
    }

    // ── Demo bypass — ONLY when the deployment has no x402 keys ─────────────────
    // A keyed (configured) deployment ignores this entirely and enforces the real
    // 402 gate below. In the default no-keys state it lets reviewers see the full
    // report UI with the settlement clearly labelled as simulated.
    const demoRequested = _req.nextUrl.searchParams.get("demo") === "1";
    if (demoRequested && !serverConfig.x402Configured) {
      return json(releasedReport(request, result, undefined, { demo: true }));
    }

    const signatureHeader = _req.headers.get(PAYMENT_SIGNATURE_HEADER);

    // ── No payment presented → 402 challenge ───────────────────────────────────
    if (!signatureHeader) {
      return challenge402(request);
    }

    // ── Payment presented → verify, settle, prove, release ─────────────────────
    let payload;
    try {
      payload = decodePaymentSignatureHeader(signatureHeader);
    } catch {
      return apiError("Malformed PAYMENT-SIGNATURE header.", 400, {
        code: "BAD_PAYMENT_SIGNATURE",
      });
    }

    // REPLAY CHECK FIRST — before spending any settlement effort. Extract the
    // transaction id the client signed and reject if it already unlocked a report.
    let dashedTxId: string;
    try {
      const base64Tx = extractTransactionFromPayload(payload.payload as ExactHederaPayloadV2);
      dashedTxId = toDashedTxId(inspectHederaTransaction(base64Tx).transactionId);
    } catch {
      return apiError("PAYMENT-SIGNATURE did not contain a decodable Hedera transaction.", 400, {
        code: "BAD_PAYMENT_TRANSACTION",
      });
    }

    const alreadyUsed = await findSettlementByTxId(dashedTxId);
    if (alreadyUsed) {
      return apiError("This payment has already been consumed for a report.", 409, {
        code: "PAYMENT_ALREADY_CONSUMED",
      });
    }

    // Recipient must be configured to actually settle.
    const payTo = serverConfig.x402PaymentRecipient;
    if (!payTo) {
      return challenge402(request);
    }

    // Freshness: nonce/challenge must not be expired.
    if (!isRequestNonceValid(request)) {
      return apiError("Payment challenge has expired. Request a fresh report challenge.", 402, {
        code: "CHALLENGE_EXPIRED",
      });
    }

    const { server, x402Ready } = await getResourceServer();
    if (!x402Ready) {
      return apiError("Payment facilitator is unavailable. Try again shortly.", 503, {
        code: "FACILITATOR_UNAVAILABLE",
      });
    }

    const requirements = await buildReportRequirements(payTo);
    const matched = server.findMatchingRequirements(requirements, payload);
    if (!matched) {
      return apiError("Payment does not match the advertised requirements.", 402, {
        code: "REQUIREMENTS_MISMATCH",
      });
    }

    // Facilitator verification.
    const verified = await server.verifyPayment(payload, matched);
    if (!verified.isValid) {
      return apiError(`Payment verification failed: ${verified.invalidReason ?? "invalid"}.`, 402, {
        code: "PAYMENT_INVALID",
      });
    }

    // Facilitator settlement — the REAL fee-sponsored testnet transfer.
    let settleRes: SettleResponse;
    try {
      settleRes = await server.settlePayment(payload, matched);
    } catch (err) {
      console.error("[api/report] settlePayment threw", err);
      return apiError("Payment settlement failed.", 402, { code: "SETTLEMENT_FAILED" });
    }
    if (!settleRes.success) {
      return apiError(`Payment settlement failed: ${settleRes.errorReason ?? "unknown"}.`, 402, {
        code: "SETTLEMENT_FAILED",
      });
    }

    // INDEPENDENT proof — never trust the facilitator alone (plan §3.5 layer 3).
    const settledTxDashed = toDashedTxId(settleRes.transaction);
    const proof = await verifySettlementOnChain(
      settledTxDashed,
      payTo,
      Number(serverConfig.x402Price),
    );
    if (!proof.ok) {
      return apiError(`Independent settlement proof failed: ${proof.reason}`, 402, {
        code: "PROOF_FAILED",
      });
    }

    const hashscanUrl = hashscanTransactionUrl(settledTxDashed);

    // Record settlement. The UNIQUE tx-id constraint is the first-use-wins
    // binding: a concurrent duplicate insert throws → treat as replay (409).
    let settlement: PaymentSettlement;
    try {
      settlement = await createSettlement({
        id: newSettlementId(),
        requestId,
        transactionId: settledTxDashed,
        payer: settleRes.payer ?? verified.payer ?? null,
        payTo,
        amount: serverConfig.x402Price,
        consensusTimestamp: proof.consensusTimestamp ?? null,
        mirrorVerified: true,
        status: "SETTLED",
        hashscanUrl,
      });
    } catch (err) {
      // UNIQUE violation on transaction_id → this tx already unlocked a report.
      console.error("[api/report] createSettlement failed (likely duplicate tx)", err);
      return apiError("This payment has already been consumed for a report.", 409, {
        code: "PAYMENT_ALREADY_CONSUMED",
      });
    }

    // Mark PAID then burn the nonce (→ COMPLETED). Report is now unlockable.
    await updateVerificationRequest(requestId, { status: "PAID" });
    await burnNonce(requestId);

    const body = releasedReport(request, result, settlement);
    return json(body, {
      headers: {
        [PAYMENT_RESPONSE_HEADER]: encodePaymentResponseHeader(settleRes),
      },
    });
  });
}

/**
 * Build a 402 challenge. When no recipient is configured we cannot advertise a
 * real payTo, so we return an honest unconfigured 402 with NO report and no
 * accepts. Otherwise we build genuine requirements (with the facilitator's
 * feePayer) and set the PAYMENT-REQUIRED header + JSON accepts for machine
 * clients. NEVER includes verdict/checks.
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
        note: "Live settlement requires X402_PAYMENT_RECIPIENT + operator keys",
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
