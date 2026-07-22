/**
 * Force DB-backed tests onto an ISOLATED PGlite directory — and do it before any
 * other module can pin the data dir.
 *
 * Why a separate, first-imported module: ES module `import`s are hoisted and
 * evaluate before the importing file's own body. `tests/engine.test.ts` imports
 * `scripts/seed`, which does `import "./lib/env"` to load the project's `.env`.
 * That loader sets `PGLITE_DATA_DIR=./.pglite` (the DEV database) whenever the
 * key isn't already present. So a plain `process.env.PGLITE_DATA_DIR ||= …` in
 * the test body runs TOO LATE — `.env` has already won, and the suite quietly
 * runs against the dev DB (colliding with a running `next dev`, which holds that
 * single-writer PGlite dir open, and aborting the WASM engine).
 *
 * Importing this module FIRST sets the isolated dir before `.env` is read, so the
 * loader's "existing values win" rule keeps our value. An explicit
 * `PGLITE_DATA_DIR` from the shell (e.g. CI) still overrides, and a real
 * `DATABASE_URL` is untouched.
 */
process.env.PGLITE_DATA_DIR ||= "./.pglite-test";
