/**
 * Deterministic verification engine — NO AI, no heuristics. Given an uploaded
 * file's SHA-256 (and any credential ID embedded in it), it runs six
 * independent checks against the credential registry and HCS evidence, then
 * resolves a single verdict by strict precedence (plan §3.3):
 *
 *   UNKNOWN → UNREGISTERED_ISSUER → TAMPERED → REVOKED → EXPIRED → VALID
 *
 * TAMPERING is the legible flagship case: the credential ID is KNOWN and HCS
 * evidence EXISTS, but the uploaded hash DIFFERS from the anchored hash — i.e.
 * the file was edited after issuance.
 *
 * The engine is pure w.r.t. its inputs + the DB; `now` and on-chain
 * re-verification are injectable so it is unit-testable and deterministic.
 */
import type { CheckResult, CheckStatus, Credential, Verdict } from "@/lib/db/schema";
import { hashesEqual } from "./hash";
import {
  findCredentialByHash,
  findCredentialById,
  getIssuer,
  getIssuanceEvent,
  getIssuanceHcsRecord,
  hasRevocationEvent,
} from "@/lib/db/queries";

export interface EngineInput {
  /** Lowercase hex SHA-256 of the uploaded file. */
  uploadedHash: string;
  /** Credential ID extracted from the uploaded PDF's metadata, if any. */
  claimedCredentialId?: string;
  /** Injectable clock for deterministic expiration checks. Default: now. */
  now?: Date;
}

export interface HcsEvidence {
  topicId?: string;
  sequenceNumber?: number;
  transactionId?: string;
  consensusTimestamp?: string;
  /** true = anchored on Hedera; false = local offline fixture (pre-anchor). */
  anchored: boolean;
}

export interface EngineResult {
  verdict: Verdict;
  checks: CheckResult[];
  /** The credential the file was identified as (by hash, else by claimed ID). */
  credentialId?: string;
  courseName?: string;
  issuerId?: string;
  issuerName?: string;
  /** The originally-anchored hash for the identified credential. */
  anchoredHash?: string;
  uploadedHash: string;
  hashMatches: boolean;
  hcs?: HcsEvidence;
}

const CHECK = {
  hash: "hash_integrity",
  known: "credential_known",
  issuer: "issuer_registered",
  revocation: "revocation",
  expiration: "expiration",
  hcs: "hcs_evidence",
} as const;

function check(id: string, label: string, status: CheckStatus, evidence: string): CheckResult {
  return { id, label, status, evidence };
}

/**
 * Run the full verification pipeline. Reads the registry + HCS evidence for the
 * identified credential and returns every check plus the resolved verdict.
 */
