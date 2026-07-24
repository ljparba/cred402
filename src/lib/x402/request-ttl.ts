/**
 * Request expiry (challenge freshness window) — NOT cryptographic binding.
 *
 * Each verification request is issued with an opaque expiry token and a
 * server-side TTL, advertised with the 402 challenge. IMPORTANT: the Hedera
 * `exact` scheme has no nonce field, so this value is NOT included in — and not
 * verified as part of — the signed payment payload (unlike EVM's
 * `authorization.nonce`). Calling it a "resource-bound nonce" would overstate
 * what it does. It is a SERVER-SIDE REQUEST TTL: it proves the buyer is acting
 * on a live, un-expired challenge, and nothing more.
 *
 * Replay protection does not depend on it. It comes from:
 *  - the DB-UNIQUE `payment_settlements.transaction_id` (first-use-wins: any
 *    settled tx unlocks exactly one report, ever),
 *  - the DB-UNIQUE settled `request_id` (one request settles at most once),
 *  - the atomic per-request payment claim (`payment_state`), and
 *  - independent Mirror Node verification of an exact-amount credit.
 */
import type { VerificationRequest } from "@/lib/db/schema";
import { updateVerificationRequest } from "@/lib/db/queries";

/** True once the request's TTL has elapsed. Paid requests ignore this entirely. */
export function isRequestExpired(request: VerificationRequest, now: Date = new Date()): boolean {
  return request.nonceExpiresAt.getTime() <= now.getTime();
}

/** Seconds of TTL left (0 once expired) — for honest "expires in" wording. */
export function secondsUntilExpiry(request: VerificationRequest, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((request.nonceExpiresAt.getTime() - now.getTime()) / 1000));
}

/**
 * Close out a request once its report has been released. The TTL is never
 * refreshed or extended anywhere — an expired unpaid request must be replaced
 * by a fresh upload.
 */
export async function markRequestCompleted(requestId: string): Promise<void> {
  await updateVerificationRequest(requestId, { status: "COMPLETED" });
}
