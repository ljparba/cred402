/**
 * Cred402 database schema (Drizzle ORM, PostgreSQL dialect).
 *
 * Portable across PGlite (local) and postgres.js (Neon/Render) — no
 * provider-specific SQL. Status/verdict columns use `text` with a TS `$type`
 * union rather than PG enums, to keep migrations painless and portable.
 *
 * The DB holds the CURRENT INDEXED STATE. External timestamped proof lives on
 * Hedera Consensus Service; `hcs_records` stores only the coordinates
 * (topic, sequence, consensus timestamp, tx id) needed to re-verify it.
 */

import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ── Shared value unions ──────────────────────────────────────────────────────
export type CredentialStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
/** How a credential entered the registry: seeded catalogue vs Create-Tamper-Demo. */
export type CredentialSource = "seed" | "demo";
export type EventType = "CREDENTIAL_ISSUED" | "CREDENTIAL_REVOKED" | "ISSUER_REGISTERED";
export type RequestStatus = "AWAITING_PAYMENT" | "PAID" | "COMPLETED" | "FAILED";
export type SettlementStatus = "SETTLED" | "FAILED";
/**
 * Payment lifecycle of ONE verification request — the authoritative concurrency
 * lock for the settlement-critical section (`status` above stays a descriptive
 * lifecycle label).
 *
 *  UNPAID               no settlement attempt owns this request
 *  PAYMENT_IN_PROGRESS  exactly one caller is inside the settlement section
 *  PAID                 a Mirror-confirmed settlement row exists
 *  PAYMENT_UNKNOWN      an attempt failed AFTER (or possibly after) submission —
 *                       terminal for automatic payment: the request is never
 *                       reopened, so no replacement payment can ever be sent
 */
export type PaymentState = "UNPAID" | "PAYMENT_IN_PROGRESS" | "PAID" | "PAYMENT_UNKNOWN";
export type SampleCategory =
  | "valid"
  | "tampered"
  | "expired"
  | "revoked"
  | "fake"
  | "unregistered";
export type Verdict =
  | "VALID"
  | "TAMPERED"
  | "REVOKED"
  | "EXPIRED"
  | "UNKNOWN"
  | "UNREGISTERED_ISSUER";
export type CheckStatus = "PASS" | "FAIL" | "WARN" | "SKIP";

/** One deterministic verification check, persisted inside the result report. */
export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  evidence: string;
}

const now = () => timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull();

// ── issuers ──────────────────────────────────────────────────────────────────
export const issuers = pgTable("issuers", {
  id: text("id").primaryKey(), // e.g. "ISS-CRED402-DEMO"
  name: text("name").notNull(),
  /** Registered/trusted demo issuer. `false` powers the "unregistered issuer" demo. */
  registered: boolean("registered").notNull().default(true),
  hederaTopicId: text("hedera_topic_id"),
  createdAt: now(),
});

// ── credentials (current indexed state) ──────────────────────────────────────
export const credentials = pgTable(
  "credentials",
  {
    id: text("id").primaryKey(), // e.g. "CRED-2026-0001"
    issuerId: text("issuer_id")
      .notNull()
      .references(() => issuers.id),
    studentName: text("student_name").notNull(),
    courseName: text("course_name").notNull(),
    grade: text("grade"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    status: text("status").$type<CredentialStatus>().notNull().default("ACTIVE"),
    /** SHA-256 (64 hex) of the originally issued file — the anchored expected hash. */
    sha256: text("sha256").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    /** Seeded catalogue credential vs one created by the Create Tamper Demo feature. */
    source: text("source").$type<CredentialSource>().notNull().default("seed"),
    createdAt: now(),
  },
  (t) => [
    index("credentials_sha256_idx").on(t.sha256),
    index("credentials_issuer_idx").on(t.issuerId),
  ],
);

// ── credential_events (local mirror of HCS envelopes we submit) ──────────────
export const credentialEvents = pgTable(
  "credential_events",
  {
    id: text("id").primaryKey(), // eventId, e.g. "evt_..." (idempotency key)
    type: text("type").$type<EventType>().notNull(),
    credentialId: text("credential_id").references(() => credentials.id),
    issuerId: text("issuer_id")
      .notNull()
      .references(() => issuers.id),
    sha256: text("sha256"),
    status: text("status"),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    prevEventId: text("prev_event_id"),
    /** Exact JSON envelope submitted to HCS (versioned). */
    payload: jsonb("payload").notNull(),
    createdAt: now(),
  },
  (t) => [index("credential_events_credential_idx").on(t.credentialId)],
);

// ── hcs_records (on-chain proof coordinates for each event) ──────────────────
export const hcsRecords = pgTable(
  "hcs_records",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => credentialEvents.id),
    topicId: text("topic_id").notNull(),
    sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
    /** e.g. "1690000000.123456789" */
    consensusTimestamp: text("consensus_timestamp"),
    /** Dashed form "0.0.X-sss-nnn" (Mirror-Node compatible). */
    transactionId: text("transaction_id").notNull(),
    runningHash: text("running_hash"),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("hcs_records_event_idx").on(t.eventId),
    uniqueIndex("hcs_records_topic_seq_idx").on(t.topicId, t.sequenceNumber),
  ],
);

