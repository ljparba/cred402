/**
 * scripts/agent-client.ts  —  the "AI agent" story, machine-readable.
 *
 *   npm run agent:demo            # uploads a sample, then pays for its report
 *   npm run agent:demo <requestId># pays for an existing report request
 *
 * This is the autonomous-caller demonstration: a program (not a browser) that
 * hits a paywalled resource, receives a genuine HTTP 402, settles a real x402
 * Hedera payment with the SAME `x402Client` + `wrapFetchWithPayment` a real
 * agent would use, and consumes the released machine-readable report.
 *
 * Requires a RUNNING local server (`npm run dev`) and demo-payer keys to settle.
 * If keys are absent it prints the 402 challenge it received and exits 0 with a
 * clear note — the 402 itself is the proof of a genuine paywall.
 *
 * Set APP_URL (or NEXT_PUBLIC_APP_URL) if the dev server is not on :3000.
 */
import "./lib/env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serverConfig } from "@/lib/config";
import { parsePrivateKey } from "@/lib/hedera/client";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme as ExactHederaSchemeClient } from "@x402/hedera/exact/client";
import type { Network } from "@x402/core/types";

const APP_URL = (
  process.env.APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000"
).replace(/\/+$/, "");

/** Sample uploaded when no requestId is supplied (the flagship tampered pair). */
const DEFAULT_SAMPLE = "samples/tampered/data-structures-tampered.pdf";

async function uploadSample(path: string): Promise<string> {
  const abs = resolve(process.cwd(), path);
  const bytes = readFileSync(abs);
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    path.split(/[\\/]/).pop() ?? "sample.pdf",
  );

  const res = await fetch(`${APP_URL}/api/verify`, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`Upload failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { requestId: string };
  console.log(`↑ Uploaded ${path} → requestId ${data.requestId}`);
  return data.requestId;
}

/** Fetch the report WITHOUT paying, to display the raw 402 challenge. */
async function showChallenge(requestId: string): Promise<void> {
  const res = await fetch(`${APP_URL}/api/report/${requestId}`, { method: "GET" });
  console.log(`\n← GET /api/report/${requestId} (no payment) → HTTP ${res.status}`);

  const header = res.headers.get("PAYMENT-REQUIRED");
  if (header) {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    console.log("  PAYMENT-REQUIRED (decoded):");
    console.log(JSON.stringify(decoded, null, 2));
  }
  const body = await res.json().catch(() => null);
  console.log("  body:", JSON.stringify(body, null, 2));
}

async function main() {
  const argRequestId = process.argv[2];
  const requestId = argRequestId ?? (await uploadSample(DEFAULT_SAMPLE));

  // Always show the genuine 402 challenge first.
  await showChallenge(requestId);

  if (!serverConfig.x402Configured) {
    console.log(
      "\nℹ Demo-payer keys are not configured, so no live settlement was performed.\n" +
        "  The HTTP 402 above IS the genuine paywall. To settle for real:\n" +
        "    1. set HEDERA_OPERATOR_ID/KEY + X402_PAYMENT_RECIPIENT,\n" +
        "    2. run `npm run hedera:create-wallet` and set X402_DEMO_PAYER_ID/KEY,\n" +
        "    3. re-run `npm run agent:demo`.",
    );
    process.exit(0);
  }

  // ── Settle for real, exactly as an autonomous agent would ──────────────────
  const network = serverConfig.x402Network as Network;
  const signer = createClientHederaSigner(
    serverConfig.demoPayerId as string,
    parsePrivateKey(serverConfig.demoPayerKey as string),
    { network },
  );
  const client = new x402Client().register(network, new ExactHederaSchemeClient(signer));
  const payFetch = wrapFetchWithPayment(fetch, client);

  console.log("\n→ Retrying with payment (x402 handshake)…");
  const res = await payFetch(`${APP_URL}/api/report/${requestId}`, { method: "GET" });
  const report = await res.json().catch(() => null);

  console.log(`← HTTP ${res.status}`);
  const settleHeader = res.headers.get("PAYMENT-RESPONSE");
  if (settleHeader) {
    const decoded = JSON.parse(Buffer.from(settleHeader, "base64").toString("utf8"));
    console.log("  PAYMENT-RESPONSE (decoded settlement):");
    console.log(JSON.stringify(decoded, null, 2));
  }
  console.log("  Released report:");
  console.log(JSON.stringify(report, null, 2));

  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("✗ agent-client failed:", err);
  process.exit(1);
});
