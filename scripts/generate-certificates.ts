/**
 * Certificate + demo-data generator (Phase 3).
 *
 *   npm run certs:generate      (→ npx tsx scripts/generate-certificates.ts)
 *
 * Renders a premium A4-landscape "Certificate of Achievement" PDF for every
 * credential in scripts/data/catalog.ts, plus the flagship tamper pair and a
 * counterfeit sample, then writes the SHA-256 manifest consumed by seed.ts.
 *
 * DETERMINISM: pdf-lib normally stamps the current date into the Info dict
 * (CreationDate/ModDate/Producer) inside PDFDocument.create(). We overwrite all
 * of those with FIXED constants and use only StandardFonts (no subsetting, no
 * fontkit), so regenerating produces byte-identical files and stable hashes.
 * There is no per-run randomness anywhere in this script.
 *
 * Output shape (scripts/data/hashes.generated.json), matching seed.ts:
 *   { credentials: { <credentialId>: <sha256> }, samples: { <slug>: <sha256> } }
 */
import "./lib/env";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import {
  credentials,
  issuers,
  samples,
  type CatalogCredential,
} from "./data/catalog";

// ── Determinism anchors ──────────────────────────────────────────────────────
// A single fixed instant stamped into every PDF's Info dict. Any constant works;
// this project's "born-on" date keeps the intent obvious in a hex/metadata dump.
const FIXED_DATE = new Date("2026-07-20T00:00:00Z");
const PRODUCER = "Cred402 Certificate Generator";

// ── Palette + geometry (A4 landscape, points) ────────────────────────────────
const PAGE_W = 841.89;
const PAGE_H = 595.28;

const INK = rgb(0.09, 0.13, 0.22); // deep slate — body text
const MUTED = rgb(0.42, 0.47, 0.56); // secondary labels
const GOLD = rgb(0.72, 0.56, 0.22); // seal + accents
const GOLD_SOFT = rgb(0.86, 0.74, 0.42);
const NAVY = rgb(0.11, 0.19, 0.36); // header band + outer border
const PAPER = rgb(0.995, 0.992, 0.984); // warm off-white background
const HAIRLINE = rgb(0.8, 0.82, 0.86);

interface Fonts {
  serif: PDFFont; // Times-Roman   — body
  serifBold: PDFFont; // Times-Bold    — student name, headings
  serifItalic: PDFFont; // Times-Italic  — flourishes
  sans: PDFFont; // Helvetica     — labels
  sansBold: PDFFont; // Helvetica-Bold
  mono: PDFFont; // Courier       — credential id
}

interface CertContent {
  issuerName: string;
  studentName: string;
  courseName: string;
  grade: string;
  issuedAt: string; // ISO
  credentialId: string; // embedded in metadata + printed
  signatoryName: string;
  signatoryTitle: string;
}

// ── Small drawing helpers ────────────────────────────────────────────────────

/**
 * Total advance width of `text` including manual letter-spacing. pdf-lib
 * v1.17.1's drawText has no characterSpacing option, so we lay glyphs out
 * ourselves (below) and size the box the same way here.
 */
function spacedWidth(text: string, font: PDFFont, size: number, charSpacing: number): number {
  return font.widthOfTextAtSize(text, size) + charSpacing * Math.max(0, text.length - 1);
}

/** Draw left-aligned text with optional per-character spacing (glyph by glyph). */
function drawSpacedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB,
  charSpacing = 0,
): void {
  if (!charSpacing) {
    page.drawText(text, { x, y, size, font, color, lineHeight: size });
    return;
  }
  let cursor = x;
  for (const ch of text) {
    page.drawText(ch, { x: cursor, y, size, font, color, lineHeight: size });
    cursor += font.widthOfTextAtSize(ch, size) + charSpacing;
  }
}

function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  y: number,
  color: RGB,
  charSpacing = 0,
): void {
  const width = spacedWidth(text, font, size, charSpacing);
  drawSpacedText(page, text, (PAGE_W - width) / 2, y, font, size, color, charSpacing);
}

/** A short horizontal rule centred on the page, e.g. under section labels. */
function drawCenteredRule(page: PDFPage, y: number, halfWidth: number, color: RGB): void {
  page.drawLine({
    start: { x: PAGE_W / 2 - halfWidth, y },
    end: { x: PAGE_W / 2 + halfWidth, y },
    thickness: 1,
    color,
  });
}

