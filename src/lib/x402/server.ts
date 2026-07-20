/**
 * x402 resource-server wiring for Cred402 (x402 protocol v2, `@x402/*` scope).
 *
 * This module owns the single `x402ResourceServer` instance that:
 *  - talks to the public x402 facilitator (`serverConfig.x402FacilitatorUrl`),
 *  - registers the Hedera `exact` scheme for `hedera:testnet`, and
 *  - is `initialize()`d once so the facilitator's `extra.feePayer` (its
 *    fee-sponsoring account) is injected into every 402 challenge we build.
 *
 * The facilitator's `/supported` endpoint is PUBLIC, so `initialize()` succeeds
 * WITHOUT our operator/payer keys — that is what lets us prove a genuine live
 * 402 challenge (real `feePayer`) even in unconfigured mode. Actual settlement
 * still requires keys, and is gated in the route.
 *
 * Unconfigured-safe: importing this never throws and never needs secrets. The
 * initialized server is memoised on `globalThis` (Next.js hot-reload / warm
 * invocations reuse it). `x402Ready` reports whether `initialize()` succeeded;
 * a facilitator outage degrades gracefully rather than crashing the route.
 */
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import type {
  Network,
  PaymentRequirements,
  ResourceInfo,
} from "@x402/core/types";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { serverConfig } from "@/lib/config";

/** Advertised settlement window (seconds) — how long a 402 challenge is valid. */
export const REPORT_MAX_TIMEOUT = 180;

/** The CAIP-2 network we register + advertise. Typed as x402's `Network`. */
function reportNetwork(): Network {
  return serverConfig.x402Network as Network;
}

interface ReadyResourceServer {
  server: x402ResourceServer;
  /** True only when `initialize()` (facilitator `/supported`) succeeded. */
  x402Ready: boolean;
}

/** Cached on globalThis so we don't re-hit the facilitator on every request. */
const globalForX402 = globalThis as unknown as {
  __cred402X402?: ReadyResourceServer;
  __cred402X402Init?: Promise<ReadyResourceServer>;
};

async function buildResourceServer(): Promise<ReadyResourceServer> {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: serverConfig.x402FacilitatorUrl,
  });

  const server = new x402ResourceServer(facilitatorClient).register(
    reportNetwork(),
    new ExactHederaScheme(),
  );

  // The facilitator `/supported` endpoint is public — this works without our
  // keys and injects `extra.feePayer` into requirements. Never let a
  // facilitator outage crash the caller; report readiness instead.
  let x402Ready = false;
  try {
    await server.initialize();
    x402Ready = true;
  } catch (err) {
    console.error("[x402] facilitator initialize() failed", err);
  }

  return { server, x402Ready };
}

/**
 * Return the memoised, initialized resource server. Concurrent callers share a
 * single in-flight `initialize()` (the promise is cached too). If a previous
 * initialize() failed (`x402Ready === false`), we retry on the next call.
 */
export async function getResourceServer(): Promise<ReadyResourceServer> {
  if (globalForX402.__cred402X402?.x402Ready) {
    return globalForX402.__cred402X402;
  }
  if (!globalForX402.__cred402X402Init) {
    globalForX402.__cred402X402Init = buildResourceServer()
      .then((ready) => {
        globalForX402.__cred402X402 = ready;
        // Allow a retry later only if init failed.
        if (!ready.x402Ready) globalForX402.__cred402X402Init = undefined;
        return ready;
      })
      .catch((err) => {
        globalForX402.__cred402X402Init = undefined;
        throw err;
      });
  }
  return globalForX402.__cred402X402Init;
}

/**
 * Build the `accepts` requirements for a report purchase: the Hedera `exact`
 * scheme priced at `serverConfig.x402Price` tinybars of `serverConfig.x402Asset`
 * (HBAR = "0.0.0"), paid to `payTo`. The facilitator's `feePayer` is merged in
 * by the initialized server.
 */
export async function buildReportRequirements(
  payTo: string,
): Promise<PaymentRequirements[]> {
  const { server } = await getResourceServer();
  return server.buildPaymentRequirements({
    scheme: "exact",
    payTo,
    price: { asset: serverConfig.x402Asset, amount: serverConfig.x402Price },
    network: reportNetwork(),
    maxTimeoutSeconds: REPORT_MAX_TIMEOUT,
  });
}

/** Resource metadata for the 402 challenge (the report URL being purchased). */
export function reportResourceInfo(requestId: string, appUrl: string): ResourceInfo {
  return {
    url: `${appUrl}/api/report/${requestId}`,
    description: "Cred402 full credential verification report",
    mimeType: "application/json",
  };
}
