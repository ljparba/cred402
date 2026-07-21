/**
 * Typed data access for Cred402. Thin, intention-revealing wrappers over
 * Drizzle so the engine, API routes, and scripts never build ad-hoc SQL.
 * Pure reads/writes — business logic (nonces, verdicts, settlement checks)
 * lives in the verify/ and x402/ layers.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./index";
import type { PgTable } from "drizzle-orm/pg-core";
import type {
  Credential,
  CredentialEvent,
  DemoSample,
  HcsRecord,
  Issuer,
  PaymentRequest,
  PaymentSettlement,
  VerificationRequest,
  VerificationResult,
} from "./schema";

// ── demo registration (Create Tamper Demo) ───────────────────────────────────
/** Ensure the synthetic demo issuer exists (registered), idempotently. */
export async function ensureIssuer(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.issuers)
    .values({ id, name, registered: true })
    .onConflictDoUpdate({ target: schema.issuers.id, set: { name, registered: true } });
}

export async function insertCredential(
  row: typeof schema.credentials.$inferInsert,
): Promise<Credential> {
  const db = await getDb();
  const [created] = await db.insert(schema.credentials).values(row).returning();
  return created;
}

export async function insertCredentialEvent(
  row: typeof schema.credentialEvents.$inferInsert,
): Promise<CredentialEvent> {
  const db = await getDb();
  const [created] = await db.insert(schema.credentialEvents).values(row).returning();
  return created;
}

export async function insertHcsRecord(
  row: typeof schema.hcsRecords.$inferInsert,
): Promise<HcsRecord> {
  const db = await getDb();
  const [created] = await db.insert(schema.hcsRecords).values(row).returning();
  return created;
}

// ── credentials ──────────────────────────────────────────────────────────────
export async function findCredentialByHash(sha256: string): Promise<Credential | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.credentials)
    .where(eq(schema.credentials.sha256, sha256.toLowerCase()))
    .limit(1);
  return rows[0];
}

export async function findCredentialById(id: string): Promise<Credential | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.credentials)
    .where(eq(schema.credentials.id, id))
    .limit(1);
  return rows[0];
}

// ── issuers ──────────────────────────────────────────────────────────────────
export async function getIssuer(id: string): Promise<Issuer | undefined> {
  const db = await getDb();
  const rows = await db.select().from(schema.issuers).where(eq(schema.issuers.id, id)).limit(1);
  return rows[0];
}

// ── credential events (local mirror of HCS envelopes) ───────────────────────
export async function getCredentialEvents(credentialId: string): Promise<CredentialEvent[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.credentialEvents)
    .where(eq(schema.credentialEvents.credentialId, credentialId))
    .orderBy(schema.credentialEvents.createdAt);
}

export async function getIssuanceEvent(credentialId: string): Promise<CredentialEvent | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.credentialEvents)
    .where(
      and(
        eq(schema.credentialEvents.credentialId, credentialId),
        eq(schema.credentialEvents.type, "CREDENTIAL_ISSUED"),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function hasRevocationEvent(credentialId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.credentialEvents.id })
    .from(schema.credentialEvents)
    .where(
      and(
        eq(schema.credentialEvents.credentialId, credentialId),
        eq(schema.credentialEvents.type, "CREDENTIAL_REVOKED"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ── HCS proof coordinates ────────────────────────────────────────────────────
export async function getHcsRecordByEventId(eventId: string): Promise<HcsRecord | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.hcsRecords)
    .where(eq(schema.hcsRecords.eventId, eventId))
    .limit(1);
  return rows[0];
}

/** The on-chain proof for a credential's issuance event, if anchored. */
export async function getIssuanceHcsRecord(credentialId: string): Promise<HcsRecord | undefined> {
  const issuance = await getIssuanceEvent(credentialId);
  if (!issuance) return undefined;
  return getHcsRecordByEventId(issuance.id);
}

// ── demo samples ─────────────────────────────────────────────────────────────
export async function listSamples(): Promise<DemoSample[]> {
  const db = await getDb();
  return db.select().from(schema.demoSamples).orderBy(schema.demoSamples.slug);
}

export async function getSampleBySlug(slug: string): Promise<DemoSample | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.demoSamples)
    .where(eq(schema.demoSamples.slug, slug))
    .limit(1);
  return rows[0];
}

