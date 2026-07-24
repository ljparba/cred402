/**
 * Safe database-retention cleanup tests (Phase 3).
 *
 * Fully OFFLINE against an ISOLATED PGlite database with a CONTROLLED clock (a
 * fixed `now` is passed into `planAndRunCleanup`, and fixture rows carry explicit
 * `created_at` timestamps). No live payment, no network, no HCS write. This can
 * only ever run against the isolated dir this file owns — never the owner's main
 * `.pglite` or a production Postgres (DATABASE_URL is deleted below).
 *
 * Proves: dry-run deletes nothing; execution needs BOTH guards; only old,
 * conclusively-UNPAID, settlement-free requests are eligible; PAID / UNKNOWN /
 * IN_PROGRESS requests and all settlement + HCS rows are retained; expired
 * rate-limit rows are pruned while active/within-grace rows survive; child rows
 * are removed FK-safely before their parent; repeat runs are idempotent; and the
 * printed report contains counts only — never a filename, hash, id, or IP hash.
 */
process.env.PGLITE_DATA_DIR ||= "./.pglite-cleanuptest";
delete process.env.DATABASE_URL;

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { getDb, getDbBundle, schema } from "@/lib/db";
import { registerDbTeardown } from "./lib/db-teardown";
import {
  createPaymentRequest,
  createSettlement,
  createVerificationRequest,
  createVerificationResult,
  ensureIssuer,
  getVerificationRequest,
  insertCredentialEvent,
  insertHcsRecord,
} from "@/lib/db/queries";
import {
  executionRequested,
  formatCleanupReport,
  planAndRunCleanup,
} from "@/lib/db/cleanup";
import type { PaymentState, RequestStatus } from "@/lib/db/schema";

