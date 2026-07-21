/**
 * Shared teardown for DB-backed test files.
 *
 * PGlite (the embedded WASM Postgres used by the isolated test databases) keeps
 * an open handle for as long as the instance is alive, which keeps Node's event
 * loop — and therefore the `node --test` process — from exiting after the last
 * assertion. `getDbBundle()` memoises a single instance on `globalThis`, so the
 * connection is never closed unless we do it explicitly.
 *
 * `registerDbTeardown()` installs a file-level `after()` hook that disposes that
 * cached instance via {@link closeDb}. Node runs `after()` hooks even when a test
 * (or the `before()` setup) fails, and `closeDb()` clears the singleton in a
 * `finally`, so the handle is always released and each DB-backed file exits
 * naturally — no forced `process.exit`.
 */
import { after } from "node:test";
import { closeDb } from "@/lib/db";

export function registerDbTeardown(): void {
  after(async () => {
    await closeDb();
  });
}
