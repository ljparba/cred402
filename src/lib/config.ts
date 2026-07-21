/**
 * Typed, centralised environment access for Cred402.
 *
 * Two config surfaces:
 *  - `serverConfig`  — server-only. Reading it from a Client Component throws.
 *  - `publicConfig`  — safe for the browser (NEXT_PUBLIC_* only).
 *
 * The app has two operating modes so it can build and run without secrets:
 *  - CONFIGURED    — Hedera operator id + key present → real HCS + settlement.
 *  - UNCONFIGURED  — keys absent → offline fixtures, clearly labelled in the UI.
 *
 * Nothing here throws at import time for missing Hedera/x402 values; callers ask
 * `serverConfig.hederaConfigured` / `x402Configured` and degrade gracefully.
 */

const isServer = typeof window === "undefined";

function requireServer(name: string): void {
  if (!isServer) {
    throw new Error(
      `serverConfig.${name} was read in the browser. This value is server-only; ` +
        `move the access into a Server Component, route handler, or server action.`,
    );
  }
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

function envInt(name: string, fallback: number): number {
  const raw = env(name);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

// ── Public (browser-safe) ────────────────────────────────────────────────────
export const publicConfig = {
  appUrl: stripTrailingSlash(env("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000"),
  hederaNetwork: env("NEXT_PUBLIC_HEDERA_NETWORK") ?? "testnet",
  hashscanBaseUrl: stripTrailingSlash(
    env("NEXT_PUBLIC_HASHSCAN_BASE_URL") ?? "https://hashscan.io/testnet",
  ),
  githubUrl: env("NEXT_PUBLIC_GITHUB_URL") ?? "https://github.com/",
} as const;

// ── Server-only ──────────────────────────────────────────────────────────────
const operatorId = env("HEDERA_OPERATOR_ID");
const operatorKey = env("HEDERA_OPERATOR_PRIVATE_KEY");
const paymentRecipient = env("X402_PAYMENT_RECIPIENT") ?? operatorId;
const demoPayerId = env("X402_DEMO_PAYER_ID");
const demoPayerKey = env("X402_DEMO_PAYER_PRIVATE_KEY");

/** True when we can create topics, submit HCS events, and read Mirror Node as us. */
const hederaConfigured = Boolean(operatorId && operatorKey);

/** True when a full x402 settlement can actually run (payer + recipient present). */
const x402Configured = Boolean(
  hederaConfigured && paymentRecipient && demoPayerId && demoPayerKey,
);

export const serverConfig = {
  get databaseUrl(): string | undefined {
    requireServer("databaseUrl");
    return env("DATABASE_URL");
  },
  get pgliteDataDir(): string {
    requireServer("pgliteDataDir");
    return env("PGLITE_DATA_DIR") ?? "./.pglite";
  },
  get usePglite(): boolean {
    requireServer("usePglite");
    return env("DATABASE_URL") === undefined;
  },

  // Hedera
  hederaConfigured,
  get hederaNetwork(): string {
    requireServer("hederaNetwork");
    return env("HEDERA_NETWORK") ?? "testnet";
  },
  get operatorId(): string | undefined {
    requireServer("operatorId");
    return operatorId;
  },
  get operatorKey(): string | undefined {
    requireServer("operatorKey");
    return operatorKey;
  },
  get hcsTopicId(): string | undefined {
    requireServer("hcsTopicId");
    return env("HEDERA_HCS_TOPIC_ID");
  },
  get mirrorNodeBaseUrl(): string {
    requireServer("mirrorNodeBaseUrl");
    return stripTrailingSlash(
      env("MIRROR_NODE_BASE_URL") ?? "https://testnet.mirrornode.hedera.com",
    );
  },

  // x402
  x402Configured,
  get x402Network(): string {
    requireServer("x402Network");
    return env("X402_NETWORK") ?? "hedera:testnet";
  },
  get x402FacilitatorUrl(): string {
    requireServer("x402FacilitatorUrl");
    return stripTrailingSlash(env("X402_FACILITATOR_URL") ?? "https://x402.org/facilitator");
  },
  get x402PaymentRecipient(): string | undefined {
    requireServer("x402PaymentRecipient");
    return paymentRecipient;
  },
  /** Price of one report, in tinybars (string, exact). Default 0.1 HBAR. */
  get x402Price(): string {
    requireServer("x402Price");
    return env("X402_PRICE") ?? "10000000";
  },
  get x402Asset(): string {
    requireServer("x402Asset");
    return env("X402_ASSET") ?? "0.0.0";
  },
  get demoPayerId(): string | undefined {
    requireServer("demoPayerId");
    return demoPayerId;
  },
  get demoPayerKey(): string | undefined {
    requireServer("demoPayerKey");
    return demoPayerKey;
  },

  // Uploads
  get maxUploadSize(): number {
    requireServer("maxUploadSize");
    return envInt("MAX_UPLOAD_SIZE", 5 * 1024 * 1024);
  },

  // Tamper demo (Create Tamper Demo feature)
  /** True when the network is Hedera testnet — the demo is testnet-only. */
  get isTestnet(): boolean {
    requireServer("isTestnet");
    return (env("HEDERA_NETWORK") ?? "testnet").toLowerCase() === "testnet";
  },
  /** Master switch for the public demo-registration endpoint. Default OFF. */
  get tamperDemoEnabled(): boolean {
    requireServer("tamperDemoEnabled");
    return (env("TAMPER_DEMO_ENABLED") ?? "false").toLowerCase() === "true";
  },
  get tamperDemoRateLimitMax(): number {
    requireServer("tamperDemoRateLimitMax");
    return envInt("TAMPER_DEMO_RATE_LIMIT_MAX", 3);
  },
  get tamperDemoRateLimitWindowSeconds(): number {
    requireServer("tamperDemoRateLimitWindowSeconds");
    return envInt("TAMPER_DEMO_RATE_LIMIT_WINDOW_SECONDS", 3600);
  },
} as const;

/** 0.1 HBAR from "10000000" tinybars, for display. */
export function tinybarsToHbar(tinybars: string): string {
  const n = BigInt(tinybars);
  const whole = n / 100_000_000n;
  const frac = (n % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
