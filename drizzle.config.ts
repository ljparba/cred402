import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit only needs schema + dialect + out to GENERATE migrations
 * (no live DB connection). Applying them is done by `scripts/migrate.ts`,
 * which picks the PGlite or postgres.js migrator from the same abstraction
 * the app uses. This keeps generation provider-agnostic.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
