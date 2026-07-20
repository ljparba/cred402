/**
 * Apply pending migrations from ./drizzle to the configured database.
 * Picks the PGlite or postgres.js migrator via the same abstraction the app
 * uses, so `npm run db:migrate` works identically for local and production.
 *
 *   npm run db:migrate
 */
import "./lib/env";
import { getDbBundle } from "@/lib/db";

async function main() {
  const bundle = await getDbBundle();
  console.log(`▸ migrating via ${bundle.driver} ...`);
  await bundle.migrate();
  console.log("✓ migrations applied");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ migration failed:", err);
  process.exit(1);
});
