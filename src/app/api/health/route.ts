/**
 * GET /api/health  —  readiness + configuration diagnostics.
 *
 * Tells the owner at a glance whether the app is running in "configured" mode
 * (real Hedera + x402) or "unconfigured" mode (offline fixtures), and which
 * pieces are set — WITHOUT ever revealing a secret value (only booleans).
 */
import { json, safeHandler } from "@/lib/http";
import { serverConfig, tinybarsToHbar } from "@/lib/config";
import { getDbBundle } from "@/lib/db";
import { pingDb } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return safeHandler("api/health", async () => {
    let dbOk = false;
    let driver = "unknown";
    try {
      const bundle = await getDbBundle();
      driver = bundle.driver;
      dbOk = await pingDb();
    } catch (err) {
      console.error("[api/health] db ping failed", err);
    }

    const mode = serverConfig.hederaConfigured ? "configured" : "unconfigured";

    return json({
      status: dbOk ? "ok" : "degraded",
      mode,
      timestamp: new Date().toISOString(),
      db: { driver, ok: dbOk },
      hedera: {
        configured: serverConfig.hederaConfigured,
        network: serverConfig.hederaNetwork,
        topicConfigured: Boolean(serverConfig.hcsTopicId),
        mirrorNode: serverConfig.mirrorNodeBaseUrl,
      },
      x402: {
        configured: serverConfig.x402Configured,
        network: serverConfig.x402Network,
        priceTinybars: serverConfig.x402Price,
        priceHbar: tinybarsToHbar(serverConfig.x402Price),
        asset: serverConfig.x402Asset,
        facilitator: serverConfig.x402FacilitatorUrl,
        recipientConfigured: Boolean(serverConfig.x402PaymentRecipient),
        demoPayerConfigured: Boolean(serverConfig.demoPayerId && serverConfig.demoPayerKey),
      },
      upload: { maxBytes: serverConfig.maxUploadSize },
      tamperDemo: {
        enabled: serverConfig.tamperDemoEnabled,
        testnet: serverConfig.isTestnet,
        rateLimitMax: serverConfig.tamperDemoRateLimitMax,
        rateLimitWindowSeconds: serverConfig.tamperDemoRateLimitWindowSeconds,
      },
    });
  });
}
