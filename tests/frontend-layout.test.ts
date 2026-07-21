/**
 * Frontend layout & navigation guards (refinement prompts §15 / final
 * security-docs prompt §10).
 *
 * This project has no browser/DOM/E2E test runner wired up (the suite is Node's
 * built-in runner + tsx, backend-focused). Rather than pull in jsdom + a React
 * testing stack just for a layout pass, these are lightweight STRUCTURAL guards:
 * they read the relevant component source and assert the specific refinements are
 * in place (and the removed things stay removed), so a future edit that silently
 * regresses one of them fails CI. They intentionally match on stable, meaningful
 * tokens (route hrefs, prop names, ordering of section labels, breakpoints) — not
 * brittle whitespace. The human-eye responsive checks are tracked in
 * docs/OWNER_ACCEPTANCE_TEST.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

const nav = read("src/components/layout/Nav.tsx");
const page = read("src/app/page.tsx");
const hero = read("src/components/sections/Hero.tsx");
const samples = read("src/components/sections/Samples.tsx");
const uploadScan = read("src/components/flow/UploadScan.tsx");
const report = read("src/components/flow/Report.tsx");
const systemLog = read("src/components/flow/SystemLog.tsx");
const verificationEngine = read("src/components/flow/VerificationEngine.tsx");
const tamperTeaser = read("src/components/sections/TamperDemoTeaser.tsx");

/** Index of the nth occurrence of a section label, or -1. */
function labelIndex(src: string, label: string): number {
  return src.indexOf(`<SectionLabel>${label}</SectionLabel>`);
}

// ── Navigation ────────────────────────────────────────────────────────────────

test("header logo is a real route link to `/` (not a scroll anchor)", () => {
  // The logo <Link> resolves to "/" and carries the home aria-label.
  assert.match(nav, /<Link\s+href="\/"[\s\S]*?aria-label="Cred402 home"/);
  // It is never a homepage scroll anchor like href="/#top".
  assert.doesNotMatch(nav, /href="\/#[^"]*"[\s\S]*?aria-label="Cred402 home"/);
});

