/**
 * Migration safety tests (Phase 2, plan §14).
 *
 * These run against fresh, IN-MEMORY PGlite instances (no data dir), so they
 * can never read, write, or reset the owner's `.pglite`. They prove:
 *   - a fresh migration to head succeeds and creates the Phase-2 objects
 *   - an UPGRADE from a representative pre-Phase-2 database preserves all rows,
 *     backfills payment_state correctly, and then enforces uniqueness
 *   - duplicate SETTLED rows are DETECTED (with an actionable error), never
 *     silently deleted
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const DRIZZLE = resolve(process.cwd(), "drizzle");

/** All migration tags in journal order. */
function migrationFiles(): string[] {
  return readdirSync(DRIZZLE)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** Apply one migration file (statements split on Drizzle's breakpoint marker). */
async function applyMigration(db: PGlite, file: string): Promise<void> {
  const sql = readFileSync(resolve(DRIZZLE, file), "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) {
    const trimmed = stmt.trim();
    if (trimmed) await db.exec(trimmed);
  }
}

async function applyUpTo(db: PGlite, tagPrefix: string): Promise<void> {
  for (const file of migrationFiles()) {
    await applyMigration(db, file);
    if (file.startsWith(tagPrefix)) return;
  }
}

async function applyAll(db: PGlite): Promise<void> {
  for (const file of migrationFiles()) await applyMigration(db, file);
}

/** The head migration filename (last in journal order). */
function headMigration(): string {
  const files = migrationFiles();
  return files[files.length - 1]!;
}

/** Minimal pre-Phase-2 fixture rows across the states the upgrade must handle. */
async function seedPrePhase2(db: PGlite): Promise<void> {
  await db.exec(`
    insert into issuers (id, name) values ('ISS-MIG', 'Migration Test Issuer');
    -- unpaid request
    insert into verification_requests (id, sha256, nonce, nonce_expires_at, status)
      values ('vr_unpaid', repeat('a',64), 'tok1', now() + interval '15 minutes', 'AWAITING_PAYMENT');
    -- expired unpaid request
    insert into verification_requests (id, sha256, nonce, nonce_expires_at, status)
      values ('vr_expired', repeat('b',64), 'tok2', now() - interval '1 minute', 'AWAITING_PAYMENT');
    -- paid request with exactly one settled settlement
    insert into verification_requests (id, sha256, nonce, nonce_expires_at, status)
      values ('vr_paid', repeat('c',64), 'tok3', now() + interval '15 minutes', 'PAID');
    insert into payment_settlements (id, request_id, transaction_id, pay_to, amount, status, mirror_verified)
      values ('st_paid', 'vr_paid', '0.0.1-1700000000-000000001', '0.0.5678', '10000000', 'SETTLED', true);
    -- a failed settlement row (evidence) for another request
    insert into verification_requests (id, sha256, nonce, nonce_expires_at, status)
      values ('vr_failed', repeat('d',64), 'tok4', now() + interval '15 minutes', 'AWAITING_PAYMENT');
    insert into payment_settlements (id, request_id, transaction_id, pay_to, amount, status, mirror_verified)
      values ('st_failed', 'vr_failed', '0.0.1-1700000000-000000002', '0.0.5678', '10000000', 'FAILED', false);
  `);
}

test("fresh migration to head creates the Phase-2 columns + partial unique index", async () => {
  const db = new PGlite();
  try {
    await applyAll(db);

    const cols = await db.query<{ column_name: string; column_default: string | null }>(
      `select column_name, column_default from information_schema.columns
        where table_name = 'verification_requests'
          and column_name in ('payment_state','payment_claimed_at','payment_claim_tx_id')`,
    );
    const names = cols.rows.map((r) => r.column_name).sort();
    assert.deepEqual(names, ["payment_claim_tx_id", "payment_claimed_at", "payment_state"]);
    const stateDefault = cols.rows.find((r) => r.column_name === "payment_state")?.column_default ?? "";
    assert.match(stateDefault, /UNPAID/, "payment_state defaults to UNPAID");

    const idx = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where indexname = 'payment_settlements_settled_request_idx'`,
    );
    assert.equal(idx.rows.length, 1, "the settled-request partial unique index exists");
  } finally {
    await db.close();
  }
});

test("upgrade preserves all pre-Phase-2 rows and backfills payment_state honestly", async () => {
  const db = new PGlite();
  try {
    await applyUpTo(db, "0001");
    await seedPrePhase2(db);
    await applyMigration(db, headMigration()); // apply ONLY 0002 on populated data

    const rows = await db.query<{ id: string; payment_state: string }>(
      `select id, payment_state from verification_requests order by id`,
    );
    const state = Object.fromEntries(rows.rows.map((r) => [r.id, r.payment_state]));
    // No rows lost.
    assert.equal(rows.rows.length, 4, "every pre-Phase-2 request row is preserved");
    // Paid request backfilled to PAID; everything else stays UNPAID.
    assert.equal(state["vr_paid"], "PAID", "a pre-existing paid request is backfilled to PAID");
    assert.equal(state["vr_unpaid"], "UNPAID");
    assert.equal(state["vr_expired"], "UNPAID");
    assert.equal(state["vr_failed"], "UNPAID", "a FAILED-only request is NOT marked PAID");

    // Settlement evidence is preserved.
    const settlements = await db.query(`select id from payment_settlements order by id`);
    assert.equal(settlements.rows.length, 2, "both settlement rows survive the migration");

    // The new constraint is now active: a 2nd settled row for vr_paid is rejected.
    await assert.rejects(
      () =>
        db.exec(
          `insert into payment_settlements (id, request_id, transaction_id, pay_to, amount, status, mirror_verified)
             values ('st_paid_dup', 'vr_paid', '0.0.1-1700000000-000000009', '0.0.5678', '10000000', 'SETTLED', true)`,
        ),
      "a second settled row for vr_paid must now violate the unique index",
    );
  } finally {
    await db.close();
  }
});

test("migration ABORTS (does not delete) when duplicate SETTLED rows already exist", async () => {
  const db = new PGlite();
  try {
    await applyUpTo(db, "0001");
    await seedPrePhase2(db);
    // Inject a pre-existing DUPLICATE settled row for vr_paid (the exact case the
    // guard must catch — two genuine settlements should never be silently lost).
    await db.exec(
      `insert into payment_settlements (id, request_id, transaction_id, pay_to, amount, status, mirror_verified)
         values ('st_paid_conflict', 'vr_paid', '0.0.1-1700000000-000000003', '0.0.5678', '10000000', 'SETTLED', true)`,
    );

    await assert.rejects(
      () => applyMigration(db, "0002_phase2_payment_lock.sql"),
      (err: Error) => /aborted/i.test(err.message) && /reconcile/i.test(err.message),
      "the migration must abort with an actionable message, not delete evidence",
    );

    // Both conflicting rows are still present — nothing was deleted.
    const remaining = await db.query(
      `select id from payment_settlements where request_id = 'vr_paid' and status = 'SETTLED'`,
    );
    assert.equal(remaining.rows.length, 2, "conflicting settlement rows are preserved, not deleted");
  } finally {
    await db.close();
  }
});
