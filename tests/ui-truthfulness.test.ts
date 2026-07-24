/**
 * UI truthfulness guards.
 *
 * The public UI once carried claims the implementation does not support: invented
 * growth deltas (↑ 24.6% / ↑ 18.3% / ↑ 27.8%), a fixed "Avg. Verify Time 2.31s",
 * a "Fast Settlement ~2-5 seconds" promise, a blanket "Decentralized · Immutable"
 * badge, two payment buttons wired to the SAME handler (implying a choice of
 * payment methods that does not exist), and a fixed hero verdict that read as a
 * live result. These tests exist so none of that can come back.
 *
 * Two layers:
 *  1. Source guards (no DB) — the same lightweight structural style as
 *     tests/frontend-layout.test.ts: read the component/README/package source and
 *     assert the misleading tokens are absent and the precise ones are present.
 *  2. A real data test (isolated PGlite) — invokes GET /api/activity against a
 *     database whose contents this file controls, proving each displayed
 *     statistic maps to actual rows rather than a local constant, that the
 *     offline fixture fallback is flagged as a fixture, and that a FAILED
 *     settlement is never counted as a settlement.
 *
 * Fully OFFLINE: no live Hedera call, no payment, no deployed service.
 */
// Isolate the DB + force UNCONFIGURED before any config read (see the note in
// tests/lib/isolate-db.ts for why this must beat `.env`; nothing imported here
// loads `.env`, so a plain assignment is enough).
process.env.PGLITE_DATA_DIR ||= "./.pglite-uitest";
delete process.env.DATABASE_URL;
delete process.env.HEDERA_OPERATOR_ID;
delete process.env.HEDERA_OPERATOR_PRIVATE_KEY;
delete process.env.HEDERA_HCS_TOPIC_ID;

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { getDb, getDbBundle } from "@/lib/db";
import { registerDbTeardown } from "./lib/db-teardown";
import {
  createSettlement,
  createVerificationRequest,
  ensureIssuer,
  insertCredential,
  insertCredentialEvent,
  insertHcsRecord,
} from "@/lib/db/queries";
import { GET as activityGET } from "@/app/api/activity/route";
import type { ActivityStats } from "@/components/lib/api";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

const statCounters = read("src/components/sections/StatCounters.tsx");
const payment = read("src/components/flow/Payment402.tsx");
const hero = read("src/components/sections/Hero.tsx");
const page = read("src/app/page.tsx");
const activityRoute = read("src/app/api/activity/route.ts");
const howItWorks = read("src/components/sections/HowItWorksContent.tsx");
const uploadScan = read("src/components/flow/UploadScan.tsx");
const readme = read("README.md");
const pkg = JSON.parse(read("package.json")) as {
  engines?: { node?: string };
  scripts: Record<string, string>;
};

/**
 * Drop comments so the "this claim is gone" guards judge what a VISITOR sees,
 * not what the source says ABOUT the claims it removed — the components (and
 * this file) deliberately name the old wording in their doc comments.
 */