// ── verification_requests (lifecycle of one verification) ────────────────────
export const verificationRequests = pgTable(
  "verification_requests",
  {
    id: text("id").primaryKey(), // requestId, e.g. "vr_..."
    uploadedFilename: text("uploaded_filename"),
    uploadedSize: integer("uploaded_size"),
    uploadedMime: text("uploaded_mime"),
    /** SHA-256 of the uploaded file. */
    sha256: text("sha256").notNull(),
    credentialId: text("credential_id"),
    issuerId: text("issuer_id"),
    /**
     * Opaque REQUEST EXPIRY TOKEN carried in the 402 challenge. It is a
     * server-side freshness value only: the Hedera `exact` scheme has no nonce
     * field, so this is NOT cryptographically bound into the signed payment.
     * (Column name kept for migration safety — see `nonceExpiresAt`, which is
     * the value the code actually enforces.)
     */
    nonce: text("nonce").notNull(),
    /** Server-side request TTL. After this instant an UNPAID request is 410 Gone. */
    nonceExpiresAt: timestamp("nonce_expires_at", { withTimezone: true, mode: "date" }).notNull(),
    status: text("status").$type<RequestStatus>().notNull().default("AWAITING_PAYMENT"),
    /**
     * Atomic payment claim. Every transition is a compare-and-set on this
     * column, which is what stops two concurrent callers settling twice.
     */
    paymentState: text("payment_state").$type<PaymentState>().notNull().default("UNPAID"),
    /** When the current PAYMENT_IN_PROGRESS claim was taken (diagnostics). */
    paymentClaimedAt: timestamp("payment_claimed_at", { withTimezone: true, mode: "date" }),
    /**
     * Transaction id of an attempt whose outcome is unknown. Public Hedera
     * identifier, never a signature or key — it is the reconciliation handle
     * for a PAYMENT_UNKNOWN request.
     */
    paymentClaimTxId: text("payment_claim_tx_id"),
    /** Provisional verdict computed at preview time (report still gated). */
    previewVerdict: text("preview_verdict").$type<Verdict>(),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("verification_requests_sha256_idx").on(t.sha256),
    index("verification_requests_nonce_idx").on(t.nonce),
  ],
);

// ── verification_results (the released full report) ──────────────────────────
export const verificationResults = pgTable("verification_results", {
  id: text("id").primaryKey(),
  requestId: text("request_id")
    .notNull()
    .references(() => verificationRequests.id),
  verdict: text("verdict").$type<Verdict>().notNull(),
  checks: jsonb("checks").$type<CheckResult[]>().notNull(),
  uploadedHash: text("uploaded_hash").notNull(),
  anchoredHash: text("anchored_hash"),
  hcsSequenceNumber: bigint("hcs_sequence_number", { mode: "number" }),
  hcsTransactionId: text("hcs_transaction_id"),
  createdAt: now(),
}, (t) => [uniqueIndex("verification_results_request_idx").on(t.requestId)]);

// ── payment_requests (the 402 challenge we advertised) ───────────────────────
export const paymentRequests = pgTable("payment_requests", {
  id: text("id").primaryKey(),
  requestId: text("request_id")
    .notNull()
    .references(() => verificationRequests.id),
  scheme: text("scheme").notNull().default("exact"),
  network: text("network").notNull(),
  asset: text("asset").notNull(),
  /** Amount in tinybars (exact string). */
  amount: text("amount").notNull(),
  payTo: text("pay_to").notNull(),
  feePayer: text("fee_payer"),
  maxTimeoutSeconds: integer("max_timeout_seconds").notNull().default(180),
  nonce: text("nonce").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: now(),
});

