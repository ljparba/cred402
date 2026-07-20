/**
 * Resource-bound nonce helpers (plan §3.5, layer 4).
 *
 * A nonce is issued with the verification request and carried in the 402
 * challenge with a TTL. IMPORTANT: the Hedera `exact` scheme has no nonce field
 * and cannot cryptographically bind the nonce into the signed TransferTransaction
 * (unlike EVM's `authorization.nonce`). The nonce therefore provides only
 * challenge FRESHNESS / TTL here — it proves the buyer is acting on a live,
 * un-expired challenge, not a stale one.
 *
 * The PRIMARY replay protection is layers 1–3:
 *  - the DB-UNIQUE `payment_settlements.transaction_id` (first-use-wins: any
 *    settled tx unlocks exactly one report, ever), and
 *  - independent Mirror Node verification of an exact-amount credit.
 *
 * These stand regardless of the nonce, so the residual scheme gap is closed.
 */
import type { VerificationRequest } from "@/lib/db/schema";
import { updateVerificationRequest } from "@/lib/db/queries";

/** True when the request's issued nonce has not yet expired. */
export function isRequestNonceValid(request: VerificationRequest, now: Date = new Date()): boolean {
  return request.nonceExpiresAt.getTime() > now.getTime();
}

/**
 * Burn the nonce for a request by marking it COMPLETED. Idempotent at the DB
 * layer (a plain status set); the settlement UNIQUE constraint is what actually
 * prevents a second report release for the same transaction.
 */
export async function burnNonce(requestId: string): Promise<void> {
  await updateVerificationRequest(requestId, { status: "COMPLETED" });
}
