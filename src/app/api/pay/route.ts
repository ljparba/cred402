/**
 * POST /api/pay  —  the built-in "demo wallet" x402 client.
 *
 * A convenience for the browser demo: instead of the user running an external
 * agent, the SERVER acts as the x402 payer using the configured demo-payer
 * account. It performs the full 402 handshake against our own protected
 * /api/report/{requestId} resource (signs a TransferTransaction, retries with
 * PAYMENT-SIGNATURE) and returns the released report + settlement to the browser.
 *
 * Requires demo-payer keys (`X402_DEMO_PAYER_ID` / `_PRIVATE_KEY`) AND operator
 * keys; without them we return a clear 400 rather than pretending. Body: `{requestId}`.
 */
import type { NextRequest } from "next/server";
import { apiError, json, safeHandler } from "@/lib/http";
import { serverConfig, publicConfig } from "@/lib/config";
import { parsePrivateKey } from "@/lib/hedera/client";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme as ExactHederaSchemeClient } from "@x402/hedera/exact/client";
import type { Network } from "@x402/core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return safeHandler("api/pay", async () => {
    let requestId: unknown;
    try {
      ({ requestId } = await req.json());
    } catch {
      return apiError("Expected JSON body { requestId }.", 400, { code: "BAD_REQUEST" });
    }
    if (typeof requestId !== "string" || !requestId) {
      return apiError("Missing 'requestId'.", 400, { code: "NO_REQUEST_ID" });
    }

    if (!serverConfig.x402Configured) {
      return apiError(
        "Demo wallet not configured: set X402_DEMO_PAYER_ID/KEY + operator keys.",
        400,
        { code: "DEMO_WALLET_NOT_CONFIGURED" },
      );
    }

    // x402Configured guarantees these are present.
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

    let report: unknown;
    try {
      report = await res.json();
    } catch {
      report = null;
    }

    if (!res.ok) {
      return apiError("Payment or report retrieval failed.", res.status === 402 ? 402 : 502, {
        code: "PAY_FLOW_FAILED",
      });
    }

    return json({
      requestId,
      settled: true,
      report,
    });
  });
}
