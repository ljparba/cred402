/**
 * HTTP helper tests (Phase 2, plan §8–§10): the early request-size guard, the
 * private no-store headers, and a structural check that the baseline security
 * headers are configured. Pure — no DB, no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextRequest } from "next/server";
import {
  enforceRequestSize,
  markPrivate,
  PRIVATE_NO_STORE,
  apiError,
} from "@/lib/http";

/** Minimal NextRequest stand-in: only `headers` is read by enforceRequestSize. */
function reqWith(contentLength: string | null): NextRequest {
  const headers = new Headers();
  if (contentLength !== null) headers.set("content-length", contentLength);
  return { headers } as unknown as NextRequest;
}

const MAX_REQUEST = 6 * 1024 * 1024; // e.g. 5 MB file + 1 MB multipart headroom

// ── Early request-size guard (§8) ───────────────────────────────────────────────

test("a clearly-oversized declared body is rejected 413 before parsing", async () => {
  const res = enforceRequestSize(reqWith(String(MAX_REQUEST + 1)), MAX_REQUEST);
  assert.ok(res, "an oversized declared body returns a response");
  assert.equal(res!.status, 413);
  const body = (await res!.json()) as { code?: string };
  assert.equal(body.code, "PAYLOAD_TOO_LARGE");
});

test("a missing Content-Length is allowed through to the file-level check", () => {
  assert.equal(enforceRequestSize(reqWith(null), MAX_REQUEST), null);
});

test("an unparseable Content-Length is allowed through (not a bypass of file checks)", () => {
  assert.equal(enforceRequestSize(reqWith("not-a-number"), MAX_REQUEST), null);
});

test("a small/understated Content-Length is allowed (real bytes decide later)", () => {
  // A near-limit multipart body must NOT be rejected only for encoding overhead.
  assert.equal(enforceRequestSize(reqWith(String(MAX_REQUEST)), MAX_REQUEST), null);
  assert.equal(enforceRequestSize(reqWith("100"), MAX_REQUEST), null);
});

// ── Private no-store headers (§9) ────────────────────────────────────────────────

test("markPrivate stamps private, no-store + Pragma", () => {
  const res = apiError("x", 400, { code: "X" });
  markPrivate(res);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(res.headers.get("pragma"), "no-cache");
});

test("PRIVATE_NO_STORE never marks a response public or cacheable", () => {
  assert.match(PRIVATE_NO_STORE["Cache-Control"], /no-store/);
  assert.match(PRIVATE_NO_STORE["Cache-Control"], /private/);
  assert.ok(!/public/.test(PRIVATE_NO_STORE["Cache-Control"]));
});

test("the private handler is used by every user-data route", () => {
  const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
  const routes = [
    "src/app/api/verify/route.ts",
    "src/app/api/pay/route.ts",
    "src/app/api/report/[requestId]/route.ts",
    "src/app/api/demo/register/route.ts",
    "src/app/api/demo/[demoCredentialId]/route.ts",
  ];
  for (const r of routes) {
    assert.match(read(r), /safePrivateHandler/, `${r} must use safePrivateHandler`);
  }
});

// ── Baseline security headers (§10) ──────────────────────────────────────────────

test("next.config declares the four baseline security headers globally", () => {
  const cfg = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
  assert.match(cfg, /X-Content-Type-Options["\s:,]+.*nosniff/);
  assert.match(cfg, /Referrer-Policy["\s:,]+.*strict-origin-when-cross-origin/);
  assert.match(cfg, /Permissions-Policy["\s:,]+.*camera=\(\), microphone=\(\), geolocation=\(\)/);
  assert.match(cfg, /X-Frame-Options["\s:,]+.*DENY/);
  // Applied to every path, and NO new CSP header introduced in this phase.
  assert.match(cfg, /source:\s*["']\/:path\*["']/);
  assert.ok(
    !/key:\s*["']Content-Security-Policy/i.test(cfg),
    "no CSP header is added in this phase",
  );
});
