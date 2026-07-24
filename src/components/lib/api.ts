/**
 * Browser-side API client + shared response types for Cred402.
 *
 * Every network call the one-page experience makes to the built-in API routes
 * flows through here, so components stay declarative. Types mirror the exact
 * server contracts (see src/app/api/**). Nothing here is server-only.
 */

// ── /api/health ──────────────────────────────────────────────────────────────
export interface HealthResponse {
  status: string;
  /** Backward-compatible: "configured" ⇔ this deployment can write to HCS. */
  mode: "configured" | "unconfigured";
  timestamp: string;
  db: { driver: string; ok: boolean };
  /** The three independent capability flags. */
  config: {
    hcsWriteConfigured: boolean;
    x402SettlementConfigured: boolean;
    demoWalletConfigured: boolean;
  };
  hedera: {
    configured: boolean;
    hcsWriteConfigured: boolean;
    network: string;
    topicConfigured: boolean;
    mirrorNode: string;
  };
  x402: {
    configured: boolean;
    settlementConfigured: boolean;
    network: string;
    priceTinybars: string;
    priceHbar: string;
    asset: string;
    facilitator: string;
    recipientConfigured: boolean;
    demoWalletConfigured: boolean;
    demoPayerConfigured: boolean;
  };
  rateLimits: {
    verify: { max: number; windowSeconds: number };
    pay: { max: number; windowSeconds: number };
  };
  upload: { maxBytes: number; maxRequestBytes: number };
  tamperDemo: {
    enabled: boolean;
    testnet: boolean;
    rateLimitMax: number;
    rateLimitWindowSeconds: number;
  };
}

// ── /api/activity ────────────────────────────────────────────────────────────
/**
 * Real counts from the deployment's own database. Every field is what its name
 * says — the UI labels them literally and never invents deltas or estimates.
 */
export interface ActivityStats {
  /** Credential records registered in this deployment. */
  registeredCredentials: number;
  /** Verification requests created, including locked / unpaid ones. */
  verificationRequests: number;
  /** HCS issuance/revocation records — see `hcsSource` for what they are. */
  hcsRecords: number;
  /** `"network"` = anchored on Hedera; `"fixture"` = local offline demo events. */
  hcsSource: "network" | "fixture";
  /** Successful (SETTLED) x402 settlements. */
  settlements: number;
}
export interface ActivityItem {
  kind: "hcs_event" | "payment_settled" | "verification";
  title: string;
  subtitle: string;
  at: string;
  hashscanUrl?: string;
  ref?: string;
}
export interface ActivityResponse {
  stats: ActivityStats;
  items: ActivityItem[];
}

// ── /api/samples ─────────────────────────────────────────────────────────────
export type SampleCategory =
  | "valid"
  | "tampered"
  | "expired"
  | "revoked"
  | "unregistered"
  | "fake";
export interface SampleItem {
  slug: string;
  category: SampleCategory;
  label: string;
  description: string;
  expectedVerdict: Verdict;
  credentialId: string | null;
  sha256: string | null;
  filename: string;
  downloadUrl: string;
}
export interface SamplesResponse {
  count: number;
  samples: SampleItem[];
}

// ── /api/verify ──────────────────────────────────────────────────────────────
export interface VerifyResponse {
  requestId: string;
  file: { name: string; size: number; mime: string; sha256: string };
  identified: boolean;
  credential: { id: string; courseName: string; issuerName: string } | null;
  locked: true;
  reportUrl: string;
  payment: {
    network: string;
    asset: string;
    amount: string;
    amountHbar: string;
    currencyLabel: string;
    payTo: string | null;
    configured: boolean;
  };
}
export interface ApiError {
  error: string;
  code?: string;
}

// ── /api/report/{id} — 402 challenge ─────────────────────────────────────────
export interface X402Accept {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: { feePayer?: string };
}
export interface Challenge402 {
  x402Version: number;
  error: string;
  accepts: X402Accept[];
  resource?: string;
  configured: boolean;
  requestId: string;
  note?: string;
  price?: { asset: string; amount: string; amountHbar: string; network: string };
}

// ── /api/report/{id} — released report ───────────────────────────────────────
export type Verdict =
  | "VALID"
  | "TAMPERED"
  | "REVOKED"
  | "EXPIRED"
  | "UNREGISTERED_ISSUER"
  | "UNKNOWN";
export type CheckStatus = "PASS" | "FAIL" | "WARN" | "SKIP";
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  evidence: string;
}
export interface ReportPayment {
  transactionId: string | null;
  payer: string | null;
  payTo: string | null;
  amount: string;
  amountHbar: string;
  currencyLabel: string;
  network: string;
  consensusTimestamp: string | null;
  mirrorVerified: boolean;
  hashscanUrl: string | null;
  simulated: boolean;
}
export interface ReportResponse {
  requestId: string;
  paid: boolean;
  demo: boolean;
  note?: string;
  verdict: Verdict | null;
  checks: Check[];
  credential: { id: string; issuerId: string | null } | null;
  hashes: { uploaded: string; anchored: string | null };
  hcs: { sequenceNumber: number | null; transactionId: string } | null;
  payment: ReportPayment;
}

