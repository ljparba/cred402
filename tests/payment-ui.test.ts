/**
 * Payment UI failure-state guards (Phase 2, plan §7.3).
 *
 * Structural, source-level guards in the same lightweight style as
 * tests/frontend-layout.test.ts (the project has no DOM/E2E runner). They read
 * the payment page + component source and assert the safe failure behaviours are
 * wired: success only advances on a COMPLETE report, failures stay on the
 * payment screen, repeated clicks are disabled, an in-progress/pending state
 * never triggers a second payment, and no raw facilitator/secret text is shown.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
const page = read("src/app/page.tsx");
const payment = read("src/components/flow/Payment402.tsx");
const api = read("src/components/lib/api.ts");

test("a report only advances the flow when it is COMPLETE", () => {
  // advanceToReport gates on verdict + non-empty checks + payment before setStage.
  assert.match(page, /const advanceToReport = useCallback/);
  assert.match(page, /candidate\.verdict/);
  assert.match(page, /Array\.isArray\(candidate\.checks\)/);
  assert.match(page, /candidate\.checks\.length > 0/);
  assert.match(page, /if \(!complete\) return false/);
  // The engine/report stages only render when a report object exists.
  assert.match(page, /stage === "engine" && report/);
  assert.match(page, /stage === "report" && report/);
});

test("payment success advances to the report; failure stays on the payment stage", () => {
  // On success we call advanceToReport (→ engine). On any failure we call
  // failWith, which sets the phase back to "challenge" (stays on payment).
  assert.match(page, /if \(result\.ok\) \{[\s\S]*?advanceToReport\(result\.report\)/);
  assert.match(page, /const failWith = useCallback/);
  assert.match(page, /setPayPhase\("challenge"\)/);
  // A paid-but-incomplete report does NOT advance — it fails safe.
  assert.match(page, /if \(advanceToReport\(result\.report\)\) return;[\s\S]*?failWith\(undefined\)/);
});

test("repeated clicks cannot start a second payment while one is active", () => {
  // The handler guards on the in-flight phase…
  assert.match(page, /if \(payPhase === "paying" \|\| payPhase === "settling"\) return/);
  // …and the button is disabled while busy.
  assert.match(payment, /const busy = phase === "paying" \|\| phase === "settling"/);
  assert.match(payment, /onClick=\{onPay\}\s*\n?\s*disabled=\{busy\}/);
});

test("an expired / not-found request offers RE-UPLOAD, not another payment", () => {
  assert.match(page, /reupload = new Set\(\["REQUEST_EXPIRED", "REQUEST_NOT_FOUND", "PAYMENT_ALREADY_CONSUMED"\]\)/);
  assert.match(payment, /error\?\.action === "reupload"/);
  assert.match(payment, /onClick=\{onReupload\}/);
  assert.match(payment, /Re-upload to start over/);
});

test("an in-progress / pending state offers only a payment-FREE status check", () => {
  assert.match(page, /pending = new Set\(\["PAYMENT_IN_PROGRESS", "PAYMENT_CONFIRMATION_PENDING"\]\)/);
  // Check status re-reads the report resource with NO payment call.
  assert.match(page, /const checkStatus = useCallback/);
  assert.match(page, /api\.report\(preview\.requestId\)/);
  assert.doesNotMatch(
    page,
    /const checkStatus = useCallback[\s\S]*?api\.pay\(/,
    "checkStatus must never call api.pay",
  );
  assert.match(payment, /error\?\.action === "pending"/);
  assert.match(payment, /onClick=\{onCheckStatus\}/);
  assert.match(payment, /Check status/);
});

test("a rate-limited failure surfaces retry timing", () => {
  assert.match(page, /RATE_LIMITED/);
  assert.match(page, /Try again in ~\$\{retryAfter/);
  // api.pay reads the Retry-After header so the UI can show it.
  assert.match(api, /retryAfter: retryAfterHeader \? Number\(retryAfterHeader\) : undefined/);
});

test("the ?demo=1 fallback is used ONLY when settlement is unconfigured", () => {
  // Guarded by !settlementConfigured (preview.payment.configured), never as a
  // blanket fallback in configured mode.
  assert.match(page, /const settlementConfigured = preview\.payment\.configured/);
  assert.match(page, /if \(!result\.configured && !settlementConfigured\)/);
  assert.match(page, /api\.report\(preview\.requestId, \{ demo: true \}\)/);
});

test("no raw facilitator/secret error text is rendered — only safe fixed messages", () => {
  // The banner renders error.message, which failWith builds from fixed strings —
  // never the downstream error body. The component never renders a raw code.
  assert.match(payment, /\{error\.message\}/);
  assert.doesNotMatch(payment, /error\.code\}/, "the raw code is never rendered to the user");
  // The page maps codes to fixed copy, and never forwards result.error into the UI.
  assert.doesNotMatch(page, /message:\s*result\.error/);
});