test("logo supports an onLogoClick handler and the homepage wires it up", () => {
  assert.match(nav, /onLogoClick\?\s*:\s*\(\)\s*=>\s*void/);
  assert.match(nav, /onClick=\{\(\)\s*=>\s*\{[\s\S]*?onLogoClick\?\.\(\)/);
  assert.match(page, /<Nav[\s\S]*?onLogoClick=\{goHome\}/);
  // goHome returns to the landing stage + scrolls to top.
  assert.match(page, /const goHome = useCallback\([\s\S]*?setStage\("landing"\)/);
});

test("How it Works remains a real /how-it-works route in the nav", () => {
  assert.match(nav, /label:\s*"How it Works",\s*href:\s*"\/how-it-works"/);
});

test("Back to home is rendered near the TOP of the flow, not only the bottom", () => {
  // The control appears inside the flow container with a top-padding class,
  // before the AnimatePresence stages — i.e. above, not appended below.
  const backIdx = page.indexOf("← Back to home");
  const presenceIdx = page.indexOf("<AnimatePresence");
  assert.ok(backIdx !== -1, "back-to-home control missing");
  assert.ok(presenceIdx !== -1, "flow AnimatePresence missing");
  assert.ok(backIdx < presenceIdx, "back-to-home must render before the flow stages (top placement)");
  assert.match(page, /pt-6[\s\S]*?← Back to home/);
});

// ── Homepage ──────────────────────────────────────────────────────────────────

test("hero right column is Live Activity, and the redundant proof panel is gone", () => {
  assert.match(hero, /<LiveActivity[\s\S]*?items=\{activity\}/);
  // The old duplicated proof cards / network viz panel is removed from the hero.
  assert.doesNotMatch(hero, /PROOF_CARDS/);
  assert.doesNotMatch(hero, /HederaNetworkViz/);
  // The page feeds live activity into the hero.
  assert.match(page, /<Hero[\s\S]*?activity=\{activity\?\.items/);
});

test("homepage uses the 35/65 How It Works + Samples row", () => {
  assert.match(page, /lg:grid-cols-\[minmax\(0,35fr\)_minmax\(0,65fr\)\]/);
  const hiwIdx = page.indexOf("<HowItWorksPreview");
  const samplesIdx = page.indexOf("<Samples samples"); // the element, not <SamplesResponse>
  assert.ok(hiwIdx !== -1 && samplesIdx !== -1);
  assert.ok(hiwIdx < samplesIdx, "How It Works (35%) must come before Samples (65%)");
});

test("Tamper Demo section is present on the homepage", () => {
  assert.match(page, /import \{ TamperDemoTeaser \}/);
  assert.match(page, /<TamperDemoTeaser\s*\/>/);
  // It links into the full demo without duplicating the whole workflow.
  assert.match(tamperTeaser, /href="\/how-it-works#tamper-demo"/);
  assert.match(tamperTeaser, /Create Tamper Demo/);
});

test("sample actions are preserved on the homepage Samples grid", () => {
  assert.match(page, /<Samples[\s\S]*?onUseSample=\{handleUseSample\}/);
});

// ── Sample Certificate cards (final security/docs prompt §3) ───────────────────

test("sample grid: 1 col mobile, 2 col tablet/laptop, 3 col only at 1536px+", () => {
  // grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 — no lg/xl 3-up (cramped at 65%).
  assert.match(samples, /grid-cols-1[\s\S]*?md:grid-cols-2[\s\S]*?2xl:grid-cols-3/);
  assert.doesNotMatch(samples, /lg:grid-cols-3/);
  assert.doesNotMatch(samples, /grid-cols-4/);
});

test("sample card: the status badge is its own row ABOVE the title", () => {
  const badgeIdx = samples.indexOf("{s.category}");
  const titleIdx = samples.indexOf("{s.label}");
  assert.ok(badgeIdx !== -1 && titleIdx !== -1);
  assert.ok(badgeIdx < titleIdx, "status badge must render before (above) the title");
  // Sits on its own line (w-fit) rather than inline beside the title.
  assert.match(samples, /w-fit[\s\S]*?\{s\.category\}/);
});

test("sample primary button shows the full label (never truncated)", () => {
  assert.match(samples, /Use this sample/);
  assert.doesNotMatch(samples, /truncate">Use this sample/);
  // Title (2–3 lines) and description clamp cleanly instead of the button.
  assert.match(samples, /line-clamp-3[\s\S]*?\{s\.label\}/);
  assert.match(samples, /line-clamp-2[\s\S]*?\{s\.description\}/);
});

// ── Compact laptop header (final security/docs prompt §4) ──────────────────────

test("nav is mobile below 1024 (lg) and desktop at lg+ (no 768px desktop row)", () => {
  assert.match(nav, /lg:flex/); // desktop link row appears at lg
  assert.match(nav, /lg:hidden/); // menu toggle + drawer hide at lg
  assert.doesNotMatch(nav, /\bmd:/); // nothing keys off the 768px breakpoint
});

test("compact laptop header: shortened badge, compact verify, hidden redundant icon", () => {
  // Network badge shortened to "Hedera Testnet"; "Built on " only appears at 2xl.
  assert.match(nav, /2xl:inline">Built on <\/span>Hedera Testnet/);
  // Verify pill shows from lg with compact padding, comfortable at 2xl.
  assert.match(nav, /lg:inline-flex 2xl:px-3\.5/);
  // The redundant circular Hedera icon is hidden at laptop widths (lg–xl).
  assert.match(nav, /lg:hidden 2xl:grid/);
});

// ── Upload / Scan ─────────────────────────────────────────────────────────────

test("upload sidebar order is Sample Files → Scan Process → Issuer Hints", () => {
  const files = labelIndex(uploadScan, "Sample Files");
  const process = labelIndex(uploadScan, "Scan Process");
  const hints = labelIndex(uploadScan, "Issuer Hints");
  assert.ok(files !== -1 && process !== -1 && hints !== -1, "a sidebar section is missing");
  assert.ok(files < process, "Sample Files must come before Scan Process");
  assert.ok(process < hints, "Scan Process must come before Issuer Hints");
});

test("the Sample Files `View All` link is removed and all samples render", () => {
  // No anchor/button element labelled "View All" survives.
  assert.doesNotMatch(uploadScan, /<a[^>]*>\s*View All/);
  // No longer capped to the first three samples…
  assert.doesNotMatch(uploadScan, /samples\.slice\(0,\s*3\)/);
  // …but shown in a controlled internal scroll instead.
  assert.match(uploadScan, /samples\.map\(\(s\)\s*=>/);
  assert.match(uploadScan, /max-h-\d[\s\S]*?overflow-y-auto/);
});

test("upload Sample Files scrolls only as a sidebar (xl+) — normal flow on mobile", () => {
  // The internal scroll is gated to xl (sidebar) so mobile keeps normal document
  // flow with no nested scroll trap (final security/docs prompt §5).
  assert.match(uploadScan, /xl:max-h-80 xl:overflow-y-auto/);
});

test("Begin Scan (and Continue) are full-width on mobile, natural width from sm up", () => {
  assert.match(uploadScan, /className="w-full sm:w-auto"[\s\S]*?onClick=\{onBeginScan\}/);
  assert.match(uploadScan, /w-full sm:w-auto"[\s\S]*?onClick=\{onContinue\}/);
});

// ── Final Report ──────────────────────────────────────────────────────────────

test("Reference Samples is removed from the final report", () => {
  assert.doesNotMatch(report, /Reference Samples/);
  assert.doesNotMatch(report, /function ReferenceRow/);
  // The props that only fed reference samples are gone from the component API.
  assert.doesNotMatch(report, /onUseSample/);
  assert.doesNotMatch(report, /samples:\s*SampleItem\[\]/);
});

test("report keeps the Credential · Verdict · Payment top row and checks/HCS below", () => {
  for (const label of ["Credential", "Payment Proof", "Verification Checks", "HCS Proof", "Verification Activity"]) {
    assert.ok(report.includes(label), `report is missing the ${label} panel`);
  }
  assert.match(report, /<VerdictSeal/);
  // Long technical values are still protected from overflow.
  assert.match(report, /break-all/);
  assert.match(report, /min-w-0/);
  assert.match(report, /CopyHash/);
});

test("report callers no longer pass the removed samples/onUseSample props", () => {
  assert.match(page, /<Report report=\{report\} preview=\{preview\} onVerifyAnother=\{verifyAnother\} \/>/);
  const tamperDemo = read("src/components/demo/TamperDemo.tsx");
  assert.match(tamperDemo, /<Report report=\{report\} preview=\{preview\} onVerifyAnother=\{restart\} \/>/);
});

// ── Mobile scan progress ──────────────────────────────────────────────────────

test("system log scrolls its own container, never the window", () => {
  // No active scrollIntoView() call (which scrolls every ancestor incl. window).
  assert.doesNotMatch(systemLog, /\.scrollIntoView\s*\(/);
  assert.match(systemLog, /scrollRef/);
  assert.match(systemLog, /el\.scrollTop = el\.scrollHeight/);
});

test("scan-progress layout has no fixed/full-viewport scroll trap", () => {
  for (const trap of ["position: fixed", "fixed inset-0", "h-screen", "100vh"]) {
    assert.ok(!verificationEngine.includes(trap), `VerificationEngine must not use ${trap}`);
    assert.ok(!systemLog.includes(trap), `SystemLog must not use ${trap}`);
  }
});

test("verification progress stacks title → preview → progress → logs → proof on mobile", () => {
  const preview = verificationEngine.indexOf("Certificate Preview");
  const progress = verificationEngine.indexOf("Overall Progress");
  const logs = verificationEngine.indexOf("<SystemLog");
  const proof = verificationEngine.indexOf("Proof &amp; Trace");
  assert.ok(preview !== -1 && progress !== -1 && logs !== -1 && proof !== -1);
  assert.ok(preview < progress, "certificate preview + checks come before overall progress");
  assert.ok(progress < logs, "overall progress comes before the live logs");
  assert.ok(logs < proof, "live logs come before proof & trace");
});

test("verification progress protects long values (min-w-0 + safe wrapping)", () => {
  assert.match(verificationEngine, /min-w-0/);
  assert.match(verificationEngine, /break-all|break-words|truncate/);
  // The log line text can shrink/ellipsize instead of forcing width.
  assert.match(systemLog, /min-w-0 truncate/);
});