// ── verification requests ────────────────────────────────────────────────────
export async function createVerificationRequest(
  row: typeof schema.verificationRequests.$inferInsert,
): Promise<VerificationRequest> {
  const db = await getDb();
  const [created] = await db.insert(schema.verificationRequests).values(row).returning();
  return created;
}

export async function getVerificationRequest(
  id: string,
): Promise<VerificationRequest | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.verificationRequests)
    .where(eq(schema.verificationRequests.id, id))
    .limit(1);
  return rows[0];
}

export async function updateVerificationRequest(
  id: string,
  patch: Partial<typeof schema.verificationRequests.$inferInsert>,
): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.verificationRequests)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.verificationRequests.id, id));
}

// ── verification results ─────────────────────────────────────────────────────
export async function createVerificationResult(
  row: typeof schema.verificationResults.$inferInsert,
): Promise<VerificationResult> {
  const db = await getDb();
  const [created] = await db
    .insert(schema.verificationResults)
    .values(row)
    .onConflictDoUpdate({
      target: schema.verificationResults.requestId,
      set: {
        verdict: row.verdict,
        checks: row.checks,
        uploadedHash: row.uploadedHash,
        anchoredHash: row.anchoredHash,
        hcsSequenceNumber: row.hcsSequenceNumber,
        hcsTransactionId: row.hcsTransactionId,
      },
    })
    .returning();
  return created;
}

export async function getVerificationResult(
  requestId: string,
): Promise<VerificationResult | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.verificationResults)
    .where(eq(schema.verificationResults.requestId, requestId))
    .limit(1);
  return rows[0];
}

// ── payments ─────────────────────────────────────────────────────────────────
export async function createPaymentRequest(
  row: typeof schema.paymentRequests.$inferInsert,
): Promise<PaymentRequest> {
  const db = await getDb();
  const [created] = await db.insert(schema.paymentRequests).values(row).returning();
  return created;
}

export async function findSettlementByTxId(
  transactionId: string,
): Promise<PaymentSettlement | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.paymentSettlements)
    .where(eq(schema.paymentSettlements.transactionId, transactionId))
    .limit(1);
  return rows[0];
}

export async function findSettlementForRequest(
  requestId: string,
): Promise<PaymentSettlement | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.paymentSettlements)
    .where(
      and(
        eq(schema.paymentSettlements.requestId, requestId),
        eq(schema.paymentSettlements.status, "SETTLED"),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * Insert a settlement. The UNIQUE constraint on transaction_id enforces
 * first-use-wins replay protection at the database layer — a duplicate tx
 * insert throws, which the caller treats as "payment already consumed".
 */
export async function createSettlement(
  row: typeof schema.paymentSettlements.$inferInsert,
): Promise<PaymentSettlement> {
  const db = await getDb();
  const [created] = await db.insert(schema.paymentSettlements).values(row).returning();
  return created;
}

// ── activity feed (live Hedera/HCS/verification activity) ────────────────────
export async function recentHcsRecords(limit = 10): Promise<HcsRecord[]> {
  const db = await getDb();
  return db.select().from(schema.hcsRecords).orderBy(desc(schema.hcsRecords.createdAt)).limit(limit);
}

export async function recentSettlements(limit = 10): Promise<PaymentSettlement[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.paymentSettlements)
    .orderBy(desc(schema.paymentSettlements.createdAt))
    .limit(limit);
}

export async function recentVerificationRequests(limit = 10): Promise<VerificationRequest[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.verificationRequests)
    .orderBy(desc(schema.verificationRequests.createdAt))
    .limit(limit);
}

// ── counts / stats ───────────────────────────────────────────────────────────
async function countRows(table: PgTable): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  return rows[0]?.n ?? 0;
}

export interface ActivityStats {
  credentials: number;
  credentialEvents: number;
  verifications: number;
  settlements: number;
  hcsRecords: number;
}

export async function getActivityStats(): Promise<ActivityStats> {
  const [credentials, credentialEvents, verifications, settlements, hcsRecords] = await Promise.all([
    countRows(schema.credentials),
    countRows(schema.credentialEvents),
    countRows(schema.verificationRequests),
    countRows(schema.paymentSettlements),
    countRows(schema.hcsRecords),
  ]);
  return { credentials, credentialEvents, verifications, settlements, hcsRecords };
}

/** Lightweight connectivity probe for the health endpoint. */
export async function pingDb(): Promise<boolean> {
  const db = await getDb();
  await db.execute(sql`select 1`);
  return true;
}
