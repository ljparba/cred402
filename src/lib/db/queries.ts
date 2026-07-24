/**
 * Typed data access for Cred402. Thin, intention-revealing wrappers over
 * Drizzle so the engine, API routes, and scripts never build ad-hoc SQL.
 * Pure reads/writes — business logic (nonces, verdicts, settlement checks)
 * lives in the verify/ and x402/ layers.
 */
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
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

// ── payment claim (the settlement-critical section lock) ─────────────────────
/**
 * ATOMIC compare-and-set `UNPAID → PAYMENT_IN_PROGRESS` for one request.
 *
 * This is the single gate into the settlement-critical section. A conditional
 * `UPDATE ... WHERE payment_state = 'UNPAID'` takes a row lock, so of N
 * concurrent callers exactly one sees a matched row and the rest get zero rows
 * back — no in-memory mutex, so it holds across Render processes/instances too.
 *
 * @returns true when THIS caller took the claim, false when someone else holds
 *          it (or the request is already PAID / PAYMENT_UNKNOWN).
 */
export async function claimPaymentInProgress(requestId: string): Promise<boolean> {
  const db = await getDb();
  const claimed = await db
    .update(schema.verificationRequests)
    .set({ paymentState: "PAYMENT_IN_PROGRESS", paymentClaimedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(schema.verificationRequests.id, requestId),
        eq(schema.verificationRequests.paymentState, "UNPAID"),
      ),
    )
    .returning({ id: schema.verificationRequests.id });
  return claimed.length === 1;
}

/**
 * Release a claim back to UNPAID. ONLY legal when the caller has proven no
 * settlement was submitted (see `src/lib/x402/payment-flow.ts` for the
 * classification). Conditional on PAYMENT_IN_PROGRESS so it can never resurrect
 * a PAID or PAYMENT_UNKNOWN request into a payable one.
 */
export async function releasePaymentClaim(requestId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.verificationRequests)
    .set({ paymentState: "UNPAID", paymentClaimedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.verificationRequests.id, requestId),
        eq(schema.verificationRequests.paymentState, "PAYMENT_IN_PROGRESS"),
      ),
    );
}

/**
 * Park a request in PAYMENT_UNKNOWN: an attempt failed at or after submission,
 * so we cannot prove money did not move. Terminal for automatic payment — the
 * request is never reopened, which is what guarantees no replacement payment is
 * ever sent. `transactionId` (public Hedera id) is kept as the reconciliation
 * handle.
 */
export async function markPaymentUnknown(
  requestId: string,
  transactionId?: string | null,
): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.verificationRequests)
    .set({
      paymentState: "PAYMENT_UNKNOWN",
      paymentClaimTxId: transactionId ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.verificationRequests.id, requestId),
        eq(schema.verificationRequests.paymentState, "PAYMENT_IN_PROGRESS"),
      ),
    );
}

/** Mark a request paid once its Mirror-confirmed settlement row exists. */
export async function markPaymentPaid(requestId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.verificationRequests)
    .set({ paymentState: "PAID", status: "PAID", paymentClaimTxId: null, updatedAt: new Date() })
    .where(eq(schema.verificationRequests.id, requestId));
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
 * Insert a settlement. TWO database constraints back the application logic:
 *  - UNIQUE(transaction_id) — first-use-wins replay protection: one settled tx
 *    unlocks exactly one report, ever.
 *  - UNIQUE(request_id) WHERE status='SETTLED' — one request settles at most
 *    once, even if two callers somehow both reach this insert.
 * A violation throws; the caller classifies it (see `payment-flow.ts`).
 */
export async function createSettlement(
  row: typeof schema.paymentSettlements.$inferInsert,
): Promise<PaymentSettlement> {
  const db = await getDb();
  const [created] = await db.insert(schema.paymentSettlements).values(row).returning();
  return created;
}

/** Successful settlement rows recorded for a request (invariant check: ≤ 1). */
export async function countSettledForRequest(requestId: string): Promise<number> {
  return countRowsWhere(
    schema.paymentSettlements,
    and(
      eq(schema.paymentSettlements.requestId, requestId),
      eq(schema.paymentSettlements.status, "SETTLED"),
    ) as SQL,
  );
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

/** Count only the rows matching `where` (e.g. successful settlements). */
async function countRowsWhere(table: PgTable, where: SQL): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
  return rows[0]?.n ?? 0;
}

/**
 * Raw counts behind the public statistic row. Each field is exactly what its
 * name says — the presentation layer decides how to label them (see
 * `src/app/api/activity/route.ts`), never the other way round.
 */
export interface ActivityStats {
  /** Rows in `credentials` — registered credential records. */
  credentials: number;
  /** Rows in `credential_events` — the LOCAL mirror of HCS envelopes. */
  credentialEvents: number;
  /** Rows in `verification_requests` — includes locked / unpaid requests. */
  verifications: number;
  /** `payment_settlements` rows with status SETTLED — successful settlements only. */
  settlements: number;
  /** Rows in `hcs_records` — real on-chain proof coordinates only. */
  hcsRecords: number;
}

export async function getActivityStats(): Promise<ActivityStats> {
  const [credentials, credentialEvents, verifications, settlements, hcsRecords] = await Promise.all([
    countRows(schema.credentials),
    countRows(schema.credentialEvents),
    countRows(schema.verificationRequests),
    countRowsWhere(schema.paymentSettlements, eq(schema.paymentSettlements.status, "SETTLED")),
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
