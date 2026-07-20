/**
 * Versioned HCS event envelopes — the exact JSON shape submitted to the topic
 * and mirrored into `credential_events.payload`.
 *
 * The topic is an append-only credential event log. No PDFs and no personal
 * data ever go on-chain: only the hash, ids, timestamps, and status.
 *
 * IMPORTANT: these types and the builders below MUST stay byte-for-byte
 * compatible with the payloads scripts/seed.ts already writes, because
 * scripts/anchor-credentials.ts submits those stored payloads verbatim and the
 * verification engine re-derives evidence from Mirror Node. See the plan §3.4.
 */

/** Current envelope schema version. Bump only on a breaking envelope change. */
export const HCS_EVENT_VERSION = 1 as const;

export type HcsEventType =
  | "CREDENTIAL_ISSUED"
  | "CREDENTIAL_REVOKED"
  | "ISSUER_REGISTERED";

/** Fields shared by every envelope. */
interface HcsEventBase {
  /** Event schema version. */
  v: typeof HCS_EVENT_VERSION;
  type: HcsEventType;
  /** App-generated, doubles as the idempotency key (`credential_events.id`). */
  eventId: string;
  issuerId: string;
}

/** A credential was issued: anchors its SHA-256 and validity window. */
export interface CredentialIssuedEvent extends HcsEventBase {
  type: "CREDENTIAL_ISSUED";
  credentialId: string;
  sha256: string;
  issuedAt: string; // ISO-8601
  /** Omitted when the credential never expires. */
  expiresAt?: string; // ISO-8601
  status: "ACTIVE";
}

/** A previously-issued credential was revoked. */
export interface CredentialRevokedEvent extends HcsEventBase {
  type: "CREDENTIAL_REVOKED";
  credentialId: string;
  sha256: string;
  status: "REVOKED";
  revokedAt: string; // ISO-8601
  /** Chain reference back to the issuance event. */
  prevEventId: string;
}

/** An issuer was registered/trusted. */
export interface IssuerRegisteredEvent extends HcsEventBase {
  type: "ISSUER_REGISTERED";
  status: "ACTIVE";
}

/** Discriminated union of every HCS envelope, keyed on `type`. */
export type HcsEvent =
  | CredentialIssuedEvent
  | CredentialRevokedEvent
  | IssuerRegisteredEvent;

// ── Builders ─────────────────────────────────────────────────────────────────
// Each builder produces the exact object shape (and key order) that seed.ts
// writes into `credential_events.payload`, so anchoring stays deterministic.

/**
 * Build a `CREDENTIAL_ISSUED` envelope. Pass `expiresAt: null | undefined`
 * for credentials that never expire — the key is then omitted entirely,
 * matching seed.ts (`expiresAt: c.expiresAt ?? undefined`).
 */
export function buildIssuedEvent(input: {
  eventId: string;
  credentialId: string;
  issuerId: string;
  sha256: string;
  issuedAt: string;
  expiresAt?: string | null;
}): CredentialIssuedEvent {
  const event: CredentialIssuedEvent = {
    v: HCS_EVENT_VERSION,
    type: "CREDENTIAL_ISSUED",
    eventId: input.eventId,
    credentialId: input.credentialId,
    issuerId: input.issuerId,
    sha256: input.sha256,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt ?? undefined,
    status: "ACTIVE",
  };
  return event;
}

/** Build a `CREDENTIAL_REVOKED` envelope chained to its issuance event. */
export function buildRevokedEvent(input: {
  eventId: string;
  credentialId: string;
  issuerId: string;
  sha256: string;
  revokedAt: string;
  prevEventId: string;
}): CredentialRevokedEvent {
  return {
    v: HCS_EVENT_VERSION,
    type: "CREDENTIAL_REVOKED",
    eventId: input.eventId,
    credentialId: input.credentialId,
    issuerId: input.issuerId,
    sha256: input.sha256,
    status: "REVOKED",
    revokedAt: input.revokedAt,
    prevEventId: input.prevEventId,
  };
}

/** Build an `ISSUER_REGISTERED` envelope. */
export function buildIssuerRegisteredEvent(input: {
  eventId: string;
  issuerId: string;
}): IssuerRegisteredEvent {
  return {
    v: HCS_EVENT_VERSION,
    type: "ISSUER_REGISTERED",
    eventId: input.eventId,
    issuerId: input.issuerId,
    status: "ACTIVE",
  };
}
