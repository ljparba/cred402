/**
 * Public-endpoint rate-limit tests (Phase 2, plan §6).
 *
 * Fully OFFLINE against an isolated PGlite DB. No live payment, no network — the
 * limiter is pure DB bookkeeping. Proves: below-limit passes, the next request
 * is 429 with Retry-After, separate IP hashes get separate buckets, /verify and
 * /pay use SEPARATE buckets, expired rows stop blocking, and — critically — the
 * raw IP is NEVER stored (only a hash), and no limiter internal leaks in a 429.
 */
process.env.PGLITE_DATA_DIR ||= "./.pglite-ratetest";
delete process.env.DATABASE_URL;

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { getDb, getDbBundle } from "@/lib/db";
import { registerDbTeardown } from "./lib/db-teardown";
import {
  bucketKey,
  checkAndRecord,
  enforceRateLimit,
  hashIp,
} from "@/lib/security/rate-limit";

const RAW_IP = "203.0.113.77";
const headersFor = (ip: string) => new Headers({ "x-forwarded-for": ip });

before(async () => {
  const bundle = await getDbBundle();
  await bundle.migrate();
});

beforeEach(async () => {
  const db = await getDb();
  await db.execute(sql`truncate table rate_limit_hits restart identity`);
});

registerDbTeardown();

test("requests below the limit succeed; the next one is blocked", async () => {
  const key = "verify:test-below";
  const a = await checkAndRecord(key, 2, 3600);
  const b = await checkAndRecord(key, 2, 3600);
  const c = await checkAndRecord(key, 2, 3600);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(c.ok, false);
  assert.ok((c.retryAfterSeconds ?? 0) > 0, "a blocked result carries a retry-after");
});

test("enforceRateLimit returns a 429 with Retry-After and no internals", async () => {
  const headers = headersFor(RAW_IP);
  // Fill the bucket (limit 1).
  const first = await enforceRateLimit(headers, "verify", 1, 3600);
  assert.equal(first, null, "the first request is allowed");
  const blocked = await enforceRateLimit(headers, "verify", 1, 3600);
  assert.ok(blocked, "the second request is blocked");
  assert.equal(blocked!.status, 429);
  const retryAfter = blocked!.headers.get("retry-after");
  assert.ok(retryAfter && Number(retryAfter) > 0, "Retry-After header is present and positive");

  const body = (await blocked!.json()) as { code?: string; error?: string };
  assert.equal(body.code, "RATE_LIMITED");
  // The response must NOT reveal the stored IP hash, the raw IP, or the bucket.
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes(hashIp(RAW_IP)), "429 must not leak the IP hash");
  assert.ok(!serialized.includes(RAW_IP), "429 must not leak the raw IP");
  assert.ok(!/verify:/.test(serialized), "429 must not leak the bucket key");
});

test("separate IP hashes get separate buckets", async () => {
  const a = bucketKey("verify", headersFor("198.51.100.1"));
  const b = bucketKey("verify", headersFor("198.51.100.2"));
  assert.notEqual(a, b);
  // Filling one does not block the other.
  await checkAndRecord(a, 1, 3600);
  const other = await checkAndRecord(b, 1, 3600);
  assert.equal(other.ok, true, "a different IP has its own quota");
});

test("/api/verify and /api/pay use separate buckets for the same IP", async () => {
  const headers = headersFor(RAW_IP);
  const verifyKey = bucketKey("verify", headers);
  const payKey = bucketKey("pay", headers);
  assert.notEqual(verifyKey, payKey, "verify and pay buckets are namespaced apart");
  // Exhaust the verify bucket…
  await checkAndRecord(verifyKey, 1, 3600);
  const verifyBlocked = await checkAndRecord(verifyKey, 1, 3600);
  assert.equal(verifyBlocked.ok, false);
  // …the pay bucket for the same IP is unaffected.
  const payAllowed = await checkAndRecord(payKey, 1, 3600);
  assert.equal(payAllowed.ok, true);
});

test("the raw IP is never stored — only its hash appears in bucket keys", async () => {
  await enforceRateLimit(headersFor(RAW_IP), "verify", 5, 3600);
  const db = await getDb();
  const rows = await db.select().from((await import("@/lib/db")).schema.rateLimitHits);
  assert.ok(rows.length >= 1, "a hit row was recorded");
  for (const row of rows) {
    assert.ok(!row.key.includes(RAW_IP), "the stored key must not contain the raw IP");
    assert.ok(row.key.includes(hashIp(RAW_IP)), "the stored key is the hashed IP");
  }
});

test("expired rate-limit rows no longer block new requests", async () => {
  const key = "verify:test-expiry";
  // Record a hit, then age it past a 1-second window.
  await checkAndRecord(key, 1, 3600);
  const db = await getDb();
  await db.execute(
    sql`update rate_limit_hits set at = ${new Date(Date.now() - 10_000)} where key = ${key}`,
  );
  // With a 1s window, the aged hit is outside it → the request is allowed again.
  const afterExpiry = await checkAndRecord(key, 1, 1);
  assert.equal(afterExpiry.ok, true, "a hit older than the window does not block");
});
