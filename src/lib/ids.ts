/**
 * Prefixed, URL-safe identifiers. Server-side only (uses node:crypto).
 */
import { randomBytes, randomUUID } from "node:crypto";

/** e.g. "vr_3f8a1c..." — a verification request id. */
export function newRequestId(): string {
  return `vr_${randomUUID().replace(/-/g, "")}`;
}

/** e.g. "pr_..." — a payment request id. */
export function newPaymentRequestId(): string {
  return `pr_${randomUUID().replace(/-/g, "")}`;
}

/** e.g. "st_..." — a settlement id. */
export function newSettlementId(): string {
  return `st_${randomUUID().replace(/-/g, "")}`;
}

/** e.g. "res_..." — a verification result id. */
export function newResultId(): string {
  return `res_${randomUUID().replace(/-/g, "")}`;
}

/** Opaque, resource-bound nonce carried in the 402 challenge. */
export function newNonce(): string {
  return randomBytes(24).toString("hex");
}

/** e.g. "CRED-DEMO-A1B2C3D4E5F6" — a Create-Tamper-Demo credential id (uppercase
 *  hex so it round-trips through the verify route's case-normalising sanitizer). */
export function newDemoCredentialId(): string {
  return `CRED-DEMO-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/** e.g. "rl_..." — a rate-limit hit row id. */
export function newRateLimitId(): string {
  return `rl_${randomUUID().replace(/-/g, "")}`;
}