// ── payment_settlements (proven, first-use-wins) ─────────────────────────────
export const paymentSettlements = pgTable(
  "payment_settlements",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => verificationRequests.id),
    paymentRequestId: text("payment_request_id").references(() => paymentRequests.id),
    /** UNIQUE: a settled tx can unlock exactly one report, ever (replay protection). */
    transactionId: text("transaction_id").notNull(),
    payer: text("payer"),
    payTo: text("pay_to").notNull(),
    amount: text("amount").notNull(),
    consensusTimestamp: text("consensus_timestamp"),
    /** Independently confirmed against Mirror Node (not just facilitator's word). */
    mirrorVerified: boolean("mirror_verified").notNull().default(false),
    status: text("status").$type<SettlementStatus>().notNull(),
    hashscanUrl: text("hashscan_url"),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("payment_settlements_tx_idx").on(t.transactionId),
    /**
     * Database backstop for "one request settles at most once" (invariant P1).
     * PARTIAL on status='SETTLED' so a FAILED attempt can still be recorded as
     * evidence for the same request — only successful settlements are capped
     * at one. Concurrent callers that somehow both reach the insert lose here.
     */
    uniqueIndex("payment_settlements_settled_request_idx")
      .on(t.requestId)
      .where(sql`${t.status} = 'SETTLED'`),
  ],
);

// ── demo_samples (downloadable test catalogue) ───────────────────────────────
export const demoSamples = pgTable("demo_samples", {
  slug: text("slug").primaryKey(),
  credentialId: text("credential_id").references(() => credentials.id),
  category: text("category").$type<SampleCategory>().notNull(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  /** Path under samples/, e.g. "valid/hedera-fundamentals.pdf". */
  filename: text("filename").notNull(),
  expectedVerdict: text("expected_verdict").$type<Verdict>().notNull(),
  sha256: text("sha256"),
  createdAt: now(),
});

// ── rate_limit_hits (DB-backed limiter — portable, multi-instance-safe) ──────
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: text("id").primaryKey(),
    /** Bucket key, e.g. "demo_register:<sha256(ip)>". */
    key: text("key").notNull(),
    at: timestamp("at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("rate_limit_hits_key_at_idx").on(t.key, t.at)],
);

// ── relations ────────────────────────────────────────────────────────────────
export const issuersRelations = relations(issuers, ({ many }) => ({
  credentials: many(credentials),
  events: many(credentialEvents),
}));

export const credentialsRelations = relations(credentials, ({ one, many }) => ({
  issuer: one(issuers, { fields: [credentials.issuerId], references: [issuers.id] }),
  events: many(credentialEvents),
  sample: one(demoSamples, { fields: [credentials.id], references: [demoSamples.credentialId] }),
}));

export const credentialEventsRelations = relations(credentialEvents, ({ one }) => ({
  credential: one(credentials, {
    fields: [credentialEvents.credentialId],
    references: [credentials.id],
  }),
  issuer: one(issuers, { fields: [credentialEvents.issuerId], references: [issuers.id] }),
  hcsRecord: one(hcsRecords, { fields: [credentialEvents.id], references: [hcsRecords.eventId] }),
}));

export const hcsRecordsRelations = relations(hcsRecords, ({ one }) => ({
  event: one(credentialEvents, {
    fields: [hcsRecords.eventId],
    references: [credentialEvents.id],
  }),
}));

export const verificationRequestsRelations = relations(verificationRequests, ({ one, many }) => ({
  result: one(verificationResults, {
    fields: [verificationRequests.id],
    references: [verificationResults.requestId],
  }),
  paymentRequests: many(paymentRequests),
  settlements: many(paymentSettlements),
}));

export const verificationResultsRelations = relations(verificationResults, ({ one }) => ({
  request: one(verificationRequests, {
    fields: [verificationResults.requestId],
    references: [verificationRequests.id],
  }),
}));

export const paymentSettlementsRelations = relations(paymentSettlements, ({ one }) => ({
  request: one(verificationRequests, {
    fields: [paymentSettlements.requestId],
    references: [verificationRequests.id],
  }),
  paymentRequest: one(paymentRequests, {
    fields: [paymentSettlements.paymentRequestId],
    references: [paymentRequests.id],
  }),
}));

export const demoSamplesRelations = relations(demoSamples, ({ one }) => ({
  credential: one(credentials, {
    fields: [demoSamples.credentialId],
    references: [credentials.id],
  }),
}));

// Convenience row types
export type Issuer = typeof issuers.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type CredentialEvent = typeof credentialEvents.$inferSelect;
export type HcsRecord = typeof hcsRecords.$inferSelect;
export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type VerificationResult = typeof verificationResults.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type PaymentSettlement = typeof paymentSettlements.$inferSelect;
export type DemoSample = typeof demoSamples.$inferSelect;
export type RateLimitHit = typeof rateLimitHits.$inferSelect;
