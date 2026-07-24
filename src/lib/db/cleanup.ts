/**
 * Safe database-retention cleanup for Cred402 (Phase 3, owner-run only).
 *
 * This module NEVER runs automatically. It is invoked deliberately through
 * `scripts/db-cleanup.ts` (`npm run db:cleanup`) and is DRY-RUN BY DEFAULT — it
 * only deletes when the caller explicitly passes `execute: true`, which the
 * script gates behind BOTH `--execute` and `CONFIRM_DATABASE_CLEANUP=yes`.
 *
 * Operational safety invariants (do not weaken):
 *  O1  Settled payment evidence is never deleted — a request carrying ANY
 *      settlement row (SETTLED or FAILED) is excluded from cleanup entirely, so
 *      no `payment_settlements` row is ever touched here.
 *  O2  PAID / PAYMENT_UNKNOWN requests are never deleted.
 *  O3  PAYMENT_IN_PROGRESS requests are never deleted (needs reconciliation).
 *  O4  Only clearly-safe, conclusively-UNPAID, expired/abandoned rows are removed.
 *  O7  Output is counts and categories only — never filenames, hashes, IP hashes,
 *      signatures, ids, or any private row content (see {@link formatCleanupReport}).
 *
 * `payment_state` (not the descriptive `status` label) is the authoritative
 * signal for what is safe to remove. All queries use portable Drizzle builders
 * so they behave identically on PGlite (local) and PostgreSQL (Render/Neon).
 */
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { getDb, schema } from "./index";
import { serverConfig } from "@/lib/config";

const DAY_MS = 86_400_000;
/** Old rows in these payment states are surfaced as reconciliation warnings only. */
const RECONCILE_WARN_HOURS = 24;

export interface CleanupOptions {
  /** When true, actually delete. Default (false) is a read-only dry run. */
  execute?: boolean;
  /** Override the unpaid-request retention window (days). Defaults to config. */
  unpaidRetentionDays?: number;
  /** Override the rate-limit grace window (days after the bucket window). Defaults to config. */
  rateLimitRetentionDays?: number;
  /** Injectable clock for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}

export interface CleanupReport {
  /** True when no rows were changed (the default). */
  dryRun: boolean;
  unpaidRetentionDays: number;
  rateLimitRetentionDays: number;
  /** Counts of rows eligible for removal (equal to what was removed on execute). */
  eligible: {
    unpaidRequests: number;
    associatedResults: number;
    associatedChallenges: number;
    rateLimitRows: number;
  };
  /** True once a real deletion has run. */
  deleted: boolean;
  /** Old rows that require MANUAL reconciliation — reported, never deleted. */
  warnings: {
    paymentUnknownOlderThan24h: number;
    paymentInProgressOlderThan24h: number;
  };
}

/**
 * Production deletion requires BOTH the `--execute` flag AND an explicit
 * `CONFIRM_DATABASE_CLEANUP=yes` in the environment. Either one alone → dry run.
 * Pure and side-effect-free so the guard can be unit-tested without a database.
 */
export function executionRequested(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): boolean {
  return argv.includes("--execute") && env.CONFIRM_DATABASE_CLEANUP === "yes";
}

/** Count rows matching `where` with a portable `count(*)` (PGlite + Postgres). */
async function countWhere(table: PgTable, where: SQL): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
  return rows[0]?.n ?? 0;
}

/**
 * Plan (and, when `execute`, perform) a conservative retention cleanup.
 *
 * Eligible for deletion:
 *  - verification_requests where payment_state = 'UNPAID', created before the
 *    unpaid-retention cutoff, AND carrying no settlement evidence of any kind;
 *  - their child verification_results and payment_requests (the advertised 402
 *    challenge) — deleted first, in FK-safe order;
 *  - rate_limit_hits whose window is fully inactive plus the grace period.
 *
 * Never touched: settled/paid/unknown/in-progress requests, all settlement rows,
 * HCS records, credential/issuer data.
 */
