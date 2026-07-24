/**
 * DB-backed sliding-window rate limiter for the public endpoints.
 *
 * Originally written for the HCS-writing Create-Tamper-Demo endpoint and now
 * shared by `POST /api/verify` and `POST /api/pay` as well — one implementation,
 * one storage table, one set of semantics.
 *
 * We use the database rather than an in-memory counter so the limit holds across
 * Render's multiple instances/processes and across cold starts, using the same
 * portable `DATABASE_URL` abstraction (PGlite locally, Postgres in prod).
 *
 * PRIVACY: client IPs are SHA-256-hashed before storage — a stored bucket key is
 * `"<bucket>:<hash>"` and no raw IP address is ever persisted or logged.
 *
 * TRUST MODEL: the client address is read from `x-forwarded-for` /
 * `x-real-ip`, which are only as trustworthy as the proxy in front of the app
 * (on Render, Render's own load balancer). A caller that can set those headers
 * directly can rotate buckets, so this is a BEST-EFFORT abuse brake, not an
 * authentication boundary — and it never replaces the per-request payment lock.
 */
import { and, eq, gte, lt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import { newRateLimitId } from "@/lib/ids";
import { apiError } from "@/lib/http";
import type { NextResponse } from "next/server";

/** Hash an IP (or "unknown") so we never store the raw address. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`cred402-ip:${ip}`).digest("hex").slice(0, 32);
}

/** Best-effort extraction of the client IP from the trusted proxy's headers. */
export function clientIpFrom(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Bucket key for one caller on one endpoint. Buckets never share a namespace. */
export function bucketKey(bucket: string, headers: Headers): string {
  return `${bucket}:${hashIp(clientIpFrom(headers))}`;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the window frees up, when blocked. */
  retryAfterSeconds?: number;
}

/**
 * Count hits for `key` within the window; if under `max`, record a new hit and
 * allow. Prunes expired rows opportunistically. Fails OPEN on a DB error (a
 * limiter outage must not break the feature), logging the failure.
 */
export async function checkAndRecord(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const db = await getDb();
    const now = Date.now();
    const since = new Date(now - windowSeconds * 1000);

    // Opportunistic prune of anything older than the window (any key).
    await db.delete(schema.rateLimitHits).where(lt(schema.rateLimitHits.at, since));

    const hits = await db
      .select({ at: schema.rateLimitHits.at })
      .from(schema.rateLimitHits)
      .where(and(eq(schema.rateLimitHits.key, key), gte(schema.rateLimitHits.at, since)));

    if (hits.length >= max) {
      const oldest = hits.reduce((m, h) => Math.min(m, h.at.getTime()), now);
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowSeconds * 1000 - now) / 1000));
      return { ok: false, remaining: 0, limit: max, retryAfterSeconds };
    }

    await db.insert(schema.rateLimitHits).values({ id: newRateLimitId(), key, at: new Date() });
    return { ok: true, remaining: Math.max(0, max - hits.length - 1), limit: max };
  } catch (err) {
    console.error("[rate-limit] failing open:", err);
    return { ok: true, remaining: max, limit: max };
  }
}

/**
 * Route helper: record a hit for this caller and, when the limit is exceeded,
 * return the ready-made 429. Returns `null` when the request may proceed.
 *
 * The response carries `Retry-After` and a generic message — never the stored
 * IP hash, the bucket name, or any other limiter internal.
 */
export async function enforceRateLimit(
  headers: Headers,
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  const result = await checkAndRecord(bucketKey(bucket, headers), max, windowSeconds);
  if (result.ok) return null;
  const retryAfter = result.retryAfterSeconds ?? windowSeconds;
  return apiError(
    `Rate limit reached (${result.limit} requests per ` +
      `${Math.round(windowSeconds / 60)} minutes). Try again in ~${retryAfter}s.`,
    429,
    { code: "RATE_LIMITED", headers: { "retry-after": String(retryAfter) } },
  );
}
