/**
 * POST /api/pay  —  the built-in "demo wallet" x402 client.
 *
 * A convenience for the browser demo: instead of the user running an external
 * agent, the SERVER acts as the x402 payer using the configured demo-payer
 * account. It performs the full 402 handshake against our own protected
 * /api/report/{requestId} resource (signs a TransferTransaction, retries with
 * PAYMENT-SIGNATURE) and returns the released report + settlement to the browser.
 *
 * This endpoint spends real testnet HBAR from a public demo wallet, so it is
 * rate limited per hashed IP (stricter than /api/verify). The rate limit is an
 * abuse brake only — the per-request payment lock in the report route is what
 * guarantees one settlement per request.
 *
 * Error handling: the report route's typed, safe codes are PASSED THROUGH
 * (REQUEST_EXPIRED, PAYMENT_IN_PROGRESS, PAYMENT_ALREADY_CONSUMED, …) so the UI
 * can tell "retry is safe" from "re-upload" from "never pay again". Only a
 * genuinely unrecognised downstream response collapses to a generic failure.
 * Raw facilitator/SDK/database detail is never forwarded.
 *
 * Requires demo-payer keys (`X402_DEMO_PAYER_ID` / `_PRIVATE_KEY`) plus x402
 * settlement config; without them we return a clear 400 rather than pretending.
 * Body: `{requestId}`.
 */
import type { NextRequest } from "next/server";
import { apiError, json, safePrivateHandler } from "@/lib/http";
import { serverConfig, publicConfig } from "@/lib/config";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { parsePrivateKey } from "@/lib/hedera/client";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme as ExactHederaSchemeClient } from "@x402/hedera/exact/client";
import type { Network } from "@x402/core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Downstream codes that are safe to surface verbatim: each is a stable
 * Cred402 code with a defined UI meaning and no internal detail.
 */
const PASSTHROUGH_CODES = new Set([
  "REQUEST_NOT_FOUND",
  "REQUEST_EXPIRED",
  "PAYMENT_IN_PROGRESS",
  "PAYMENT_CONFIRMATION_PENDING",
  "PAYMENT_ALREADY_CONSUMED",
  "PAYMENT_VERIFICATION_FAILED",
  "PAYMENT_SETTLEMENT_FAILED",
  "REQUIREMENTS_MISMATCH",
  "FACILITATOR_UNAVAILABLE",
  "RATE_LIMITED",
]);

/** Safe, fixed sentences per code — never the downstream message body. */
const MESSAGES: Record<string, string> = {
  REQUEST_NOT_FOUND: "Verification request not found. Upload the file again.",
  REQUEST_EXPIRED:
    "This verification request has expired. Upload the file again to get a fresh report challenge.",
  PAYMENT_IN_PROGRESS:
    "Another payment for this request is already being settled. No second payment was sent.",
  PAYMENT_CONFIRMATION_PENDING:
    "A payment for this request was submitted but is not yet confirmed. " +
    "This request will not accept another payment; check its status again shortly.",
  PAYMENT_ALREADY_CONSUMED: "This payment has already been consumed for a report.",
  PAYMENT_VERIFICATION_FAILED: "Payment verification failed before settlement.",
  PAYMENT_SETTLEMENT_FAILED: "Payment settlement did not complete.",
  REQUIREMENTS_MISMATCH: "Payment does not match the advertised requirements.",
  FACILITATOR_UNAVAILABLE: "Payment facilitator is unavailable. Try again shortly.",
  RATE_LIMITED: "Too many payment attempts. Try again later.",
};

export async function POST(req: NextRequest) {
  return safePrivateHandler("api/pay", async () => {
    let requestId: unknown;
    try {
      ({ requestId } = await req.json());
    } catch {
      return apiError("Expected JSON body { requestId }.", 400, { code: "BAD_REQUEST" });
    }
    if (typeof requestId !== "string" || !requestId) {
      return apiError("Missing 'requestId'.", 400, { code: "NO_REQUEST_ID" });
    }

    // Rate limit BEFORE any payment work, so a limited caller never spends.
    const limited = await enforceRateLimit(
      req.headers,
      "pay",
      serverConfig.payRateLimitMax,
      serverConfig.payRateLimitWindowSeconds,
    );
    if (limited) return limited;

    if (!serverConfig.demoWalletConfigured) {
      return apiError(
        "Demo wallet not configured: set X402_DEMO_PAYER_ID/KEY and the x402 settlement values.",
        400,
        { code: "DEMO_WALLET_NOT_CONFIGURED" },
      );
    }

    // demoWalletConfigured guarantees these are present.
    const demoPayerId = serverConfig.demoPayerId as string;
    const demoPayerKey = serverConfig.demoPayerKey as string;
    const network = serverConfig.x402Network as Network;

    const signer = createClientHederaSigner(demoPayerId, parsePrivateKey(demoPayerKey), {
      network,
    });
    const client = new x402Client().register(network, new ExactHederaSchemeClient(signer));
    const payFetch = wrapFetchWithPayment(fetch, client);

    const reportUrl = `${publicConfig.appUrl}/api/report/${requestId}`;
    const res = await payFetch(reportUrl, { method: "GET" });

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      const code = (body as { code?: string } | null)?.code;
      if (code && PASSTHROUGH_CODES.has(code)) {
        const retryAfter = res.headers.get("retry-after");
        return apiError(MESSAGES[code] ?? "Payment could not be completed.", res.status, {
          code,
          requestId,
          ...(retryAfter ? { headers: { "retry-after": retryAfter } } : {}),
        });
      }
      // Unrecognised downstream failure: safe generic response, sanitised log.
      console.error(`[api/pay] unmapped downstream failure status=${res.status} code=${code ?? "none"}`);
      return apiError("Payment or report retrieval failed.", res.status === 402 ? 402 : 502, {
        code: "PAY_FLOW_FAILED",
        requestId,
      });
    }

    return json({
      requestId,
      settled: true,
      report: body,
    });
  });
}
