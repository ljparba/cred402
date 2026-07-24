/**
 * Typed, centralised environment access for Cred402.
 *
 * Two config surfaces:
 *  - `serverConfig`  — server-only. Reading it from a Client Component throws.
 *  - `publicConfig`  — safe for the browser (NEXT_PUBLIC_* only).
 *
 * Capability flags are computed SEPARATELY, because the three things a
 * deployment can be configured for need different secrets:
 *
 *  - `hcsWriteConfigured`       — can submit HCS messages (operator id + key).
 *  - `x402SettlementConfigured` — can run the report 402/settlement flow
 *                                 (network + recipient + facilitator + price +
 *                                 asset). Does NOT need the HCS operator key:
 *                                 the buyer signs and the facilitator sponsors.
 *  - `demoWalletConfigured`     — can act as the built-in server-side payer
 *                                 (demo payer id + key + settlement config).
 *
 * `mode` ("configured" / "unconfigured") is kept for backward compatibility and
 * means exactly one thing: whether this deployment can write to HCS.
 *
 * Nothing here throws at import time for missing Hedera/x402 values; callers ask
 * the relevant flag and degrade gracefully.
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

/** The three independent capability flags a deployment can have. */
export interface ConfigFlags {
  /** Can submit HCS messages: operator id + private key. */
  hcsWriteConfigured: boolean;
  /** Can run the report 402 → settlement flow: recipient + network + facilitator + price + asset. */
  x402SettlementConfigured: boolean;
  /** Can pay as the built-in demo wallet: demo payer id + key, on top of settlement config. */
  demoWalletConfigured: boolean;
}

/**
 * Pure, side-effect-free flag computation over a plain env-like record, so each
 * capability can be reasoned about (and tested) independently of `process.env`.
 * Values with defaults (network, facilitator, price, asset) are treated as
 * present when unset — the defaults are real, working values.
 */
export function computeConfigFlags(source: Record<string, string | undefined>): ConfigFlags {
  const get = (name: string): string | undefined => {
    const v = source[name];
    return v === undefined || v === "" ? undefined : v;
  };

  const opId = get("HEDERA_OPERATOR_ID");
  const opKey = get("HEDERA_OPERATOR_PRIVATE_KEY");
  const recipient = get("X402_PAYMENT_RECIPIENT") ?? opId;

  const hcsWriteConfigured = Boolean(opId && opKey);

  // Deliberately independent of `hcsWriteConfigured`: the report settlement path
  // never signs with the operator key — the buyer signs the transfer and the
  // facilitator sponsors the fee. Requiring the HCS key here would be a lie.
  const x402SettlementConfigured = Boolean(
    recipient &&
      (get("X402_NETWORK") ?? "hedera:testnet") &&
      (get("X402_FACILITATOR_URL") ?? "https://x402.org/facilitator") &&
      (get("X402_PRICE") ?? "10000000") &&
      (get("X402_ASSET") ?? "0.0.0"),
  );

  const demoWalletConfigured = Boolean(
    x402SettlementConfigured && get("X402_DEMO_PAYER_ID") && get("X402_DEMO_PAYER_PRIVATE_KEY"),
  );

  return { hcsWriteConfigured, x402SettlementConfigured, demoWalletConfigured };
}

const flags = computeConfigFlags(process.env);

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

  // ── Capability flags (independent; see computeConfigFlags) ────────────────
  /** Can submit HCS messages (operator id + key). */
  hcsWriteConfigured: flags.hcsWriteConfigured,
  /** Can run the report 402 → settlement flow (recipient + network + facilitator + price). */
  x402SettlementConfigured: flags.x402SettlementConfigured,
  /** Can pay as the built-in server-side demo wallet. */
  demoWalletConfigured: flags.demoWalletConfigured,
  /**
   * Backward-compatible alias for `hcsWriteConfigured`, still used by the
   * Hedera client + owner scripts, all of which genuinely need the operator key.
   */
  hederaConfigured: flags.hcsWriteConfigured,

  // Hedera
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
  /**
   * Ceiling for the whole declared REQUEST body of an upload, checked against
   * `Content-Length` before the body is parsed. Deliberately ABOVE
   * `maxUploadSize`: a multipart body carries boundary + part headers on top of
   * the file, so comparing the request to the file limit would reject valid
   * near-limit uploads. Only clearly-oversized bodies are rejected early; the
   * authoritative per-file check still runs after parsing.
   */
  get maxUploadRequestSize(): number {
    requireServer("maxUploadRequestSize");
    return envInt("MAX_UPLOAD_REQUEST_SIZE", envInt("MAX_UPLOAD_SIZE", 5 * 1024 * 1024) + 1024 * 1024);
  },

  // Public-endpoint rate limits (DB-backed, per hashed IP)
  get verifyRateLimitMax(): number {
    requireServer("verifyRateLimitMax");
    return envInt("VERIFY_RATE_LIMIT_MAX", 20);
  },
  get verifyRateLimitWindowSeconds(): number {
    requireServer("verifyRateLimitWindowSeconds");
    return envInt("VERIFY_RATE_LIMIT_WINDOW_SECONDS", 3600);
  },
  get payRateLimitMax(): number {
    requireServer("payRateLimitMax");
    return envInt("PAY_RATE_LIMIT_MAX", 5);
  },
  get payRateLimitWindowSeconds(): number {
    requireServer("payRateLimitWindowSeconds");
    return envInt("PAY_RATE_LIMIT_WINDOW_SECONDS", 3600);
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
