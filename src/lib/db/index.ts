/**
 * Database connection — single `DATABASE_URL` abstraction, zero provider lock-in.
 *
 *  - DATABASE_URL set  → postgres.js driver (Neon dev / Render prod).
 *  - DATABASE_URL unset → embedded PGlite (WASM Postgres) at PGLITE_DATA_DIR.
 *
 * Same Drizzle schema + migrations drive both. Switching providers is one env
 * var + `npm run db:migrate`. Cached on globalThis so Next.js hot-reload and
 * serverless warm invocations reuse one connection.
 *
 * Server-only in practice: the pg/pglite drivers never bundle client-side, and
 * `serverConfig` throws if its secrets are read in the browser. We deliberately
 * avoid the `server-only` package here so the same module is reusable from CLI
 * scripts (seed/migrate) run under `tsx` outside the Next.js bundler.
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { serverConfig } from "@/lib/config";

/** Canonical DB type. PGlite is the same PG dialect, so we present one type. */
export type DB = PostgresJsDatabase<typeof schema>;

export type DbDriver = "pglite" | "postgres-js";

interface DbBundle {
  db: DB;
  driver: DbDriver;
  /** Raw underlying handle, for the migrator and graceful shutdown. */
  raw: unknown;
  /** Applies pending migrations from ./drizzle using the matching migrator. */
  migrate: () => Promise<void>;
}

const globalForDb = globalThis as unknown as { __cred402Db?: DbBundle };

async function createBundle(): Promise<DbBundle> {
  if (serverConfig.usePglite) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(serverConfig.pgliteDataDir);
    const db = drizzle(client, { schema }) as unknown as DB;
    return {
      db,
      driver: "pglite",
      raw: client,
      migrate: () => migrate(db as never, { migrationsFolder: "./drizzle" }),
    };
  }

  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const client = postgres(serverConfig.databaseUrl as string, { max: 10, prepare: false });
  const db = drizzle(client, { schema });
  return {
    db,
    driver: "postgres-js",
    raw: client,
    migrate: () => migrate(db, { migrationsFolder: "./drizzle" }),
  };
}

/** Lazily initialise (and memoise) the DB bundle. */
export async function getDbBundle(): Promise<DbBundle> {
  if (!globalForDb.__cred402Db) {
    globalForDb.__cred402Db = await createBundle();
  }
  return globalForDb.__cred402Db;
}

/** Convenience: the Drizzle instance. */
export async function getDb(): Promise<DB> {
  return (await getDbBundle()).db;
}

export { schema };
