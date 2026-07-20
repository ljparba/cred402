/**
 * Hedera helper tests (plan §16 "HCS"): the Mirror-Node dashed tx-id conversion
 * (a real bug was caught here — the first dot in the account id must survive),
 * HashScan URL formats, and HCS envelope builder shapes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { toDashedTxId } from "@/lib/hedera/mirror";
import {
  hashscanTransactionUrl,
  hashscanTopicUrl,
  hashscanAccountUrl,
} from "@/lib/hedera/hashscan";
import { buildIssuedEvent, buildRevokedEvent } from "@/lib/hedera/types";

test("toDashedTxId converts @-form to dashed, preserving the account id dots", () => {
  assert.equal(
    toDashedTxId("0.0.1234@1690000000.000000001"),
    "0.0.1234-1690000000-000000001",
  );
});

test("toDashedTxId is idempotent on already-dashed ids", () => {
  const dashed = "0.0.1234-1690000000-000000001";
  assert.equal(toDashedTxId(dashed), dashed);
});

test("toDashedTxId accepts a TransactionId-like object", () => {
  const idish = { toString: () => "0.0.9@1700000000.5" };
  assert.equal(toDashedTxId(idish), "0.0.9-1700000000-5");
});

test("HashScan URLs use the testnet base and correct paths", () => {
  assert.equal(
    hashscanTransactionUrl("0.0.1-2-3", "https://hashscan.io/testnet"),
    "https://hashscan.io/testnet/transaction/0.0.1-2-3",
  );
  assert.equal(
    hashscanTopicUrl("0.0.42", "https://hashscan.io/testnet"),
    "https://hashscan.io/testnet/topic/0.0.42",
  );
  assert.equal(
    hashscanAccountUrl("0.0.98", "https://hashscan.io/testnet"),
    "https://hashscan.io/testnet/account/0.0.98",
  );
});

test("buildIssuedEvent omits expiresAt when absent (matches seed envelopes)", () => {
  const withExpiry = buildIssuedEvent({
    eventId: "evt_CRED-1_ISSUED",
    credentialId: "CRED-1",
    issuerId: "ISS-1",
    sha256: "a".repeat(64),
    issuedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2029-01-01T00:00:00Z",
  });
  assert.equal(withExpiry.type, "CREDENTIAL_ISSUED");
  assert.equal(withExpiry.v, 1);
  assert.equal(withExpiry.expiresAt, "2029-01-01T00:00:00Z");

  const noExpiry = buildIssuedEvent({
    eventId: "evt_CRED-2_ISSUED",
    credentialId: "CRED-2",
    issuerId: "ISS-1",
    sha256: "b".repeat(64),
    issuedAt: "2026-01-01T00:00:00Z",
    expiresAt: null,
  });
  // JSON.stringify must drop the undefined key entirely.
  assert.ok(!("expiresAt" in JSON.parse(JSON.stringify(noExpiry))));
});

test("buildRevokedEvent chains to the issuance event", () => {
  const ev = buildRevokedEvent({
    eventId: "evt_CRED-1_REVOKED",
    credentialId: "CRED-1",
    issuerId: "ISS-1",
    sha256: "a".repeat(64),
    revokedAt: "2026-02-01T00:00:00Z",
    prevEventId: "evt_CRED-1_ISSUED",
  });
  assert.equal(ev.type, "CREDENTIAL_REVOKED");
  assert.equal(ev.status, "REVOKED");
  assert.equal(ev.prevEventId, "evt_CRED-1_ISSUED");
});