export async function verify(input: EngineInput): Promise<EngineResult> {
  const uploadedHash = input.uploadedHash.toLowerCase();
  const now = input.now ?? new Date();

  // ── Identify the credential: by hash first, then by claimed ID ─────────────
  let credential: Credential | undefined = await findCredentialByHash(uploadedHash);
  let identifiedBy: "hash" | "claimed-id" | "none" = "none";
  if (credential) {
    identifiedBy = "hash";
  } else if (input.claimedCredentialId) {
    credential = await findCredentialById(input.claimedCredentialId);
    if (credential) identifiedBy = "claimed-id";
  }

  // ── UNKNOWN: nothing matches ────────────────────────────────────────────────
  if (!credential) {
    const idNote = input.claimedCredentialId
      ? `Claimed credential ID "${input.claimedCredentialId}" is not in the registry.`
      : "The file carries no recognisable credential ID and its hash matches no anchored record.";
    return {
      verdict: "UNKNOWN",
      uploadedHash,
      hashMatches: false,
      checks: [
        check(CHECK.known, "Credential known", "FAIL", idNote),
        check(
          CHECK.hash,
          "Hash integrity",
          "SKIP",
          "No anchored credential to compare against.",
        ),
        check(CHECK.issuer, "Issuer registered", "SKIP", "No credential identified."),
        check(CHECK.revocation, "Not revoked", "SKIP", "No credential identified."),
        check(CHECK.expiration, "Not expired", "SKIP", "No credential identified."),
        check(CHECK.hcs, "HCS evidence", "FAIL", "No Hedera Consensus Service record found."),
      ],
    };
  }

  const hashMatches = hashesEqual(uploadedHash, credential.sha256);
  const issuer = await getIssuer(credential.issuerId);
  const issuanceEvent = await getIssuanceEvent(credential.id);
  const anchoredRecord = await getIssuanceHcsRecord(credential.id);
  const revoked = credential.status === "REVOKED" || (await hasRevocationEvent(credential.id));
  const expired = credential.expiresAt != null && credential.expiresAt.getTime() < now.getTime();

  // ── HCS evidence ────────────────────────────────────────────────────────────
  let hcs: HcsEvidence | undefined;
  let hcsCheck: CheckResult;
  if (anchoredRecord) {
    hcs = {
      topicId: anchoredRecord.topicId,
      sequenceNumber: anchoredRecord.sequenceNumber,
      transactionId: anchoredRecord.transactionId,
      consensusTimestamp: anchoredRecord.consensusTimestamp ?? undefined,
      anchored: true,
    };
    hcsCheck = check(
      CHECK.hcs,
      "HCS evidence",
      "PASS",
      `Issuance anchored on Hedera — topic ${anchoredRecord.topicId}, sequence ${anchoredRecord.sequenceNumber}` +
        (anchoredRecord.transactionId ? `, tx ${anchoredRecord.transactionId}.` : "."),
    );
  } else if (issuanceEvent) {
    hcs = { anchored: false };
    hcsCheck = check(
      CHECK.hcs,
      "HCS evidence",
      "WARN",
      "Issuance event present as a local offline fixture. It will carry an on-chain " +
        "Hedera Consensus Service proof once operator keys are configured and " +
        "`npm run hedera:anchor` has run.",
    );
  } else {
    hcs = undefined;
    hcsCheck = check(
      CHECK.hcs,
      "HCS evidence",
      "FAIL",
      "No issuance event exists for this credential.",
    );
  }
  const hasHcsEvidence = Boolean(issuanceEvent || anchoredRecord);

  // ── Assemble the six checks ─────────────────────────────────────────────────
  const hashCheck = hashMatches
    ? check(
        CHECK.hash,
        "Hash integrity",
        "PASS",
        `Uploaded SHA-256 matches the anchored issuance hash (${credential.sha256}).`,
      )
    : check(
        CHECK.hash,
        "Hash integrity",
        "FAIL",
        `Uploaded SHA-256 (${uploadedHash}) does NOT match the anchored hash ` +
          `(${credential.sha256}). The file was altered after issuance.`,
      );

  const knownCheck = check(
    CHECK.known,
    "Credential known",
    "PASS",
    `Identified as ${credential.id} (${credential.courseName}) ` +
      `by ${identifiedBy === "hash" ? "file hash" : "embedded credential ID"}.`,
  );

  const issuerCheck = issuer?.registered
    ? check(CHECK.issuer, "Issuer registered", "PASS", `Issued by registered issuer "${issuer.name}".`)
    : check(
        CHECK.issuer,
        "Issuer registered",
        "FAIL",
        issuer
          ? `Issuer "${issuer.name}" is NOT a registered/trusted Cred402 issuer.`
          : `Issuer "${credential.issuerId}" is unknown.`,
      );

  const revocationCheck = revoked
    ? check(
        CHECK.revocation,
        "Not revoked",
        "FAIL",
        credential.revokedAt
          ? `Credential was REVOKED on ${credential.revokedAt.toISOString().slice(0, 10)}.`
          : "A CREDENTIAL_REVOKED event exists for this credential.",
      )
    : check(CHECK.revocation, "Not revoked", "PASS", "No revocation event recorded.");

  const expirationCheck = expired
    ? check(
        CHECK.expiration,
        "Not expired",
        "FAIL",
        `Credential expired on ${credential.expiresAt!.toISOString().slice(0, 10)}.`,
      )
    : check(
        CHECK.expiration,
        "Not expired",
        "PASS",
        credential.expiresAt
          ? `Valid until ${credential.expiresAt.toISOString().slice(0, 10)}.`
          : "Credential has no expiry.",
      );

  const checks = [hashCheck, knownCheck, issuerCheck, revocationCheck, expirationCheck, hcsCheck];

  // ── Resolve verdict by precedence ───────────────────────────────────────────
  let verdict: Verdict;
  if (!issuer?.registered) {
    verdict = "UNREGISTERED_ISSUER";
  } else if (!hashMatches && hasHcsEvidence) {
    verdict = "TAMPERED";
  } else if (!hashMatches) {
    // Matched only by claimed ID, hash differs, and no HCS evidence to anchor
    // the claim → we cannot assert tampering; treat as unknown.
    verdict = "UNKNOWN";
  } else if (revoked) {
    verdict = "REVOKED";
  } else if (expired) {
    verdict = "EXPIRED";
  } else {
    verdict = "VALID";
  }

  return {
    verdict,
    checks,
    credentialId: credential.id,
    courseName: credential.courseName,
    issuerId: credential.issuerId,
    issuerName: issuer?.name,
    anchoredHash: credential.sha256,
    uploadedHash,
    hashMatches,
    hcs,
  };
}
