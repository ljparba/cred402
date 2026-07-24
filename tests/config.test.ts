/**
 * Config helper tests: tinybar → HBAR formatting (the x402 price display) and
 * the three INDEPENDENT capability flags (Phase 2, plan §13).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeConfigFlags, tinybarsToHbar } from "@/lib/config";

test("0.1 HBAR from 10_000_000 tinybars", () => {
  assert.equal(tinybarsToHbar("10000000"), "0.1");
});

test("whole HBAR has no fractional part", () => {
  assert.equal(tinybarsToHbar("100000000"), "1");
  assert.equal(tinybarsToHbar("500000000"), "5");
});

test("trailing zeros trimmed", () => {
  assert.equal(tinybarsToHbar("120000000"), "1.2");
  assert.equal(tinybarsToHbar("1"), "0.00000001");
});

test("zero", () => {
  assert.equal(tinybarsToHbar("0"), "0");
});

// ── Independent configuration flags (§13) ────────────────────────────────────

const OPERATOR = { HEDERA_OPERATOR_ID: "0.0.1001", HEDERA_OPERATOR_PRIVATE_KEY: "priv-op" };
const DEMO = { X402_DEMO_PAYER_ID: "0.0.2002", X402_DEMO_PAYER_PRIVATE_KEY: "priv-demo" };

test("nothing configured → all three flags false", () => {
  const f = computeConfigFlags({});
  assert.equal(f.hcsWriteConfigured, false);
  assert.equal(f.x402SettlementConfigured, false);
  assert.equal(f.demoWalletConfigured, false);
});

test("x402 settlement does NOT require the HCS operator private key", () => {
  // Only a recipient is set — no operator key at all.
  const f = computeConfigFlags({ X402_PAYMENT_RECIPIENT: "0.0.9999" });
  assert.equal(f.x402SettlementConfigured, true, "recipient + defaults are enough to settle");
  assert.equal(f.hcsWriteConfigured, false, "settlement is independent of HCS write capability");
  assert.equal(f.demoWalletConfigured, false, "still no demo payer keys");
});

test("HCS write requires operator id AND key, independently of settlement", () => {
  assert.equal(computeConfigFlags(OPERATOR).hcsWriteConfigured, true);
  assert.equal(
    computeConfigFlags({ HEDERA_OPERATOR_ID: "0.0.1001" }).hcsWriteConfigured,
    false,
    "operator id without the key is not HCS-write-configured",
  );
  // An operator id doubles as the default recipient, so settlement is on.
  assert.equal(computeConfigFlags(OPERATOR).x402SettlementConfigured, true);
});

test("demo wallet requires payer keys on top of settlement config", () => {
  const withoutDemo = computeConfigFlags({ X402_PAYMENT_RECIPIENT: "0.0.9999" });
  assert.equal(withoutDemo.demoWalletConfigured, false);

  const withDemo = computeConfigFlags({ X402_PAYMENT_RECIPIENT: "0.0.9999", ...DEMO });
  assert.equal(withDemo.demoWalletConfigured, true);
  assert.equal(withDemo.x402SettlementConfigured, true);

  // Demo payer keys WITHOUT a recipient cannot settle → demo wallet off.
  const demoNoRecipient = computeConfigFlags({ ...DEMO });
  assert.equal(demoNoRecipient.x402SettlementConfigured, false);
  assert.equal(demoNoRecipient.demoWalletConfigured, false);
});

test("empty-string env values are treated as unset", () => {
  const f = computeConfigFlags({ HEDERA_OPERATOR_ID: "", HEDERA_OPERATOR_PRIVATE_KEY: "" });
  assert.equal(f.hcsWriteConfigured, false);
});
