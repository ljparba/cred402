/**
 * Config helper tests: tinybar → HBAR formatting (the x402 price display).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tinybarsToHbar } from "@/lib/config";

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