function visibleText(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Public UI + README copy, i.e. everything a visitor can end up reading. */
const PUBLIC_SOURCES: [string, string][] = [
  ["StatCounters", visibleText(statCounters)],
  ["Payment402", visibleText(payment)],
  ["Hero", visibleText(hero)],
  ["HowItWorksContent", visibleText(howItWorks)],
  ["UploadScan", visibleText(uploadScan)],
  ["README", readme],
];

// ── 1. Statistics: no invented numbers ────────────────────────────────────────

test("no hardcoded growth percentages anywhere in the public UI", () => {
  for (const [name, src] of PUBLIC_SOURCES) {
    for (const fake of ["24.6", "18.3", "27.8"]) {
      assert.ok(!src.includes(fake), `${name} still contains the invented delta ${fake}`);
    }
    // No "↑ <n>%" growth indicator, and no `delta` prop feeding one.
    assert.doesNotMatch(src, /↑\s*\{?\s*\d/, `${name} still renders a growth arrow`);
  }
  assert.doesNotMatch(statCounters, /\bdelta\b/, "the delta/growth prop must be gone");
});

test("the fixed 2.31s average verification time is gone", () => {
  for (const [name, src] of PUBLIC_SOURCES) {
    assert.ok(!src.includes("2.31"), `${name} still claims a 2.31s verification time`);
    assert.ok(!/Avg\.?\s*Verify\s*Time/i.test(src), `${name} still has an Avg. Verify Time stat`);
    assert.ok(
      !/average verification time/i.test(src),
      `${name} still claims an average verification time`,
    );
  }
  // The count-up card no longer has the decimals/suffix machinery that existed
  // only to render "2.31s" from the constant 231.
  assert.doesNotMatch(statCounters, /decimals/);
  assert.doesNotMatch(statCounters, /value=\{\d/, "stat values must never be numeric literals");
});

test("the four statistics carry the precise labels and bind to real API fields", () => {
  for (const label of [
    "Registered Credentials",
    "Verification Requests",
    "HCS Records",
    "x402 Settlements",
  ]) {
    assert.ok(statCounters.includes(`label="${label}"`), `missing the "${label}" statistic`);
  }
  // Each value reads a field off the /api/activity stats object.
  for (const field of [
    "registeredCredentials",
    "verificationRequests",
    "hcsRecords",
    "settlements",
  ]) {
    assert.match(
      statCounters,
      new RegExp(`value=\\{stats\\?\\.${field}`),
      `the ${field} statistic must come from the activity response`,
    );
    assert.ok(activityRoute.includes(field), `/api/activity must expose ${field}`);
  }
  // Wording that over-claims what the rows prove is not reintroduced.
  assert.ok(!statCounters.includes("Certificates Anchored"));
  assert.ok(!statCounters.includes("Completed Verifications"));
  assert.ok(!/label="HCS Events"/.test(statCounters));
});

test("statistics show an honest placeholder while loading or unavailable", () => {
  // No zero-filled stand-in object; the card renders "—" until data arrives.
  assert.doesNotMatch(statCounters, /stats \?\?\s*\{/);
  assert.match(statCounters, /ready \? formatCount\(animated\) : "—"/);
  assert.match(statCounters, /error \? "Unavailable" : "Loading"/);
  // Count-up only runs on real values.
  assert.match(statCounters, /useCountUp\(ready \? value : 0\)/);
  // A failed activity request is surfaced rather than swallowed into zeros.
  assert.match(page, /error: activityError/);
  assert.match(page, /<StatCounters stats=\{activity\?\.stats \?\? null\} error=\{activityError\}/);
  // Accessible label still describes each figure.
  assert.match(statCounters, /aria-label=\{`\$\{label\}/);
});

test("offline HCS fixtures are labelled as fixtures, never as live network data", () => {
  assert.match(activityRoute, /hcsSource: anchoredOnNetwork \? "network" : "fixture"/);
  assert.match(statCounters, /stats\.hcsSource === "network"/);
  assert.match(statCounters, /Local demo fixtures — not live network records/);
});

// ── 2. Payment UI ─────────────────────────────────────────────────────────────

test("exactly one primary payment action remains, and it names the demo wallet", () => {
  const handlers = payment.match(/onClick=\{onPay\}/g) ?? [];
  assert.equal(handlers.length, 1, `expected 1 payment action, found ${handlers.length}`);
  assert.match(payment, /Use Demo Wallet · \{price\} tHBAR/);
  // The price comes from the existing challenge/preview source, never a new literal.
  assert.match(payment, /const price =\s*\n?\s*preview\?\.payment\.amountHbar/);
  assert.ok(
    !visibleText(payment).includes("Pay with x402"),
    "the duplicate x402 button must stay removed",
  );
  // Behaviour is spelled out, and the secondary link targets a real anchor.
  assert.match(payment, /Testnet demo wallet/);
  assert.match(payment, /href="\/how-it-works#x402-flow"/);
  assert.match(howItWorks, /id="x402-flow"/);
});

test("no unmeasured settlement-speed promise survives", () => {
  for (const [name, src] of PUBLIC_SOURCES) {
    for (const claim of ["Fast Settlement", "2-5 seconds", "2–5 seconds"]) {
      assert.ok(!src.includes(claim), `${name} still promises "${claim}"`);
    }
  }
  // Replaced by an implemented property.
  assert.match(payment, /Mirror Verified/);
  assert.match(payment, /Independent confirmation/);
});

test("overbroad decentralization / immutability claims are replaced", () => {
  for (const [name, src] of PUBLIC_SOURCES) {
    assert.ok(!/decentrali[sz]ed/i.test(src), `${name} still claims decentralization`);
    assert.ok(!/\bimmutable\b/i.test(src), `${name} still claims immutability`);
    assert.ok(!/\btrustless\b/i.test(src), `${name} still claims trustlessness`);
  }
  assert.match(payment, /t: "HCS Record", s: "Tamper-evident"/);
  assert.match(payment, /t: "Public Evidence", s: "Hedera Testnet"/);
});

// ── 3. Hero sample state ──────────────────────────────────────────────────────

test("the fixed hero certificate state is labelled illustrative sample content", () => {
  assert.match(hero, /Illustrative preview/);
  assert.match(hero, /Sample anchored credential/);
  assert.match(hero, /not the result of a live\s+verification/);
  // The label sits before the sample hash/verdict it qualifies.
  const label = hero.indexOf("Illustrative preview");
  const verdict = hero.indexOf("Valid · Anchored on Hedera");
  assert.ok(label !== -1 && verdict !== -1);
  assert.ok(label < verdict, "the illustrative label must precede the sample verdict");
});

// ── 4. Package metadata ───────────────────────────────────────────────────────

test("package.json declares the Node.js 20+ engine the README requires", () => {
  assert.equal(pkg.engines?.node, ">=20");
  assert.match(readme, /Node\.js 20\+/);
});

test("this suite is wired into npm test", () => {
  assert.match(pkg.scripts.test, /tests\/ui-truthfulness\.test\.ts/);
});

// ── 5. Real data: every statistic maps to actual rows ─────────────────────────

before(async () => {
  const bundle = await getDbBundle();
  await bundle.migrate();
  // These tests assert exact counts, so they need a known-empty database. That is
  // safe here: `DATABASE_URL` is deleted above, so this can only ever be the
  // isolated embedded PGlite directory this file owns — never a real Postgres.
  assert.equal(bundle.driver, "pglite", "this suite only runs against an isolated PGlite DB");
  const db = await getDb();
  await db.execute(sql`
    truncate table issuers, credentials, credential_events, hcs_records,
      verification_requests, payment_settlements restart identity cascade
  `);
});

// Dispose the PGlite handle after the file so the test process exits naturally.
registerDbTeardown();

/** Call the real route handler and return its `stats` object. */
async function stats(): Promise<ActivityStats> {
  const res = await activityGET();
  const body = (await res.json()) as { stats: ActivityStats };
  return body.stats;
}

const ISSUER = "ISS-UI-TEST";
const CRED = "CRED-UI-TEST-0001";
const EVENT_ISSUED = "evt_ui_test_issued";
const EVENT_REVOKED = "evt_ui_test_revoked";
const REQUEST = "vr_ui_test";

test("an empty database reports zeros, with HCS marked as fixture data", async () => {
  const s = await stats();
  assert.deepEqual(s, {
    registeredCredentials: 0,
    verificationRequests: 0,
    hcsRecords: 0,
    hcsSource: "fixture",
    settlements: 0,
  });
});

test("credential + event rows drive the credential and (fixture) HCS counts", async () => {
  await ensureIssuer(ISSUER, "UI Truthfulness Test Issuer");
  await insertCredential({
    id: CRED,
    issuerId: ISSUER,
    studentName: "Sample Student",
    courseName: "Sample Course",
    issuedAt: new Date("2026-01-01T00:00:00Z"),
    status: "ACTIVE",
    sha256: "a".repeat(64),
  });
  for (const [id, type] of [
    [EVENT_ISSUED, "CREDENTIAL_ISSUED"],
    [EVENT_REVOKED, "CREDENTIAL_REVOKED"],
  ] as const) {
    await insertCredentialEvent({
      id,
      type,
      credentialId: CRED,
      issuerId: ISSUER,
      sha256: "a".repeat(64),
      payload: { type },
    });
  }

  const s = await stats();
  assert.equal(s.registeredCredentials, 1);
  // No real anchor yet → the local event mirror is shown, flagged as a fixture.
  assert.equal(s.hcsRecords, 2);
  assert.equal(s.hcsSource, "fixture");
});

test("a real HCS record switches the count to anchored network records", async () => {
  await insertHcsRecord({
    id: "hcs_ui_test",
    eventId: EVENT_ISSUED,
    topicId: "0.0.1234",
    sequenceNumber: 1,
    transactionId: "0.0.1234-1700000000-000000001",
  });

  const s = await stats();
  assert.equal(s.hcsSource, "network");
  assert.equal(s.hcsRecords, 1, "only genuinely anchored records count once any exist");
});

test("verification requests count while still locked; only SETTLED payments count", async () => {
  await createVerificationRequest({
    id: REQUEST,
    sha256: "b".repeat(64),
    nonce: "nonce_ui_test",
    nonceExpiresAt: new Date(Date.now() + 60_000),
    status: "AWAITING_PAYMENT",
  });

  const locked = await stats();
  assert.equal(locked.verificationRequests, 1, "unpaid requests are still requests");
  assert.equal(locked.settlements, 0);

  await createSettlement({
    id: "set_ui_test_failed",
    requestId: REQUEST,
    transactionId: "0.0.1234-1700000000-000000002",
    payTo: "0.0.5678",
    amount: "10000000",
    status: "FAILED",
  });
  assert.equal((await stats()).settlements, 0, "a FAILED settlement is not a settlement");

  await createSettlement({
    id: "set_ui_test_settled",
    requestId: REQUEST,
    transactionId: "0.0.1234-1700000000-000000003",
    payTo: "0.0.5678",
    amount: "10000000",
    mirrorVerified: true,
    status: "SETTLED",
  });
  assert.equal((await stats()).settlements, 1);
});