/** Decorative double border with gold inner keyline and cut corners. */
function drawBorder(page: PDFPage): void {
  // Full-bleed warm paper background.
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });

  // Outer navy frame.
  const m1 = 22;
  page.drawRectangle({
    x: m1,
    y: m1,
    width: PAGE_W - 2 * m1,
    height: PAGE_H - 2 * m1,
    borderColor: NAVY,
    borderWidth: 3,
  });

  // Inner gold keyline.
  const m2 = 32;
  page.drawRectangle({
    x: m2,
    y: m2,
    width: PAGE_W - 2 * m2,
    height: PAGE_H - 2 * m2,
    borderColor: GOLD,
    borderWidth: 1.25,
  });

  // Corner flourishes (small gold squares at the inner frame corners).
  const c = 8;
  for (const [cx, cy] of [
    [m2, m2],
    [PAGE_W - m2, m2],
    [m2, PAGE_H - m2],
    [PAGE_W - m2, PAGE_H - m2],
  ] as const) {
    page.drawRectangle({
      x: cx - c / 2,
      y: cy - c / 2,
      width: c,
      height: c,
      color: GOLD,
      rotate: degrees(45),
    });
  }
}

/** A faux embossed wax/foil seal with concentric rings and a star. */
function drawSeal(page: PDFPage, cx: number, cy: number, fonts: Fonts): void {
  page.drawCircle({ x: cx, y: cy, size: 38, color: GOLD_SOFT });
  page.drawCircle({ x: cx, y: cy, size: 38, borderColor: GOLD, borderWidth: 2 });
  page.drawCircle({ x: cx, y: cy, size: 30, borderColor: NAVY, borderWidth: 1 });

  // Five-point star from a unit template.
  const star: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    const outer = (Math.PI / 2) + (i * 2 * Math.PI) / 5;
    const inner = outer + Math.PI / 5;
    star.push([Math.cos(outer), Math.sin(outer)]);
    star.push([0.5 * Math.cos(inner), 0.5 * Math.sin(inner)]);
  }
  const R = 16;
  for (let i = 0; i < star.length; i++) {
    const [ax, ay] = star[i];
    const [bx, by] = star[(i + 1) % star.length];
    page.drawLine({
      start: { x: cx + ax * R, y: cy + ay * R },
      end: { x: cx + bx * R, y: cy + by * R },
      thickness: 1,
      color: NAVY,
    });
  }

  drawCentered(page, "VERIFIED", fonts.sansBold, 6, cy - 52, GOLD, 1.2);
}

// ── Certificate composition ──────────────────────────────────────────────────

function formatIssueDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${month} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function composeCertificate(page: PDFPage, fonts: Fonts, c: CertContent): void {
  drawBorder(page);

  // Institution header band.
  drawCentered(page, c.issuerName.toUpperCase(), fonts.sansBold, 15, PAGE_H - 92, NAVY, 3);
  drawCentered(page, "OFFICE OF THE REGISTRAR", fonts.sans, 8, PAGE_H - 108, MUTED, 2);
  drawCenteredRule(page, PAGE_H - 122, 150, HAIRLINE);

  // Title.
  drawCentered(page, "Certificate of Achievement", fonts.serifBold, 34, PAGE_H - 172, INK);
  drawCentered(page, "This is to certify that", fonts.serifItalic, 15, PAGE_H - 208, MUTED);

  // Recipient.
  drawCentered(page, c.studentName, fonts.serifBold, 30, PAGE_H - 252, NAVY);
  drawCenteredRule(page, PAGE_H - 266, 220, GOLD);

  // Course line.
  drawCentered(page, "has successfully completed the course", fonts.serif, 14, PAGE_H - 296, INK);
  drawCentered(page, c.courseName, fonts.serifBold, 20, PAGE_H - 326, INK);

  // Grade + issue date pair, spaced across the lower third.
  const rowY = PAGE_H - 380;
  const leftX = PAGE_W / 2 - 190;
  const rightX = PAGE_W / 2 + 40;

  drawSpacedText(page, "GRADE AWARDED", leftX, rowY + 16, fonts.sansBold, 8, MUTED, 1.5);
  page.drawText(c.grade, { x: leftX, y: rowY - 6, size: 16, font: fonts.serifBold, color: INK });

  drawSpacedText(page, "DATE OF ISSUE", rightX, rowY + 16, fonts.sansBold, 8, MUTED, 1.5);
  page.drawText(formatIssueDate(c.issuedAt), { x: rightX, y: rowY - 6, size: 16, font: fonts.serifBold, color: INK });

  // Seal, centred low.
  drawSeal(page, PAGE_W / 2, 148, fonts);

  // Signature block (bottom-right).
  const sigX = PAGE_W - 300;
  const sigBaseline = 116;
  page.drawText(c.signatoryName, { x: sigX + 24, y: sigBaseline + 6, size: 15, font: fonts.serifItalic, color: NAVY });
  page.drawLine({
    start: { x: sigX, y: sigBaseline },
    end: { x: sigX + 200, y: sigBaseline },
    thickness: 0.75,
    color: INK,
  });
  page.drawText(c.signatoryTitle, { x: sigX, y: sigBaseline - 14, size: 9, font: fonts.sans, color: MUTED });
  page.drawText(c.issuerName, { x: sigX, y: sigBaseline - 26, size: 9, font: fonts.sans, color: MUTED });

  // Machine-verifiable credential ID (bottom-left) — also embedded in metadata.
  const idX = 70;
  const idBaseline = 116;
  drawSpacedText(page, "CREDENTIAL ID", idX, idBaseline + 20, fonts.sansBold, 8, MUTED, 1.5);
  page.drawText(c.credentialId, { x: idX, y: idBaseline + 2, size: 13, font: fonts.mono, color: INK });
  page.drawText("Verify at cred402 · Hedera Consensus Service anchored", {
    x: idX,
    y: idBaseline - 14,
    size: 8,
    font: fonts.sans,
    color: MUTED,
  });
}

