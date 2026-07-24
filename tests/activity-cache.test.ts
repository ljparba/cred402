/**
 * Short public-cache header test for GET /api/activity (Phase 3).
 *
 * Fully OFFLINE against an ISOLATED PGlite DB — no network, no payment, no HCS
 * write. Proves the PUBLIC aggregate/feed route advertises a short SHARED-cache
 * policy (so a CDN can absorb the homepage poll) and never the `private,
 * no-store` policy used by the user-specific report/payment routes.
 */
process.env.PGLITE_DATA_DIR ||= "./.pglite-activitycache-test";
delete process.env.DATABASE_URL;

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDbBundle } from "@/lib/db";
import { registerDbTeardown } from "./lib/db-teardown";
import { GET as activityGET } from "@/app/api/activity/route";
import { PUBLIC_SHORT_CACHE } from "@/lib/http";

before(async () => {
  const bundle = await getDbBundle();
  await bundle.migrate();
  assert.equal(bundle.driver, "pglite", "this suite only runs against an isolated PGlite DB");
});

registerDbTeardown();

test("GET /api/activity advertises a short public shared-cache policy", async () => {
  const res = await activityGET();
  assert.equal(res.status, 200);
  const cc = res.headers.get("cache-control");
  assert.equal(cc, PUBLIC_SHORT_CACHE);
  assert.match(cc!, /^public/, "must be publicly cacheable");
  assert.match(cc!, /s-maxage=\d+/, "must set a shared-cache lifetime");
  assert.match(cc!, /stale-while-revalidate=\d+/, "must allow background revalidation");
});

test("the activity cache is public — never the private, no-store report policy", async () => {
  const res = await activityGET();
  const cc = res.headers.get("cache-control") ?? "";
  assert.ok(!/no-store/.test(cc), "public activity must not be no-store");
  assert.ok(!/private/.test(cc), "public activity must not be private");
});

test("the constant itself matches the agreed short public policy", () => {
  assert.equal(PUBLIC_SHORT_CACHE, "public, max-age=0, s-maxage=15, stale-while-revalidate=30");
});

test("private report/payment routes still use safePrivateHandler (unchanged)", () => {
  const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
  for (const r of [
    "src/app/api/report/[requestId]/route.ts",
    "src/app/api/pay/route.ts",
    "src/app/api/verify/route.ts",
  ]) {
    assert.match(read(r), /safePrivateHandler/, `${r} must remain private (no-store)`);
    assert.ok(!read(r).includes("PUBLIC_SHORT_CACHE"), `${r} must not use the public cache`);
  }
});