// ── /api/demo/register — Create Tamper Demo registration ─────────────────────
export interface DemoHcsProof {
  topicId: string;
  sequenceNumber: number;
  transactionId: string;
  consensusTimestamp: string | null;
  hashscanUrl: string;
  topicUrl: string;
}
export interface DemoRegisterResponse {
  demoCredentialId: string;
  sha256: string;
  issuerId: string;
  issuerName: string;
  label: string;
  anchored: boolean;
  hcs: DemoHcsProof | null;
  network: string;
  demo: true;
  synthetic: true;
  createdAt: string;
  disclaimer: string;
  labels: string[];
  nextSteps: { message: string; verifyWith: string };
  rateLimit: { remaining: number; limit: number };
}

/** A typed error carrying the server `code` + HTTP status for clean UI handling. */
export type ApiThrown = Error & { code?: string; status?: number };

// ── Fetch helpers ────────────────────────────────────────────────────────────

/** GET JSON, throwing a typed error on non-2xx. */
async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: (signal?: AbortSignal) => getJson<HealthResponse>("/api/health", signal),
  activity: (signal?: AbortSignal) => getJson<ActivityResponse>("/api/activity", signal),
  samples: (signal?: AbortSignal) => getJson<SamplesResponse>("/api/samples", signal),

  /**
   * Upload a file for a free, locked preview. Throws { error, code } on 415/400.
   * Pass `credentialId` to bind the upload to a specific credential — used by the
   * Create-Tamper-Demo re-verification (a modified copy carries the demo id so
   * the engine can prove the hash diverged from the anchored original).
   */
  async verify(
    file: File | Blob,
    filename: string,
    credentialId?: string,
  ): Promise<VerifyResponse> {
    const form = new FormData();
    form.append("file", file, filename);
    if (credentialId) form.append("credentialId", credentialId);
    const res = await fetch("/api/verify", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      const err = body as ApiError;
      const e = new Error(err.error ?? "Verification failed") as ApiThrown;
      e.code = err.code;
      e.status = res.status;
      throw e;
    }
    return body as VerifyResponse;
  },

  /**
   * Register an ORIGINAL file as a synthetic demo credential (Create Tamper
   * Demo). Real HCS write when configured — callers must gate this on
   * `health.tamperDemo.enabled` and confirm the user intent first. Throws a
   * typed error carrying the server `code` (FEATURE_DISABLED / NOT_TESTNET /
   * RATE_LIMITED / INVALID_FILE) + HTTP status.
   */
  async demoRegister(
    file: File | Blob,
    filename: string,
    label?: string,
  ): Promise<DemoRegisterResponse> {
    const form = new FormData();
    form.append("file", file, filename);
    if (label) form.append("label", label);
    const res = await fetch("/api/demo/register", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      const err = body as ApiError;
      const e = new Error(err.error ?? "Demo registration failed") as ApiThrown;
      e.code = err.code;
      e.status = res.status;
      throw e;
    }
    return body as DemoRegisterResponse;
  },

  /**
   * Fetch the report resource. Returns the genuine 402 challenge (status 402),
   * the released report (status 200), or a typed error (`status` + `code`) for
   * a 4xx such as 410 REQUEST_EXPIRED / 409 PAYMENT_IN_PROGRESS. This is a
   * PAYMENT-FREE read — safe to poll for a "Check status" action. `demo`
   * appends ?demo=1 (only bypasses when settlement is unconfigured).
   */
  async report(
    requestId: string,
    opts?: { demo?: boolean },
  ): Promise<{
    status: number;
    challenge?: Challenge402;
    report?: ReportResponse;
    code?: string;
    error?: string;
  }> {
    const qs = opts?.demo ? "?demo=1" : "";
    const res = await fetch(`/api/report/${requestId}${qs}`, { cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (res.status === 402) return { status: 402, challenge: body as Challenge402 };
    if (res.ok) return { status: res.status, report: body as ReportResponse };
    const err = (body ?? {}) as ApiError;
    return { status: res.status, code: err.code, error: err.error };
  },

  /**
   * Trigger the built-in demo wallet to pay the real 402 gate. Returns the
   * released report, or a typed failure carrying the downstream `code`,
   * `status`, and `retryAfter` so the UI can distinguish "retry is safe" from
   * "re-upload" from "never pay again". `configured` is false only when the
   * deployment has no demo wallet (→ the caller may fall back to ?demo=1).
   */
  async pay(requestId: string): Promise<{
    ok: boolean;
    configured: boolean;
    report?: ReportResponse;
    code?: string;
    status?: number;
    error?: string;
    retryAfter?: number;
  }> {
    const res = await fetch("/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      return { ok: true, configured: true, report: (body as { report?: ReportResponse })?.report };
    }
    const err = (body ?? {}) as ApiError;
    const retryAfterHeader = res.headers.get("retry-after");
    return {
      ok: false,
      configured: err.code !== "DEMO_WALLET_NOT_CONFIGURED",
      code: err.code,
      status: res.status,
      error: err.error,
      retryAfter: retryAfterHeader ? Number(retryAfterHeader) : undefined,
    };
  },

  /** Download a sample file as a Blob, ready to POST to /api/verify. */
  async sampleBlob(downloadUrl: string): Promise<Blob> {
    const res = await fetch(downloadUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`sample download failed: ${res.status}`);
    return res.blob();
  },
};