// Fixed clock so eligibility is deterministic regardless of the run date.
const NOW = new Date("2026-07-24T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

before(async () => {
  const bundle = await getDbBundle();
  await bundle.migrate();
  assert.equal(bundle.driver, "pglite", "cleanup tests must run on an isolated PGlite DB");
});

beforeEach(async () => {
  const db = await getDb();
  await db.execute(sql`
    truncate table verification_requests, verification_results, payment_requests,
      payment_settlements, rate_limit_hits, hcs_records, credential_events,
      credentials, issuers restart identity cascade
  `);
});

registerDbTeardown();

// ── fixtures ────────────────────────────────────────────────────────────────
interface MakeOpts {
  paymentState?: PaymentState;
  status?: RequestStatus;
  createdAt?: Date;
  filename?: string;
  sha256?: string;
  withResult?: boolean;
  withChallenge?: boolean;
}

async function makeRequest(id: string, opts: MakeOpts = {}): Promise<void> {
  const sha256 = opts.sha256 ?? "a".repeat(64);
  await createVerificationRequest({
    id,
    uploadedFilename: opts.filename ?? null,
    sha256,
    nonce: `tok_${id}`,
    nonceExpiresAt: new Date(NOW.getTime() + 15 * 60_000),
    status: opts.status ?? "AWAITING_PAYMENT",
    paymentState: opts.paymentState ?? "UNPAID",
    createdAt: opts.createdAt ?? NOW,
  });
  if (opts.withResult) {
    await createVerificationResult({
      id: `res_${id}`,
      requestId: id,
      verdict: "TAMPERED",
      checks: [{ id: "c1", label: "Hash", status: "FAIL", evidence: "hash differs" }],
      uploadedHash: sha256,
    });
  }
  if (opts.withChallenge) {
    await createPaymentRequest({
      id: `pr_${id}`,
      requestId: id,
      network: "hedera:testnet",
      asset: "0.0.0",
      amount: "10000000",
      payTo: "0.0.5678",
      nonce: `tok_${id}`,
      expiresAt: new Date(NOW.getTime() + 15 * 60_000),
    });
  }
}

async function insertRateHit(key: string, at: Date): Promise<void> {
  const db = await getDb();
  await db.insert(schema.rateLimitHits).values({ id: `rl_${key}_${at.getTime()}`, key, at });
}

// ── guard ────────────────────────────────────────────────────────────────────

test("execution requires BOTH --execute and CONFIRM_DATABASE_CLEANUP=yes", () => {
  assert.equal(executionRequested([], {}), false);
  assert.equal(executionRequested(["--execute"], {}), false, "flag alone is not enough");
  assert.equal(
    executionRequested([], { CONFIRM_DATABASE_CLEANUP: "yes" }),
    false,
    "confirm alone is not enough",
  );
  assert.equal(executionRequested(["--execute"], { CONFIRM_DATABASE_CLEANUP: "no" }), false);
  assert.equal(executionRequested(["--execute"], { CONFIRM_DATABASE_CLEANUP: "yes" }), true);
});

// ── dry run ──────────────────────────────────────────────────────────────────

test("dry-run reports eligible rows but deletes nothing", async () => {
  await makeRequest("vr_old", { createdAt: daysAgo(45), withResult: true, withChallenge: true });
  await insertRateHit("verify:aaaa", daysAgo(10));

  const report = await planAndRunCleanup({ execute: false, now: NOW });
  assert.equal(report.dryRun, true);
  assert.equal(report.deleted, false);
  assert.equal(report.eligible.unpaidRequests, 1);
  assert.equal(report.eligible.associatedResults, 1);
  assert.equal(report.eligible.associatedChallenges, 1);
  assert.equal(report.eligible.rateLimitRows, 1);

  // Nothing was actually removed.
  assert.ok(await getVerificationRequest("vr_old"), "request survives a dry run");
  const db = await getDb();
  assert.equal((await db.select().from(schema.verificationResults)).length, 1);
  assert.equal((await db.select().from(schema.paymentRequests)).length, 1);
  assert.equal((await db.select().from(schema.rateLimitHits)).length, 1);
});

// ── eligibility: unpaid age ───────────────────────────────────────────────────

test("an old unpaid request is deleted on execute; a recent one is retained", async () => {
  await makeRequest("vr_old", { createdAt: daysAgo(40) });
  await makeRequest("vr_recent", { createdAt: daysAgo(5) });

  const report = await planAndRunCleanup({ execute: true, now: NOW });
  assert.equal(report.eligible.unpaidRequests, 1);
  assert.equal(report.deleted, true);
  assert.equal(await getVerificationRequest("vr_old"), undefined, "old unpaid request removed");
  assert.ok(await getVerificationRequest("vr_recent"), "recent unpaid request retained");
});

// ── retention: protected payment states ───────────────────────────────────────

test("PAID, PAYMENT_UNKNOWN, and PAYMENT_IN_PROGRESS requests are never deleted, even when old", async () => {
  await makeRequest("vr_paid", { createdAt: daysAgo(90), paymentState: "PAID", status: "PAID" });
  await makeRequest("vr_unknown", { createdAt: daysAgo(90), paymentState: "PAYMENT_UNKNOWN" });
  await makeRequest("vr_inprogress", { createdAt: daysAgo(90), paymentState: "PAYMENT_IN_PROGRESS" });

  const report = await planAndRunCleanup({ execute: true, now: NOW });
  assert.equal(report.eligible.unpaidRequests, 0, "no non-UNPAID request is eligible");
  assert.ok(await getVerificationRequest("vr_paid"), "PAID retained");
  assert.ok(await getVerificationRequest("vr_unknown"), "PAYMENT_UNKNOWN retained");
  assert.ok(await getVerificationRequest("vr_inprogress"), "PAYMENT_IN_PROGRESS retained");

  // The old unknown / in-progress rows surface as reconciliation warnings only.
  assert.equal(report.warnings.paymentUnknownOlderThan24h, 1);
  assert.equal(report.warnings.paymentInProgressOlderThan24h, 1);
});

test("a settled payment row and its request are retained (settlement evidence is never touched)", async () => {
  await makeRequest("vr_settled", { createdAt: daysAgo(90), paymentState: "PAID", status: "PAID" });
  await createSettlement({
    id: "st_settled",
    requestId: "vr_settled",
    transactionId: "0.0.9-1700000000-000000001",
    payTo: "0.0.5678",
    amount: "10000000",
    mirrorVerified: true,
    status: "SETTLED",
  });

  await planAndRunCleanup({ execute: true, now: NOW });
  assert.ok(await getVerificationRequest("vr_settled"), "the settled request is retained");
  const db = await getDb();
  assert.equal((await db.select().from(schema.paymentSettlements)).length, 1, "SETTLED row survives");
});

test("an old UNPAID request carrying settlement evidence is excluded from cleanup", async () => {
  await makeRequest("vr_unpaid_evidence", { createdAt: daysAgo(90), paymentState: "UNPAID" });
  await createSettlement({
    id: "st_failed",
    requestId: "vr_unpaid_evidence",
    transactionId: "0.0.9-1700000000-000000009",
    payTo: "0.0.5678",
    amount: "10000000",
    status: "FAILED",
  });

  const report = await planAndRunCleanup({ execute: true, now: NOW });
  assert.equal(report.eligible.unpaidRequests, 0, "a request with any settlement row is excluded");
  assert.ok(await getVerificationRequest("vr_unpaid_evidence"), "the request is retained");
  const db = await getDb();
  assert.equal((await db.select().from(schema.paymentSettlements)).length, 1, "FAILED evidence survives");
});

test("HCS records and credential events are retained by cleanup", async () => {
  await ensureIssuer("ISS-CLEAN", "Cleanup Test Issuer");
  await insertCredentialEvent({
    id: "evt_clean",
    type: "CREDENTIAL_ISSUED",
    credentialId: null,
    issuerId: "ISS-CLEAN",
    sha256: "a".repeat(64),
    payload: { type: "CREDENTIAL_ISSUED" },
  });
  await insertHcsRecord({
    id: "hcs_clean",
    eventId: "evt_clean",
    topicId: "0.0.1234",
    sequenceNumber: 1,
    transactionId: "0.0.1234-1700000000-000000001",
  });

  await planAndRunCleanup({ execute: true, now: NOW });
  const db = await getDb();
  assert.equal((await db.select().from(schema.hcsRecords)).length, 1, "hcs_records untouched");
  assert.equal((await db.select().from(schema.credentialEvents)).length, 1, "credential_events untouched");
});

// ── rate-limit pruning ────────────────────────────────────────────────────────

test("expired rate-limit rows are pruned; active and within-grace rows are retained", async () => {
  await insertRateHit("verify:expired", daysAgo(10)); // window + 2d grace elapsed → prune
  await insertRateHit("verify:grace", daysAgo(1)); // window over but within 2d grace → keep
  await insertRateHit("verify:active", hoursAgo(0.5)); // still inside its window → keep

  const report = await planAndRunCleanup({ execute: true, now: NOW });
  assert.equal(report.eligible.rateLimitRows, 1, "only the fully-expired row is eligible");

  const db = await getDb();
  const remaining = (await db.select().from(schema.rateLimitHits)).map((r) => r.key).sort();
  assert.deepEqual(remaining, ["verify:active", "verify:grace"], "active + within-grace rows survive");
});

// ── FK-safe deletion order ────────────────────────────────────────────────────

test("child rows (results, challenges) are removed with the parent, FK-safe, no orphans", async () => {
  await makeRequest("vr_children", { createdAt: daysAgo(60), withResult: true, withChallenge: true });

  const report = await planAndRunCleanup({ execute: true, now: NOW });
  assert.equal(report.eligible.unpaidRequests, 1);
  assert.equal(report.eligible.associatedResults, 1);
  assert.equal(report.eligible.associatedChallenges, 1);

  const db = await getDb();
  assert.equal((await db.select().from(schema.verificationRequests)).length, 0, "parent removed");
  assert.equal((await db.select().from(schema.verificationResults)).length, 0, "no orphan results");
  assert.equal((await db.select().from(schema.paymentRequests)).length, 0, "no orphan challenges");
});

// ── idempotency ───────────────────────────────────────────────────────────────

test("repeat execution is idempotent — the second run deletes nothing", async () => {
  await makeRequest("vr_idem", { createdAt: daysAgo(60), withResult: true, withChallenge: true });
  await insertRateHit("verify:old", daysAgo(10));

  const first = await planAndRunCleanup({ execute: true, now: NOW });
  assert.equal(first.eligible.unpaidRequests, 1);
  assert.equal(first.eligible.rateLimitRows, 1);

  const second = await planAndRunCleanup({ execute: true, now: NOW });
  assert.equal(second.eligible.unpaidRequests, 0, "nothing left to delete");
  assert.equal(second.eligible.rateLimitRows, 0);
});

// ── output hygiene (O7) ───────────────────────────────────────────────────────

test("the report output contains counts only — never filenames, hashes, ids, or IP hashes", async () => {
  const secretFile = "top-secret-diploma.pdf";
  const secretHash = "deadbeef".repeat(8); // 64 hex chars
  const ipHash = "c".repeat(32);
  await makeRequest("vr_secret", {
    createdAt: daysAgo(60),
    filename: secretFile,
    sha256: secretHash,
    withResult: true,
    withChallenge: true,
  });
  await insertRateHit(`verify:${ipHash}`, daysAgo(10));

  const report = await planAndRunCleanup({ execute: false, now: NOW });
  const text = formatCleanupReport(report);

  assert.ok(!text.includes(secretFile), "no uploaded filename in the report");
  assert.ok(!text.includes(secretHash), "no file hash in the report");
  assert.ok(!text.includes("vr_secret"), "no request id in the report");
  assert.ok(!text.includes(ipHash), "no IP hash / bucket key in the report");

  // It still communicates the counts and the dry-run status.
  assert.match(text, /DRY RUN/);
  assert.match(text, /Unpaid verification requests eligible: 1/);
  assert.match(text, /Expired rate-limit rows eligible: 1/);
  assert.match(text, /No rows deleted\./);
});