/**
 * Build a single certificate PDF. Deterministic: the only inputs are `content`;
 * dates/producer are fixed constants, and StandardFonts carry no randomness.
 */
async function renderCertificate(content: CertContent): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Retrievable metadata (Phase 4 reads keywords/subject back via pdf-lib).
  pdfDoc.setTitle(`Certificate of Achievement — ${content.studentName}`);
  pdfDoc.setAuthor(content.issuerName);
  pdfDoc.setSubject(content.credentialId);
  pdfDoc.setKeywords([content.credentialId]);
  pdfDoc.setCreator(PRODUCER);
  pdfDoc.setProducer(PRODUCER);

  // Freeze the Info-dict dates so hashes are stable across runs.
  pdfDoc.setCreationDate(FIXED_DATE);
  pdfDoc.setModificationDate(FIXED_DATE);

  const fonts: Fonts = {
    serif: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    serifBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    serifItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
    sansBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    mono: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  composeCertificate(page, fonts, content);

  // useObjectStreams:false keeps the byte layout simple + stable.
  return pdfDoc.save({ useObjectStreams: false });
}

// ── Catalog → certificate content ────────────────────────────────────────────

function issuerNameFor(issuerId: string): string {
  const iss = issuers.find((i) => i.id === issuerId);
  if (!iss) throw new Error(`Unknown issuerId in catalog: ${issuerId}`);
  return iss.name;
}

/** Deterministic signatory per issuer, so re-runs never diverge. */
function signatoryFor(issuerName: string): { name: string; title: string } {
  return issuerName === "Cred402 Demo Institute"
    ? { name: "Dr. Helena Voss", title: "Registrar" }
    : { name: "Prof. Marcus Ainsley", title: "Academic Director" };
}

function contentFromCredential(c: CatalogCredential, gradeOverride?: string): CertContent {
  const issuerName = issuerNameFor(c.issuerId);
  const sig = signatoryFor(issuerName);
  return {
    issuerName,
    studentName: c.studentName,
    courseName: c.courseName,
    grade: gradeOverride ?? c.grade,
    issuedAt: c.issuedAt,
    credentialId: c.id,
    signatoryName: sig.name,
    signatoryTitle: sig.title,
  };
}

// ── File I/O + hashing ───────────────────────────────────────────────────────

const SAMPLES_ROOT = resolve(process.cwd(), "samples");

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

interface WrittenFile {
  filename: string; // relative to samples/
  bytes: number;
  sha256: string;
}

function writeSample(relPath: string, bytes: Uint8Array): WrittenFile {
  const abs = resolve(SAMPLES_ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, bytes);
  return { filename: relPath, bytes: bytes.length, sha256: sha256(bytes) };
}

