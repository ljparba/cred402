/**
 * Create Tamper Demo — server-side registration (plan §8.3).
 *
 * Registers an uploaded ORIGINAL file as a synthetic credential under the fixed
 * `Cred402 Demo Issuer`, so the existing deterministic engine + x402 report gate
 * prove tampering later with zero new verdict logic. The uploaded file is hashed
 * in memory and NEVER persisted; only minimal proof (hash, ids, timestamp) is
 * stored and — in configured mode — anchored on HCS.
 *
 * The issuer is ALWAYS forced here; a public caller can never choose a trusted
 * issuer, a topic, or a payer.
 */
import { serverConfig } from "@/lib/config";
import { sha256 } from "@/lib/verify/hash";
import { newDemoCredentialId } from "@/lib/ids";
import { buildIssuedEvent, type HcsEvent } from "@/lib/hedera/types";
import { submitEvent } from "@/lib/hedera/hcs";
import { hashscanTopicUrl, hashscanTransactionUrl } from "@/lib/hedera/hashscan";
import {
  ensureIssuer,
  insertCredential,
  insertCredentialEvent,
  insertHcsRecord,
} from "@/lib/db/queries";

/** Fixed synthetic issuer — never client-supplied. */
export const DEMO_ISSUER_ID = "ISS-CRED402-DEMO";
export const DEMO_ISSUER_NAME = "Cred402 Demo Institute";

export interface DemoHcsProof {
  topicId: string;
  sequenceNumber: number;
  transactionId: string;
  consensusTimestamp: string | null;
  hashscanUrl: string;
  topicUrl: string;
}

export interface DemoRegistration {
  demoCredentialId: string;
  sha256: string;
  issuerId: string;
  issuerName: string;
  label: string;
  anchored: boolean;
  hcs: DemoHcsProof | null;
  network: string;
  demo: true;
  synthetic: true;
  createdAt: string;
}

/** Sanitize a user-supplied label to a short, safe display string. */
export function sanitizeLabel(raw: string | null | undefined): string {
  const cleaned = (raw ?? "").replace(/[^\p{L}\p{N} .,'()\-_/]/gu, "").trim().slice(0, 60);
  return cleaned || "Custom demo credential";
}

/**
 * Register `bytes` as a demo original. Anchors on HCS only when Hedera is
 * configured; otherwise stores the local issuance event (anchored:false), the
 * same offline-fixture behaviour the rest of the app uses.
 */
export async function registerDemoOriginal(
  bytes: Uint8Array,
  rawLabel: string | null | undefined,
): Promise<DemoRegistration> {
  const uploadedHash = sha256(bytes);
  const label = sanitizeLabel(rawLabel);
  const demoCredentialId = newDemoCredentialId();
  const now = new Date();

  await ensureIssuer(DEMO_ISSUER_ID, DEMO_ISSUER_NAME);

  await insertCredential({
    id: demoCredentialId,
    issuerId: DEMO_ISSUER_ID,
    studentName: label,
    courseName: "Custom Tamper Demo",
    grade: null,
    issuedAt: now,
    expiresAt: null,
    status: "ACTIVE",
    sha256: uploadedHash,
    source: "demo",
  });

  const eventId = `evt_${demoCredentialId}_ISSUED`;
  const issued = buildIssuedEvent({
    eventId,
    credentialId: demoCredentialId,
    issuerId: DEMO_ISSUER_ID,
    sha256: uploadedHash,
    issuedAt: now.toISOString(),
  });
  // Envelope carries a synthetic/demo marker (minimal proof only — no file bytes).
  const envelope = { ...issued, source: "demo" as const, synthetic: true };

  await insertCredentialEvent({
    id: eventId,
    type: "CREDENTIAL_ISSUED",
    credentialId: demoCredentialId,
    issuerId: DEMO_ISSUER_ID,
    sha256: uploadedHash,
    status: "ACTIVE",
    issuedAt: now,
    payload: envelope,
  });

  let anchored = false;
  let hcs: DemoHcsProof | null = null;

  if (serverConfig.hederaConfigured && serverConfig.hcsTopicId) {
    const topicId = serverConfig.hcsTopicId;
    const result = await submitEvent(topicId, envelope as unknown as HcsEvent);
    await insertHcsRecord({
      id: `hcs_${eventId}`,
      eventId,
      topicId,
      sequenceNumber: result.sequenceNumber,
      consensusTimestamp: result.consensusTimestamp ?? null,
      transactionId: result.transactionId,
      runningHash: result.runningHash ?? null,
    });
    anchored = true;
    hcs = {
      topicId,
      sequenceNumber: result.sequenceNumber,
      transactionId: result.transactionId,
      consensusTimestamp: result.consensusTimestamp ?? null,
      hashscanUrl: hashscanTransactionUrl(result.transactionId),
      topicUrl: hashscanTopicUrl(topicId),
    };
  }

  return {
    demoCredentialId,
    sha256: uploadedHash,
    issuerId: DEMO_ISSUER_ID,
    issuerName: DEMO_ISSUER_NAME,
    label,
    anchored,
    hcs,
    network: serverConfig.hederaNetwork,
    demo: true,
    synthetic: true,
    createdAt: now.toISOString(),
  };
}
