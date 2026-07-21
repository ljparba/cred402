/**
 * Verification-engine tests (plan §16 "Credential states"): every downloadable
 * sample, run through the real pipeline (validate → SHA-256 → PDF ID extract →
 * engine), must resolve to its catalogue verdict — covering VALID, TAMPERED,
 * EXPIRED, REVOKED, UNREGISTERED_ISSUER, and UNKNOWN.
 *
 * Runs against an ISOLATED PGlite DB so it never touches the app's dev database:
 *   PGLITE_DATA_DIR=./.pglite-test node --import tsx --test tests/engine.test.ts
 */
// MUST be first: isolate the PGlite dir before `scripts/seed` → `scripts/lib/env`
// loads `.env` (which would otherwise pin this suite to the dev DB `./.pglite`).
import "./lib/isolate-db";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDbBundle } from "@/lib/db";
import { registerDbTeardown } from "./lib/db-teardown";
import { seed } from "../scripts/seed";
import { sha256 } from "@/lib/verify/hash";
import { extractCredentialId } from "@/lib/verify/extract";
import { validateUpload } from "@/lib/verify/upload";
import { verify } from "@/lib/verify/engine";
import { samples } from "../scripts/data/catalog";

// The isolated PGlite dir is set by the first import (`./lib/isolate-db`), which
// runs before `.env` can pin this suite to the dev DB. See that module for why
// the assignment can't live in this file's body.

// Fixed clock so expired/valid classification is deterministic.
const NOW = new Date("2026-07-20T12:00:00Z");

before(async () => {
  const bundle = await getDbBundle();
  await bundle.migrate();
  await seed();
});

// Dispose the PGlite handle after the file so the test process exits naturally.
registerDbTeardown();

for (const s of samples) {
  test(`${s.slug} → ${s.expectedVerdict}`, async () => {
    const bytes = new Uint8Array(readFileSync(resolve(process.cwd(), "samples", s.filename)));
    const validation = validateUpload(bytes, s.filename);
    assert.ok(validation.ok, `upload rejected: ${validation.error}`);

    const hash = sha256(bytes);
    const claimedCredentialId = await extractCredentialId(bytes, validation.kind);
    const result = await verify({ uploadedHash: hash, claimedCredentialId, now: NOW });

    assert.equal(result.verdict, s.expectedVerdict);

    // Flagship tamper invariant: identified credential, HCS evidence, hash mismatch.
    if (s.expectedVerdict === "TAMPERED") {
      assert.equal(result.hashMatches, false);
      assert.equal(result.credentialId, s.credentialId);
    }
    if (s.expectedVerdict === "VALID") {
      assert.equal(result.hashMatches, true);
    }
  });
}
