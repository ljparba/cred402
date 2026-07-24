/**
 * Create Tamper Demo tests (plan §8.3 / §15), fully OFFLINE — never touches live
 * Hedera. Runs against its OWN isolated PGlite DB (separate from the engine
 * test's, so the two DB-backed files can run in parallel without a lock clash).
 *
 * Covers: synthetic registration, forced demo issuer, the original→VALID /
 * modified+id→TAMPERED / modified-without-id→UNKNOWN / unknown-id→UNKNOWN
 * matrix, label sanitisation, and the DB-backed rate limiter.
 */
// Isolate DB + force UNCONFIGURED (offline) before any config read.
process.env.PGLITE_DATA_DIR ||= "./.pglite-demotest";
delete process.env.HEDERA_OPERATOR_ID;
delete process.env.HEDERA_OPERATOR_PRIVATE_KEY;
delete process.env.HEDERA_HCS_TOPIC_ID;

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { getDbBundle } from "@/lib/db";
import { registerDbTeardown } from "./lib/db-teardown";
import { registerDemoOriginal, sanitizeLabel, DEMO_ISSUER_ID } from "@/lib/demo/register";
import { checkAndRecord } from "@/lib/security/rate-limit";
import { verify } from "@/lib/verify/engine";
import { sha256 } from "@/lib/verify/hash";

const original = new TextEncoder().encode("%PDF-1.4 original demo certificate body");
const modified = new TextEncoder().encode("%PDF-1.4 MODIFIED demo certificate body!!");

before(async () => {
  const bundle = await getDbBundle();
  await bundle.migrate();
});

// Dispose the PGlite handle after the file so the test process exits naturally.
registerDbTeardown();

test("registration is synthetic, offline-safe, and drives the full verdict matrix", async () => {
  const reg = await registerDemoOriginal(original, "My Diploma");
  assert.match(reg.demoCredentialId, /^CRED-DEMO-[A-F0-9]{12}$/);
  assert.equal(reg.issuerId, DEMO_ISSUER_ID);
  assert.equal(reg.anchored, false); // no keys → local fixture, no HCS write
  assert.equal(reg.hcs, null);
  assert.equal(reg.sha256, sha256(original));

  // Original file + demo id → VALID
  const valid = await verify({
    uploadedHash: sha256(original),
    claimedCredentialId: reg.demoCredentialId,
  });
  assert.equal(valid.verdict, "VALID");
  assert.equal(valid.hashMatches, true);

  // Modified file + demo id → TAMPERED (identified, HCS evidence, hash differs)
  const tampered = await verify({
    uploadedHash: sha256(modified),
    claimedCredentialId: reg.demoCredentialId,
  });
  assert.equal(tampered.verdict, "TAMPERED");
  assert.equal(tampered.hashMatches, false);

  // Modified file WITHOUT the id → UNKNOWN (can't be linked by hash alone)
  const noId = await verify({ uploadedHash: sha256(modified) });
  assert.equal(noId.verdict, "UNKNOWN");
});

test("an unknown demo id resolves to UNKNOWN", async () => {
  const r = await verify({
    uploadedHash: sha256(modified),
    claimedCredentialId: "CRED-DEMO-DEADBEEF0000",
  });
  assert.equal(r.verdict, "UNKNOWN");
});

test("issuer is forced server-side; a caller cannot inject a trusted issuer", async () => {
  const reg = await registerDemoOriginal(original, "<script>Trusted University</script>");
  assert.equal(reg.issuerId, DEMO_ISSUER_ID);
  assert.equal(reg.issuerName, "Cred402 Demo Institute");
  assert.ok(!reg.label.includes("<") && !reg.label.includes(">"));
});

test("sanitizeLabel strips unsafe characters and caps length", () => {
  assert.ok(!sanitizeLabel("a<script>b").includes("<"));
  assert.equal(sanitizeLabel(""), "Custom demo credential");
  assert.equal(sanitizeLabel(null), "Custom demo credential");
  assert.ok(sanitizeLabel("x".repeat(200)).length <= 60);
});

test("the DB-backed rate limiter enforces the max within the window", async () => {
  const key = `test_bucket:${Math.random().toString(36).slice(2)}${Date.now()}`;
  const a = await checkAndRecord(key, 2, 3600);
  const b = await checkAndRecord(key, 2, 3600);
  const c = await checkAndRecord(key, 2, 3600);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(c.ok, false);
  assert.ok((c.retryAfterSeconds ?? 0) > 0);
});
