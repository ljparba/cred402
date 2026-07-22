/**
 * Frontend layout & navigation guards.
 *
 * This project has no browser/DOM/E2E test runner wired up (the suite is Node's
 * built-in runner + tsx, backend-focused). Rather than pull in jsdom + a React
 * testing stack just for a layout pass, these are lightweight STRUCTURAL guards:
 * they read the relevant component source and assert the specific refinements are
 * in place (and the removed things stay removed), so a future edit that silently
 * regresses one of them fails CI. They intentionally match on stable, meaningful
 * tokens (route hrefs, prop names, ordering of section labels, breakpoints) — not
 * brittle whitespace. The human-eye responsive/visual checks are a manual,
 * owner-run pass, not part of this automated suite.
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
const uploadDropzone = read("src/components/flow/UploadDropzone.tsx");
const stepProgress = read("src/components/flow/StepProgress.tsx");
const certScanner = read("src/components/viz/CertScanner.tsx");
const report = read("src/components/flow/Report.tsx");
const systemLog = read("src/components/flow/SystemLog.tsx");
const verificationEngine = read("src/components/flow/VerificationEngine.tsx");
const tamperTeaser = read("src/components/sections/TamperDemoTeaser.tsx");
const payment = read("src/components/flow/Payment402.tsx");
const paymentFlow = read("src/components/viz/PaymentFlow.tsx");
const footer = read("src/components/layout/Footer.tsx");
const statusBar = read("src/components/layout/NetworkStatusBar.tsx");
const copyHash = read("src/components/ui/CopyHash.tsx");
const tamperDemo = read("src/components/demo/TamperDemo.tsx");
const anchorProgress = read("src/components/demo/AnchorProgress.tsx");
const hashDiff = read("src/components/report/HashDiff.tsx");

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

// ── Mobile width-overflow root-cause fix (mobile-width-overflow prompt) ────────

/** No fixed-pixel width utilities (only the page container's max-w-[1440px]). */
function assertNoFixedWidths(name: string, src: string) {
  assert.doesNotMatch(src, /\bmin-w-\[/, `${name}: no fixed min-width utilities on mobile`);
  assert.doesNotMatch(src, /minWidth/, `${name}: no inline minWidth`);
  for (const w of src.match(/\b(?:w|max-w)-\[[^\]]+\]/g) ?? []) {
    assert.equal(w, "max-w-[1440px]", `${name}: unexpected fixed width utility ${w}`);
  }
}

test("scan states carry no fixed-pixel/min widths that can overflow mobile", () => {
  assertNoFixedWidths("UploadScan", uploadScan);
  assertNoFixedWidths("VerificationEngine", verificationEngine);
  assertNoFixedWidths("StepProgress", stepProgress);
  assertNoFixedWidths("CertScanner", certScanner);
  assertNoFixedWidths("UploadDropzone", uploadDropzone);
  assertNoFixedWidths("SystemLog", systemLog);
});

