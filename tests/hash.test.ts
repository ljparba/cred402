/**
 * Hashing tests (plan §16 "Hashing"): same file → same hash, a one-byte change
 * flips the hash, and hash equality is case-insensitive.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256, hashesEqual } from "@/lib/verify/hash";

test("same bytes produce the same hash", () => {
  const a = new TextEncoder().encode("Cred402 certificate body");
  const b = new TextEncoder().encode("Cred402 certificate body");
  assert.equal(sha256(a), sha256(b));
});

test("known SHA-256 vector", () => {
  // echo -n "abc" | sha256sum
  assert.equal(
    sha256(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("a one-byte change flips the hash (tamper sensitivity)", () => {
  const original = new TextEncoder().encode("Grade: Distinction");
  const tampered = new TextEncoder().encode("Grade: Merit------");
  assert.notEqual(sha256(original), sha256(tampered));
});

test("hash is 64 lowercase hex chars", () => {
  const h = sha256(new Uint8Array([1, 2, 3]));
  assert.match(h, /^[0-9a-f]{64}$/);
});

test("hashesEqual is case-insensitive", () => {
  const h = sha256(new Uint8Array([9]));
  assert.ok(hashesEqual(h, h.toUpperCase()));
  assert.ok(!hashesEqual(h, "0".repeat(64)));
});