async function main() {
  const written: WrittenFile[] = [];
  const manifest = {
    credentials: {} as Record<string, string>,
    samples: {} as Record<string, string>,
  };

  // Index samples by credentialId for the genuine (non-tampered) files, and by
  // slug for the special cases.
  const genuineSampleFor = new Map<string, (typeof samples)[number]>();
  for (const s of samples) {
    if (s.credentialId && !s.tampered && !genuineSampleFor.has(s.credentialId)) {
      genuineSampleFor.set(s.credentialId, s);
    }
  }

  // 1) One genuine certificate per credential. Its file is written to the path
  //    of the matching non-tampered sample; its hash is BOTH the credential
  //    anchor and that sample's hash.
  for (const c of credentials) {
    const bytes = await renderCertificate(contentFromCredential(c));
    const hash = sha256(bytes);
    manifest.credentials[c.id] = hash;

    const sample = genuineSampleFor.get(c.id);
    if (sample) {
      const w = writeSample(sample.filename, bytes);
      manifest.samples[sample.slug] = w.sha256;
      written.push(w);
    } else {
      // A credential with no downloadable sample: still anchor its hash, but we
      // have no file to emit. (All catalog credentials currently map to a
      // sample; this branch keeps the loop honest if that changes.)
      written.push({ filename: `(${c.id} anchor, no sample file)`, bytes: bytes.length, sha256: hash });
    }
  }

  // 2) Flagship tamper variant of CRED-2026-0004 — identical layout, grade
  //    changed, SAME credentialId metadata. Hash goes ONLY into samples.
  const tamperedSample = samples.find((s) => s.tampered);
  if (!tamperedSample || !tamperedSample.credentialId) {
    throw new Error("Expected a tampered sample with a credentialId in the catalog.");
  }
  const originalCred = credentials.find((c) => c.id === tamperedSample.credentialId);
  if (!originalCred) {
    throw new Error(`Tampered sample references unknown credential ${tamperedSample.credentialId}.`);
  }
  if (tamperedSample.tamperedField !== "grade") {
    throw new Error(`Expected tamperedField "grade", got "${tamperedSample.tamperedField}".`);
  }
  // Change the visible grade (Distinction → Merit) while keeping everything else.
  const tamperedGrade = originalCred.grade === "Distinction" ? "Merit" : "Distinction";
  const tamperedBytes = await renderCertificate(
    contentFromCredential(originalCred, tamperedGrade),
  );
  const wTampered = writeSample(tamperedSample.filename, tamperedBytes);
  manifest.samples[tamperedSample.slug] = wTampered.sha256;
  written.push(wTampered);

  // 3) Counterfeit sample — non-existent credential id, bogus issuer. Hash goes
  //    only into samples (credentialId is null in the catalog).
  const fakeSample = samples.find((s) => s.credentialId === null);
  if (!fakeSample) throw new Error("Expected a counterfeit sample (credentialId null).");
  const fakeBytes = await renderCertificate({
    issuerName: "Diploma Mill Online",
    studentName: "Jordan Fairbanks",
    courseName: "Advanced Quantum Leadership",
    grade: "Distinction",
    issuedAt: "2026-06-15T00:00:00Z",
    credentialId: "CRED-9999-0000",
    signatoryName: "Reginald Sterling",
    signatoryTitle: "Chief Academic Officer",
  });
  const wFake = writeSample(fakeSample.filename, fakeBytes);
  manifest.samples[fakeSample.slug] = wFake.sha256;
  written.push(wFake);

  // 4) Write the manifest (2-space pretty for a clean git diff).
  const manifestPath = resolve(process.cwd(), "scripts/data/hashes.generated.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  // 5) Summary table.
  const nameCol = Math.max(...written.map((w) => w.filename.length), 8);
  console.log("\nGenerated certificates:\n");
  console.log(`  ${"FILE".padEnd(nameCol)}  ${"SHA-256 (first 16)".padEnd(18)}  ${"BYTES".padStart(8)}`);
  console.log(`  ${"-".repeat(nameCol)}  ${"-".repeat(18)}  ${"-".repeat(8)}`);
  for (const w of written) {
    console.log(
      `  ${w.filename.padEnd(nameCol)}  ${w.sha256.slice(0, 16).padEnd(18)}  ${String(w.bytes).padStart(8)}`,
    );
  }
  console.log(`\n✓ ${credentials.length} credential anchors, ${Object.keys(manifest.samples).length} sample files`);
  console.log(`✓ manifest → scripts/data/hashes.generated.json`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ certificate generation failed:", err);
  process.exit(1);
});