test("upload main grid is one column by default; 3-col only at xl, and shrink-safe", () => {
  assert.match(uploadScan, /grid w-full min-w-0 max-w-full grid-cols-1[\s\S]*?xl:grid-cols-\[/);
  // No earlier (md/lg) multi-column activation for the main workspace grid.
  assert.doesNotMatch(uploadScan, /(?:md|lg):grid-cols-\[minmax/);
});

test("upload direct grid children + scanner grid are w-full/min-w-0/max-w-full", () => {
  // Dropzone card, centre column, sidebar column, and the inner scanner grid.
  const shrinkSafe = uploadScan.match(/w-full min-w-0 max-w-full/g) ?? [];
  assert.ok(shrinkSafe.length >= 5, `expected several shrink-safe wrappers, got ${shrinkSafe.length}`);
  // The inner scanner grid is single column on mobile, 2-up only from sm.
  assert.match(uploadScan, /grid w-full min-w-0 max-w-full grid-cols-1 items-center[\s\S]*?sm:grid-cols-\[/);
});

test("step progress is a shrink-safe 4-col grid with no fixed-width connectors", () => {
  assert.match(stepProgress, /grid w-full min-w-0 max-w-full grid-cols-4/);
  assert.match(stepProgress, /min-w-0[\s\S]*?flex-col/); // each step shrinks
  // The old fixed-width connectors (w-8 / sm:w-14) are gone.
  assert.doesNotMatch(stepProgress, /w-8 sm:w-14/);
  assert.doesNotMatch(stepProgress, /\bw-14\b/);
});

test("dropzone selected filename wraps instead of forcing width", () => {
  assert.match(uploadDropzone, /break-words[\s\S]*?selected\.name/);
});

test("certificate preview media is shrink-safe (max-w-full, capped only from sm)", () => {
  assert.match(certScanner, /w-full min-w-0 max-w-full[\s\S]*?sm:max-w-md/);
  // Never an unconditional max-w-md that could exceed a narrow parent.
  assert.doesNotMatch(certScanner, /w-full max-w-md\b/);
  assert.match(certScanner, /block h-full w-full max-w-full/); // the SVG itself
});

test("verification progress main grid is one column by default; 3-col only at xl", () => {
  assert.match(verificationEngine, /grid w-full min-w-0 max-w-full grid-cols-1[\s\S]*?xl:grid-cols-\[/);
  assert.doesNotMatch(verificationEngine, /(?:md|lg):grid-cols-\[minmax/);
});

test("verification check cards are full-width and shrink-safe", () => {
  assert.match(verificationEngine, /w-full min-w-0 max-w-full overflow-hidden rounded-xl border/);
  // check label + evidence wrap rather than forcing width
  assert.match(verificationEngine, /min-w-0 break-words text-sm font-semibold/);
  assert.match(verificationEngine, /break-words text-xs leading-relaxed/);
});

test("system log panel is contained and scrolls its own container", () => {
  assert.match(systemLog, /w-full min-w-0 max-w-full[\s\S]*?overflow-hidden[\s\S]*?rounded-2xl/);
  assert.doesNotMatch(systemLog, /\.scrollIntoView\s*\(/);
  assert.match(systemLog, /el\.scrollTop = el\.scrollHeight/);
});

// ── Payment / 402 page mobile (final payment-footer prompt §3–§9) ──────────────

test("payment page has no fixed-pixel/min widths that can overflow mobile", () => {
  assertNoFixedWidths("Payment402", payment);
  assertNoFixedWidths("PaymentFlow", paymentFlow);
});

test("payment main grid is one column by default; 3-col only at xl", () => {
  assert.match(payment, /grid w-full min-w-0 max-w-full grid-cols-1[\s\S]*?xl:grid-cols-\[/);
  assert.doesNotMatch(payment, /(?:md|lg):grid-cols-\[minmax/);
  // Several shrink-safe wrappers/cards.
  const shrinkSafe = payment.match(/w-full min-w-0 max-w-full/g) ?? [];
  assert.ok(shrinkSafe.length >= 6, `expected several shrink-safe payment wrappers, got ${shrinkSafe.length}`);
});

test("payment stepper is a shrink-safe 4-col grid (no fixed-width connectors)", () => {
  assert.match(payment, /grid w-full min-w-0 max-w-full grid-cols-4/);
  // The old justify-between/flex-1 intrinsic-width rail is gone.
  assert.doesNotMatch(payment, /<ol className="flex items-start justify-between/);
});

test("wallet/API/Hedera diagram is a shrink-safe 3-col grid with min-w-0 nodes", () => {
  assert.match(paymentFlow, /grid w-full min-w-0 max-w-full grid-cols-3/);
  assert.match(paymentFlow, /flex min-w-0 max-w-full flex-col items-center/); // each node
  // Circles scale down on mobile (no single oversized fixed circle).
  assert.match(paymentFlow, /h-14 w-14[\s\S]*?sm:h-20 sm:w-20/);
});

test("payment buttons are full-width on mobile and keep their full labels", () => {
  assert.match(payment, /className="w-full min-w-0"[\s\S]*?Pay with x402/);
  assert.match(payment, /className="w-full min-w-0"[\s\S]*?Use Demo Wallet/);
});

test("transaction preview rows stack on mobile (label above value)", () => {
  assert.match(payment, /flex flex-col items-start[\s\S]*?sm:flex-row/);
  // Long technical values wrap safely; copy button icons stay shrink-0.
  assert.match(payment, /break-all font-mono/);
  assert.match(copyHash, /shrink-0/);
});

// ── Footer & bottom status bar mobile (final payment-footer prompt §10–§11) ────

test("footer stacks on mobile and the nav is a 2-col grid before going inline", () => {
  assert.match(footer, /flex w-full min-w-0 max-w-full flex-col[\s\S]*?md:flex-row/);
  assert.match(footer, /grid w-full min-w-0 max-w-full grid-cols-2[\s\S]*?sm:flex/);
});

test("footer testnet disclaimer is a full-width wrap-safe block, not content-width", () => {
  assert.match(footer, /flex w-full max-w-full items-start gap-2 break-words[\s\S]*?Testnet proof of concept/);
  // No longer an inline-flex pill sized by its own text.
  assert.doesNotMatch(footer, /inline-flex[^"]*Testnet proof/);
});

test("bottom status bar is non-sticky on mobile and sticky only at desktop", () => {
  assert.match(statusBar, /lg:sticky lg:bottom-0/);
  // Not stuck to the viewport at mobile widths…
  assert.doesNotMatch(statusBar, /(?<!lg:)sticky bottom-0/);
  // …and never position:fixed / a fixed footer.
  assert.doesNotMatch(statusBar, /position:\s*fixed|fixed inset|\bfixed bottom-0/);
});

test("status items wrap safely; HashScan gets its own full-width mobile row", () => {
  assert.match(statusBar, /grid w-full min-w-0 max-w-full grid-cols-1[\s\S]*?sm:grid-cols-2/);
  assert.match(statusBar, /break-all font-mono/); // long mirror/facilitator values
  assert.match(statusBar, /w-full shrink-0[\s\S]*?lg:w-auto[\s\S]*?View on HashScan/);
  // No internal horizontal scroll strip anymore.
  assert.doesNotMatch(statusBar, /overflow-x-auto/);
});

// ── Tamper Demo mobile full-width (tamper-demo-mobile prompt §5–§13) ───────────

test("tamper demo has no fixed-pixel/min widths that can overflow mobile", () => {
  assertNoFixedWidths("TamperDemo", tamperDemo);
  assertNoFixedWidths("AnchorProgress", anchorProgress);
});

test("tamper demo step rail is a shrink-safe grid (2 → 3 → 6 cols)", () => {
  assert.match(tamperDemo, /grid w-full min-w-0 max-w-full grid-cols-2[\s\S]*?sm:grid-cols-3[\s\S]*?lg:grid-cols-6/);
  // Labels are visible + wrap (no longer hidden behind sm:).
  assert.doesNotMatch(tamperDemo, /hidden sm:inline">\{label\}/);
});

test("tamper demo step containers default to one column and cards are contained", () => {
  // grid-cols-1 (not the default single `auto` column) up to lg — a real overflow source.
  assert.match(tamperDemo, /grid w-full min-w-0 max-w-full grid-cols-1 gap-6 lg:grid-cols-2/);
  const contained = tamperDemo.match(/w-full min-w-0 max-w-full overflow-hidden/g) ?? [];
  assert.ok(contained.length >= 5, `expected several contained cards, got ${contained.length}`);
});

test("tamper demo Demo ID / hash fields wrap (break-all), never truncate", () => {
  assert.match(tamperDemo, /<CopyHash value=\{value\} full wrap/);
  assert.match(copyHash, /wrap \? "break-all" : "truncate"/);
  assert.match(copyHash, /shrink-0/);
});

test("tamper demo anchor-progress rows are shrink-safe (items-start + break-words)", () => {
  assert.match(anchorProgress, /flex min-w-0 max-w-full items-start gap-3/);
  assert.match(anchorProgress, /min-w-0 break-words text-sm/);
  assert.match(anchorProgress, /shrink-0/);
});

test("tamper demo instruction rows + label chips wrap safely", () => {
  assert.match(tamperDemo, /flex min-w-0 max-w-full items-start gap-3[\s\S]*?min-w-0 break-words">\{t\}/);
  assert.match(tamperDemo, /flex w-full min-w-0 max-w-full flex-wrap gap-1\.5/); // label chips
});

test("tamper demo CTA buttons are full-width and allow wrapped text", () => {
  const wrapped = tamperDemo.match(/w-full min-w-0 max-w-full whitespace-normal text-center/g) ?? [];
  assert.ok(wrapped.length >= 3, `expected several wrappable CTA buttons, got ${wrapped.length}`);
  // The over-long label was shortened.
  assert.doesNotMatch(tamperDemo, /I&apos;ve modified my copy/);
  assert.match(tamperDemo, /Continue with modified copy/);
});

test("tamper demo diff view is contained and wraps its byte chips", () => {
  assert.match(hashDiff, /w-full min-w-0 max-w-full overflow-hidden rounded-xl/);
  assert.match(hashDiff, /flex min-w-0 flex-wrap gap-1/);
});

test("tamper demo flow uses no fixed/100vh/body-lock/sticky trap", () => {
  for (const trap of ["position: fixed", "fixed inset-0", "h-screen", "100vh", "sticky"]) {
    assert.ok(!tamperDemo.includes(trap), `TamperDemo must not use ${trap}`);
  }
});
