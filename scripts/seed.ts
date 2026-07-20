/**
 * Idempotent database seed. Safe to run repeatedly — every row is an upsert
 * keyed on its primary key, so re-running converges to the same state.
 *
 *   npm run db:seed
 *
 * Seeds: issuers, credentials, credential_events (the local mirror of the HCS
 * envelopes), and demo_samples. It does NOT write hcs_records — those hold real
 * on-chain proof coordinates and are filled by scripts/anchor-credentials.ts
 * (Phase 2) after events are submitted to Hedera.
 *
 * SHA-256 hashes come from scripts/data/hashes.generated.json when present
 * (produced by generate-certificates.ts). Until the PDFs exist, a clearly
 * marked deterministic placeholder is used so the flow is runnable end-to-end.
 */
import "./lib/env";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { getDb, schema } from "@/lib/db";
import { credentials, issuers, samples } from "./data/catalog";
import type { CredentialStatus, EventType } from "@/lib/db/schema";

interface HashManifest {
  credentials?: Record<string, string>; // credentialId -> sha256 of its PDF
  samples?: Record<string, string>; // sample slug -> sha256 of its file
}

function loadHashes(): HashManifest {
  const path = resolve(process.cwd(), "scripts/data/hashes.generated.json");
  if (!existsSync(path)) {
    console.warn(
      "⚠ scripts/data/hashes.generated.json not found — using placeholder hashes.\n" +
        "  Run `npm run certs:generate` (Phase 3) then re-seed for real anchored hashes.",
    );
    return {};
  }
  return JSON.parse(readFileSync(path, "utf8")) as HashManifest;
}

/** Deterministic, clearly-labelled placeholder so seeds are runnable pre-PDFs. */
function placeholderHash(key: string): string {
  return createHash("sha256").update(`PLACEHOLDER:${key}`).digest("hex");
}

export async function seed() {
  const db = await getDb();
  const hashes = loadHashes();

  // ── issuers ────────────────────────────────────────────────────────────────
  for (const iss of issuers) {
    await db
      .insert(schema.issuers)
      .values({ id: iss.id, name: iss.name, registered: iss.registered })
      .onConflictDoUpdate({
        target: schema.issuers.id,
        set: { name: iss.name, registered: iss.registered },
      });
  }
  console.log(`✓ issuers: ${issuers.length}`);

  // ── credentials ─────────────────────────────────────────────────────────────
  for (const c of credentials) {
    const sha256 = hashes.credentials?.[c.id] ?? placeholderHash(c.id);
    const row = {
      id: c.id,
      issuerId: c.issuerId,
      studentName: c.studentName,
      courseName: c.courseName,
      grade: c.grade,
      issuedAt: new Date(c.issuedAt),
      expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
      status: c.status as CredentialStatus,
      sha256,
      revokedAt: c.revokedAt ? new Date(c.revokedAt) : null,
    };
    await db
      .insert(schema.credentials)
      .values(row)
      .onConflictDoUpdate({
        target: schema.credentials.id,
        set: {
          issuerId: row.issuerId,
          studentName: row.studentName,
          courseName: row.courseName,
          grade: row.grade,
          issuedAt: row.issuedAt,
          expiresAt: row.expiresAt,
          status: row.status,
          sha256: row.sha256,
          revokedAt: row.revokedAt,
        },
      });
  }
  console.log(`✓ credentials: ${credentials.length}`);

  // ── credential_events (local mirror of HCS envelopes) ───────────────────────
  let eventCount = 0;
  async function upsertEvent(row: {
    id: string;
    type: EventType;
    credentialId: string | null;
    issuerId: string;
    sha256: string | null;
    status: string | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
    prevEventId: string | null;
    payload: unknown;
  }) {
    await db
      .insert(schema.credentialEvents)
      .values(row)
      .onConflictDoUpdate({
        target: schema.credentialEvents.id,
        set: {
          type: row.type,
          credentialId: row.credentialId,
          issuerId: row.issuerId,
          sha256: row.sha256,
          status: row.status,
          issuedAt: row.issuedAt,
          expiresAt: row.expiresAt,
          prevEventId: row.prevEventId,
          payload: row.payload,
        },
      });
    eventCount++;
  }

  for (const iss of issuers.filter((i) => i.registered)) {
    const eventId = `evt_${iss.id}_REGISTERED`;
    await upsertEvent({
      id: eventId,
      type: "ISSUER_REGISTERED",
      credentialId: null,
      issuerId: iss.id,
      sha256: null,
      status: "ACTIVE",
      issuedAt: null,
      expiresAt: null,
      prevEventId: null,
      payload: { v: 1, type: "ISSUER_REGISTERED", eventId, issuerId: iss.id, status: "ACTIVE" },
    });
  }

  for (const c of credentials) {
    const sha256 = hashes.credentials?.[c.id] ?? placeholderHash(c.id);
    const issuedEventId = `evt_${c.id}_ISSUED`;
    await upsertEvent({
      id: issuedEventId,
      type: "CREDENTIAL_ISSUED",
      credentialId: c.id,
      issuerId: c.issuerId,
      sha256,
      status: "ACTIVE",
      issuedAt: new Date(c.issuedAt),
      expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
      prevEventId: null,
      payload: {
        v: 1,
        type: "CREDENTIAL_ISSUED",
        eventId: issuedEventId,
        credentialId: c.id,
        issuerId: c.issuerId,
        sha256,
        issuedAt: c.issuedAt,
        expiresAt: c.expiresAt ?? undefined,
        status: "ACTIVE",
      },
    });

    if (c.status === "REVOKED" && c.revokedAt) {
      const revokedEventId = `evt_${c.id}_REVOKED`;
      await upsertEvent({
        id: revokedEventId,
        type: "CREDENTIAL_REVOKED",
        credentialId: c.id,
        issuerId: c.issuerId,
        sha256,
        status: "REVOKED",
        issuedAt: null,
        expiresAt: null,
        prevEventId: issuedEventId,
        payload: {
          v: 1,
          type: "CREDENTIAL_REVOKED",
          eventId: revokedEventId,
          credentialId: c.id,
          issuerId: c.issuerId,
          sha256,
          status: "REVOKED",
          revokedAt: c.revokedAt,
          prevEventId: issuedEventId,
        },
      });
    }
  }
  console.log(`✓ credential_events: ${eventCount}`);

  // ── demo_samples ────────────────────────────────────────────────────────────
  for (const s of samples) {
    const sha256 = hashes.samples?.[s.slug] ?? null;
    await db
      .insert(schema.demoSamples)
      .values({
        slug: s.slug,
        credentialId: s.credentialId,
        category: s.category,
        label: s.label,
        description: s.description,
        filename: s.filename,
        expectedVerdict: s.expectedVerdict,
        sha256,
      })
      .onConflictDoUpdate({
        target: schema.demoSamples.slug,
        set: {
          credentialId: s.credentialId,
          category: s.category,
          label: s.label,
          description: s.description,
          filename: s.filename,
          expectedVerdict: s.expectedVerdict,
          sha256,
        },
      });
  }
  console.log(`✓ demo_samples: ${samples.length}`);
  console.log("✓ seed complete");
}

// Run as a CLI when invoked directly (tsx scripts/seed.ts).
const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed.ts");
if (isDirectRun) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("✗ seed failed:", err);
      process.exit(1);
    });
}
