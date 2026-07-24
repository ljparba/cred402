/**
 * Owner-run database-retention cleanup. DRY-RUN BY DEFAULT.
 *
 *   npm run db:cleanup
 *       → prints a dry-run report (eligible counts + reconciliation warnings),
 *         changes nothing.
 *
 *   CONFIRM_DATABASE_CLEANUP=yes npm run db:cleanup -- --execute
 *       → actually deletes the eligible rows.
 *
 * Deletion requires BOTH `--execute` AND `CONFIRM_DATABASE_CLEANUP=yes`; with
 * only one present it prints a dry-run report and makes no changes. It removes
 * only clearly-safe, conclusively-UNPAID, expired/abandoned verification data
 * and expired rate-limit rows, and NEVER touches settled / paid / unknown /
 * in-progress payment records, settlement rows, or HCS records. Output is counts
 * and categories only — no filenames, hashes, IP hashes, or private row content.
 *
 * This command is NOT scheduled by the repository. A hosting scheduler MAY invoke
 * it after review. It runs against whatever `DATABASE_URL` / `PGLITE_DATA_DIR`
 * the environment points at — target production only deliberately.
 */
import "./lib/env";
import { closeDb } from "@/lib/db";
import { executionRequested, formatCleanupReport, planAndRunCleanup } from "@/lib/db/cleanup";

async function main() {
  const argv = process.argv.slice(2);
  const wantsExecute = argv.includes("--execute");
  const execute = executionRequested(argv, process.env);

  if (wantsExecute && !execute) {
    console.warn(
      "⚠ --execute ignored: also set CONFIRM_DATABASE_CLEANUP=yes to delete. Running dry-run.",
    );
  }

  const report = await planAndRunCleanup({ execute });
  console.log(formatCleanupReport(report));
  await closeDb();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("✗ db:cleanup failed:", err);
  await closeDb().catch(() => {});
  process.exit(1);
});
