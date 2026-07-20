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
  mode: "configured" | "unconfigured";
  timestamp: string;
  db: { driver: string; ok: boolean };
  hedera: {
    configured: boolean;
    network: string;
    topicConfigured: boolean;
    mirrorNode: string;
  };
  x402: {
    configured: boolean;
    network: string;
    priceTinybars: string;
    priceHbar: string;
    asset: string;
    facilitator: string;
    recipientConfigured: boolean;
    demoPayerConfigured: boolean;
  };
  upload: { maxBytes: number };
}

// ── /api/activity ────────────────────────────────────────────────────────────
export interface ActivityStats {
  certificatesAnchored: number;
  hcsEvents: number;
  verifications: number;
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

  /** Upload a file for a free, locked preview. Throws { error, code } on 415/400. */
  async verify(file: File | Blob, filename: string): Promise<VerifyResponse> {
    const form = new FormData();
    form.append("file", file, filename);
    const res = await fetch("/api/verify", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      const err = body as ApiError;
      const e = new Error(err.error ?? "Verification failed") as Error & { code?: string; status: number };
      e.code = err.code;
      e.status = res.status;
      throw e;
    }
    return body as VerifyResponse;
  },

  /**
   * Fetch the report resource. Returns the genuine 402 challenge (status 402)
   * OR the released report (status 200). `demo` appends ?demo=1 (only bypasses
   * on unconfigured deployments; a keyed deployment still 402s).
   */
  async report(
    requestId: string,
    opts?: { demo?: boolean },
  ): Promise<{ status: number; challenge?: Challenge402; report?: ReportResponse }> {
    const qs = opts?.demo ? "?demo=1" : "";
    const res = await fetch(`/api/report/${requestId}${qs}`, { cache: "no-store" });
    const body = await res.json();
    if (res.status === 402) return { status: 402, challenge: body as Challenge402 };
    if (res.ok) return { status: res.status, report: body as ReportResponse };
    throw new Error(`report ${requestId} failed: ${res.status}`);
  },

  /**
   * Trigger the built-in demo wallet to pay the real 402 gate. On unconfigured
   * deployments returns { configured:false } so the caller falls back to ?demo=1.
   */
  async pay(
    requestId: string,
  ): Promise<{ ok: boolean; configured: boolean; report?: ReportResponse; code?: string }> {
    const res = await fetch("/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const body = await res.json();
    if (res.ok) {
      return { ok: true, configured: true, report: body.report as ReportResponse };
    }
    const err = body as ApiError;
    return { ok: false, configured: err.code !== "DEMO_WALLET_NOT_CONFIGURED", code: err.code };
  },

  /** Download a sample file as a Blob, ready to POST to /api/verify. */
  async sampleBlob(downloadUrl: string): Promise<Blob> {
    const res = await fetch(downloadUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`sample download failed: ${res.status}`);
    return res.blob();
  },
};
