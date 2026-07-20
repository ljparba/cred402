/**
 * Extract the claimed credential ID embedded in an uploaded PDF's metadata.
 *
 * Cred402 certificates carry their credential ID in the PDF Keywords and
 * Subject fields (set at generation time). This is what lets the engine detect
 * TAMPERING: a post-issuance edit changes the file's bytes (so the hash no
 * longer matches the anchor) while the claimed identity in metadata is
 * preserved — so we know WHICH credential the altered file purports to be.
 *
 * Image uploads (PNG/JPEG) carry no such metadata → returns undefined, and the
 * engine falls back to hash-only identification.
 */
import { PDFDocument } from "pdf-lib";

const CRED_ID_RE = /CRED-\d{4}-\d{4,}/i;

function firstCredId(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (!v) continue;
    const m = v.match(CRED_ID_RE);
    if (m) return m[0].toUpperCase();
  }
  return undefined;
}

/**
 * Returns the embedded credential ID, or undefined if the file is not a PDF,
 * is unreadable, or carries no recognisable credential ID. Never throws.
 */
export async function extractCredentialId(
  bytes: Uint8Array,
  kind?: string,
): Promise<string | undefined> {
  if (kind && kind !== "pdf") return undefined;
  try {
    const doc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });
    return firstCredId(doc.getKeywords(), doc.getSubject(), doc.getTitle());
  } catch {
    return undefined;
  }
}