export async function planAndRunCleanup(opts: CleanupOptions = {}): Promise<CleanupReport> {
  const db = await getDb();
  const now = opts.now ?? new Date();
  const execute = opts.execute === true;
  const unpaidRetentionDays = opts.unpaidRetentionDays ?? serverConfig.unpaidRequestRetentionDays;
  const rateLimitRetentionDays = opts.rateLimitRetentionDays ?? serverConfig.rateLimitRetentionDays;

  // ── cutoffs ──────────────────────────────────────────────────────────────
  const unpaidCutoff = new Date(now.getTime() - unpaidRetentionDays * DAY_MS);

  // A rate-limit row is prunable only once its bucket window is fully inactive
  // AND the grace period has elapsed. Use the WIDEST configured window so a row
  // is never removed while it could still be part of an active bucket.
  const maxWindowSeconds = Math.max(
    serverConfig.verifyRateLimitWindowSeconds,
    serverConfig.payRateLimitWindowSeconds,
    serverConfig.tamperDemoRateLimitWindowSeconds,
  );
  const rateLimitCutoff = new Date(
    now.getTime() - maxWindowSeconds * 1000 - rateLimitRetentionDays * DAY_MS,
  );
  const reconcileCutoff = new Date(now.getTime() - RECONCILE_WARN_HOURS * 3600 * 1000);

  // ── eligible unpaid, abandoned requests ──────────────────────────────────
  const unpaidCandidates = await db
    .select({ id: schema.verificationRequests.id })
    .from(schema.verificationRequests)
    .where(
      and(
        eq(schema.verificationRequests.paymentState, "UNPAID"),
        lt(schema.verificationRequests.createdAt, unpaidCutoff),
      ),
    );

  // Exclude any request that carries payment evidence of ANY kind (SETTLED or
  // FAILED). O1: automatic cleanup never touches a settlement row, so a request
  // that has one is left entirely alone.
  const settlementRows = await db
    .select({ requestId: schema.paymentSettlements.requestId })
    .from(schema.paymentSettlements);
  const requestsWithSettlement = new Set(settlementRows.map((r) => r.requestId));
  const eligibleIds = unpaidCandidates
    .map((r) => r.id)
    .filter((id) => !requestsWithSettlement.has(id));

  const associatedResults = eligibleIds.length
    ? await countWhere(
        schema.verificationResults,
        inArray(schema.verificationResults.requestId, eligibleIds),
      )
    : 0;
  const associatedChallenges = eligibleIds.length
    ? await countWhere(
        schema.paymentRequests,
        inArray(schema.paymentRequests.requestId, eligibleIds),
      )
    : 0;

  const rateLimitRows = await countWhere(
    schema.rateLimitHits,
    lt(schema.rateLimitHits.at, rateLimitCutoff),
  );

  // ── operational warnings (reported, NEVER deleted) ───────────────────────
  const paymentUnknownOld = await countWhere(
    schema.verificationRequests,
    and(
      eq(schema.verificationRequests.paymentState, "PAYMENT_UNKNOWN"),
      lt(schema.verificationRequests.createdAt, reconcileCutoff),
    ) as SQL,
  );
  const paymentInProgressOld = await countWhere(
    schema.verificationRequests,
    and(
      eq(schema.verificationRequests.paymentState, "PAYMENT_IN_PROGRESS"),
      lt(schema.verificationRequests.createdAt, reconcileCutoff),
    ) as SQL,
  );

  // ── deletion (execute only) ──────────────────────────────────────────────
  // Each group is transactional. Children (results, challenges) are removed
  // before their parent request so no foreign key is ever violated or orphaned.
  if (execute) {
    await db.transaction(async (tx) => {
      if (eligibleIds.length) {
        await tx
          .delete(schema.verificationResults)
          .where(inArray(schema.verificationResults.requestId, eligibleIds));
        await tx
          .delete(schema.paymentRequests)
          .where(inArray(schema.paymentRequests.requestId, eligibleIds));
        await tx
          .delete(schema.verificationRequests)
          .where(inArray(schema.verificationRequests.id, eligibleIds));
      }
      await tx.delete(schema.rateLimitHits).where(lt(schema.rateLimitHits.at, rateLimitCutoff));
    });
  }

  return {
    dryRun: !execute,
    unpaidRetentionDays,
    rateLimitRetentionDays,
    eligible: {
      unpaidRequests: eligibleIds.length,
      associatedResults,
      associatedChallenges,
      rateLimitRows,
    },
    deleted: execute,
    warnings: {
      paymentUnknownOlderThan24h: paymentUnknownOld,
      paymentInProgressOlderThan24h: paymentInProgressOld,
    },
  };
}

/**
 * Render a {@link CleanupReport} as human-readable lines. COUNTS AND CATEGORIES
 * ONLY (O7): this deliberately never includes an id, filename, hash, IP hash,
 * signature, or any other private row content — only aggregate numbers.
 */
export function formatCleanupReport(report: CleanupReport): string {
  const lines: string[] = [];
  lines.push(report.dryRun ? "DRY RUN" : "EXECUTED");
  lines.push(
    `Policy: unpaid requests > ${report.unpaidRetentionDays}d · ` +
      `rate-limit rows > window + ${report.rateLimitRetentionDays}d grace`,
  );
  lines.push(`Unpaid verification requests eligible: ${report.eligible.unpaidRequests}`);
  lines.push(`Associated results eligible: ${report.eligible.associatedResults}`);
  lines.push(`Associated payment challenges eligible: ${report.eligible.associatedChallenges}`);
  lines.push(`Expired rate-limit rows eligible: ${report.eligible.rateLimitRows}`);
  lines.push(
    report.dryRun
      ? "No rows deleted."
      : "Rows deleted (unpaid-request group + expired rate-limit rows).",
  );
  if (report.warnings.paymentUnknownOlderThan24h > 0) {
    lines.push(
      `Warning: ${report.warnings.paymentUnknownOlderThan24h} PAYMENT_UNKNOWN requests ` +
        `older than 24 hours require reconciliation.`,
    );
  }
  if (report.warnings.paymentInProgressOlderThan24h > 0) {
    lines.push(
      `Warning: ${report.warnings.paymentInProgressOlderThan24h} PAYMENT_IN_PROGRESS requests ` +
        `older than 24 hours require reconciliation.`,
    );
  }
  return lines.join("\n");
}
