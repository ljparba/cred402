/**
 * Upload validation tests (plan §16): magic-byte type sniffing, size limits,
 * empty rejection, and declared-type/content mismatch rejection.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffKind, validateUpload } from "@/lib/verify/upload";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // "%PDF-1"
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const TXT = new TextEncoder().encode("just some text, not a certificate");

test("sniffKind detects pdf/png/jpg and rejects others", () => {
  assert.equal(sniffKind(PDF), "pdf");
  assert.equal(sniffKind(PNG), "png");
  assert.equal(sniffKind(JPG), "jpg");
  assert.equal(sniffKind(TXT), undefined);
});

test("valid PDF passes and reports its mime", () => {
  const r = validateUpload(PDF, "cert.pdf", "application/pdf");
  assert.equal(r.ok, true);
  assert.equal(r.kind, "pdf");
  assert.equal(r.mime, "application/pdf");
});

test("empty file is rejected", () => {
  const r = validateUpload(new Uint8Array([]), "empty.pdf");
  assert.equal(r.ok, false);
});

test("unsupported type is rejected", () => {
  const r = validateUpload(TXT, "notes.txt", "text/plain");
  assert.equal(r.ok, false);
});

test("oversized file is rejected", () => {
  // MAX_UPLOAD_SIZE default is 5 MiB; forge a >5MiB PDF-headed buffer.
  const big = new Uint8Array(5 * 1024 * 1024 + 10);
  big.set(PDF, 0);
  const r = validateUpload(big, "huge.pdf", "application/pdf");
  assert.equal(r.ok, false);
});

test("declared type inconsistent with real bytes is rejected", () => {
  const r = validateUpload(PDF, "cert.png", "image/png");
  assert.equal(r.ok, false);
});

test("octet-stream declared type is tolerated when bytes are valid", () => {
  const r = validateUpload(PNG, "cert", "application/octet-stream");
  assert.equal(r.ok, true);
  assert.equal(r.kind, "png");
});
