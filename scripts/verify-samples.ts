/**
 * End-to-end verification smoke test: run every downloadable sample file through
 * the REAL pipeline (SHA-256 → PDF credential-ID extraction → verification
 * engine) and assert the verdict matches the catalogue's expected verdict.
 *
 *   npm run verify:samples
 *
 * Exits non-zero on any mismatch, so it works as a CI gate and as Phase-4
 * evidence that the deterministic engine classifies all six credential states
 * correctly against real generated PDFs.
 */
import "./lib/env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256 } from "@/lib/verify/hash";
import { extractCredentialId } from "@/lib/verify/extract";
import { validateUpload } from "@/lib/verify/upload";
import { verify } from "@/lib/verify/engine";
import { samples } from "./data/catalog";

// Fixed clock so expired/valid classification is stable regardless of run date.
const NOW = new Date("2026-07-20T12:00:00Z");

async function main() {
  let failures = 0;
  console.log("file".padEnd(48), "expected".padEnd(20), "actual".padEnd(20), "result");
  console.log("-".repeat(96));

  for (const s of samples) {
    const path = resolve(process.cwd(), "samples", s.filename);
    const bytes = new Uint8Array(readFileSync(path));

    const validation = validateUpload(bytes, s.filename, undefined);
    if (!validation.ok) {
      console.log(s.filename.padEnd(48), s.expectedVerdict.padEnd(20), "INVALID".padEnd(20), "✗ FAIL");
      console.log(`    upload rejected: ${validation.error}`);
      failures++;
      continue;
    }

    const hash = sha256(bytes);
    const claimedCredentialId = await extractCredentialId(bytes, validation.kind);
    const result = await verify({ uploadedHash: hash, claimedCredentialId, now: NOW });

    const ok = result.verdict === s.expectedVerdict;
    if (!ok) failures++;
    console.log(
      s.filename.padEnd(48),
      s.expectedVerdict.padEnd(20),
      result.verdict.padEnd(20),
      ok ? "✓ pass" : "✗ FAIL",
    );
    if (!ok) {
      console.log(`    hash=${hash.slice(0, 16)}… claimedId=${claimedCredentialId ?? "(none)"}`);
      console.log(`    checks: ${result.checks.map((c) => `${c.id}:${c.status}`).join(" ")}`);
    }
  }

  console.log("-".repeat(96));
  if (failures > 0) {
    console.error(`✗ ${failures} sample(s) produced the wrong verdict.`);
    process.exit(1);
  }
  console.log(`✓ all ${samples.length} samples verified with the expected verdict.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ verify-samples failed:", err);
  process.exit(1);
});
