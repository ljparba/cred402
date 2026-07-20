/**
 * SHA-256 hashing of uploaded files. Server-side only. Works on a Buffer or
 * Uint8Array held in memory — we never persist the raw upload to disk.
 */
import { createHash } from "node:crypto";

/** Lowercase 64-char hex SHA-256 of the given bytes. */
export function sha256(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** True if two hashes match, case-insensitively and constant-ish comparison. */
export function hashesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
