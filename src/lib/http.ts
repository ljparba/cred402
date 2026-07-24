/**
 * Small HTTP helpers for API route handlers: consistent JSON envelopes, private
 * (never-cached) responses for user-specific data, an early request-size guard,
 * and a safe error responder that never leaks stack traces to clients (plan §12).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export interface ApiError {
  error: string;
  code?: string;
  requestId?: string;
}

export function apiError(
  message: string,
  status: number,
  extra?: { code?: string; requestId?: string; headers?: HeadersInit },
): NextResponse {
  const body: ApiError = { error: message };
  if (extra?.code) body.code = extra.code;
  if (extra?.requestId) body.requestId = extra.requestId;
  return NextResponse.json(body, { status, headers: extra?.headers });
}

// ── Private (no-store) responses ─────────────────────────────────────────────

/**
 * Headers for any response that can carry user-specific verification or payment
 * data. `private` keeps shared caches (CDNs, proxies) out entirely and
 * `no-store` stops even the browser writing it to disk; `Pragma` covers
 * HTTP/1.0 intermediaries. Deliberately NOT applied to the public, immutable
 * sample downloads — those are identical for every caller and benefit from
 * caching.
 */
export const PRIVATE_NO_STORE: Record<string, string> = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
};

/** Stamp the private no-cache headers onto an existing response, in place. */
export function markPrivate<T extends Response>(res: T): T {
  for (const [name, value] of Object.entries(PRIVATE_NO_STORE)) {
    res.headers.set(name, value);
  }
  return res;
}

// ── Short public cache (aggregate/feed routes only) ──────────────────────────

/**
 * Cache policy for PUBLIC aggregate/feed data (currently GET /api/activity).
 *
 * `public` lets a shared CDN/proxy cache it; `max-age=0` keeps the browser always
 * revalidating; `s-maxage=15` lets a shared cache serve a slightly-stale aggregate
 * for a few seconds, and `stale-while-revalidate=30` refreshes it in the
 * background — cutting origin load from the homepage poll with pure HTTP/CDN cache
 * semantics and NO server-side memory state (so it stays correct across multiple
 * Render instances). This is the OPPOSITE of {@link PRIVATE_NO_STORE}: it must
 * NEVER be applied to a user-specific verification or payment response.
 */
export const PUBLIC_SHORT_CACHE = "public, max-age=0, s-maxage=15, stale-while-revalidate=30";

/**
 * Wrap a handler so any thrown error becomes a clean 500 without exposing
 * internals. Logs the real error server-side for diagnostics.
 */
export async function safeHandler<T extends Response>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[${label}]`, err);
    return apiError("Internal server error.", 500, { code: "INTERNAL_ERROR" });
  }
}

/**
 * `safeHandler` for routes that return user-specific data. Every response that
 * leaves the handler — success, typed error, or the generic 500 — is stamped
 * with {@link PRIVATE_NO_STORE}, so no path can accidentally ship a cacheable
 * report or payment response.
 */
export async function safePrivateHandler<T extends Response>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | NextResponse> {
  return markPrivate(await safeHandler(label, fn));
}

// ── Early request-size guard ─────────────────────────────────────────────────

/**
 * Reject a clearly-oversized upload from its DECLARED `Content-Length`, before
 * the body is read or parsed.
 *
 * Deliberately narrow, because `Content-Length` is client-supplied:
 *  - absent or unparseable → allow through; the authoritative post-parse
 *    file-size check still runs and still rejects.
 *  - understated → likewise irrelevant, because the real bytes are measured
 *    after parsing.
 *  - clearly over the ceiling → 413 now, so we never buffer/parse the body.
 *
 * `maxRequestBytes` is the whole-request ceiling (multipart overhead included),
 * NOT the per-file limit. This complements, and does not replace, the body
 * limits enforced by the deployment/proxy in front of the app.
 *
 * @returns a 413 response to return immediately, or `null` to proceed.
 */
export function enforceRequestSize(req: NextRequest, maxRequestBytes: number): NextResponse | null {
  const declared = req.headers.get("content-length");
  if (declared === null) return null;
  const bytes = Number(declared);
  if (!Number.isFinite(bytes) || bytes <= maxRequestBytes) return null;
  return apiError(
    `Request body is too large (${bytes} bytes declared). Maximum is ${maxRequestBytes} bytes.`,
    413,
    { code: "PAYLOAD_TOO_LARGE" },
  );
}
