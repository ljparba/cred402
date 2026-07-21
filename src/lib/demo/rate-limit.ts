/**
 * DB-backed sliding-window rate limiter for the public demo-registration
 * endpoint (which writes to HCS, so it must be protected — plan §8.5).
 *
 * We use the database rather than an in-memory counter so the limit holds
 * across Render's multiple instances and across serverless cold starts, using
 * the same portable `DATABASE_URL` abstraction (PGlite locally, Postgres in
 * prod). Client IPs are SHA-256-hashed before storage — no raw IP is persisted.
 */
import { and, eq, gte, lt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import { newRateLimitId } from "@/lib/ids";

/** Hash an IP (or "unknown") so we never store the raw address. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`cred402-ip:${ip}`).digest("hex").slice(0, 32);
}

/** Best-effort extraction of the client IP from proxy headers. */
export function clientIpFrom(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
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
