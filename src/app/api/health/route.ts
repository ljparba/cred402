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

    // `mode` means exactly one thing for backward compatibility: can this
    // deployment write to HCS. The three capabilities below are independent.
    const mode = serverConfig.hcsWriteConfigured ? "configured" : "unconfigured";

    return json({
      status: dbOk ? "ok" : "degraded",
      mode,
      timestamp: new Date().toISOString(),
      db: { driver, ok: dbOk },
      // Three separate capability flags — never one coupled boolean.
      config: {
        hcsWriteConfigured: serverConfig.hcsWriteConfigured,
        x402SettlementConfigured: serverConfig.x402SettlementConfigured,
        demoWalletConfigured: serverConfig.demoWalletConfigured,
      },
      hedera: {
        // Alias of hcsWriteConfigured (needs the operator private key).
        configured: serverConfig.hcsWriteConfigured,
        hcsWriteConfigured: serverConfig.hcsWriteConfigured,
        network: serverConfig.hederaNetwork,
        topicConfigured: Boolean(serverConfig.hcsTopicId),
        mirrorNode: serverConfig.mirrorNodeBaseUrl,
      },
      x402: {
        // Can the report 402/settlement flow actually run (no operator key needed).
        configured: serverConfig.x402SettlementConfigured,
        settlementConfigured: serverConfig.x402SettlementConfigured,
        network: serverConfig.x402Network,
        priceTinybars: serverConfig.x402Price,
        priceHbar: tinybarsToHbar(serverConfig.x402Price),
        asset: serverConfig.x402Asset,
        facilitator: serverConfig.x402FacilitatorUrl,
        recipientConfigured: Boolean(serverConfig.x402PaymentRecipient),
        demoWalletConfigured: serverConfig.demoWalletConfigured,
        // Public account id only when configured — never the key.
        demoPayerConfigured: serverConfig.demoWalletConfigured,
      },
      rateLimits: {
        verify: {
          max: serverConfig.verifyRateLimitMax,
          windowSeconds: serverConfig.verifyRateLimitWindowSeconds,
        },
        pay: {
          max: serverConfig.payRateLimitMax,
          windowSeconds: serverConfig.payRateLimitWindowSeconds,
        },
      },
      upload: {
        maxBytes: serverConfig.maxUploadSize,
        maxRequestBytes: serverConfig.maxUploadRequestSize,
      },
      tamperDemo: {
        enabled: serverConfig.tamperDemoEnabled,
        testnet: serverConfig.isTestnet,
        rateLimitMax: serverConfig.tamperDemoRateLimitMax,
        rateLimitWindowSeconds: serverConfig.tamperDemoRateLimitWindowSeconds,
      },
    });
  });
}
