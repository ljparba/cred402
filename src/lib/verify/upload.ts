/**
 * Upload validation — defence for the verification endpoint. Restricts type,
 * size, and sniffs magic bytes so a mislabelled or oversized file is rejected
 * before hashing. Accepts PDF, PNG, JPEG (matching the mockup's "PDF, PNG, JPG").
 *
 * Note: embedded credential-ID extraction is PDF-only (image formats carry no
 * such metadata); images are identified by hash alone. Documented honestly.
 */
import { serverConfig } from "@/lib/config";

export type UploadKind = "pdf" | "png" | "jpg";

export interface UploadValidation {
  ok: boolean;
  error?: string;
  kind?: UploadKind;
  mime?: string;
  size: number;
}

const MIME_BY_KIND: Record<UploadKind, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
};

/** Sniff the file's real type from its leading bytes (never trust the label). */
export function sniffKind(bytes: Uint8Array): UploadKind | undefined {
  // PDF: "%PDF"
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  return undefined;
}

/**
 * Validate a raw upload. `declaredName`/`declaredType` come from the multipart
 * part but are only advisory — the sniffed magic bytes are authoritative.
 */
export function validateUpload(
  bytes: Uint8Array,
  declaredName?: string,
  declaredType?: string,
): UploadValidation {
  const size = bytes.byteLength;
  const max = serverConfig.maxUploadSize;

  if (size === 0) {
    return { ok: false, error: "The uploaded file is empty.", size };
  }
  if (size > max) {
    return {
      ok: false,
      error: `File is too large (${size} bytes). Maximum is ${max} bytes.`,
      size,
    };
  }

  const kind = sniffKind(bytes);
  if (!kind) {
    return {
      ok: false,
      error: "Unsupported file type. Only PDF, PNG, and JPEG files are accepted.",
      size,
    };
  }

  // If the client declared a type, it must be consistent with the real bytes.
  if (declaredType && declaredType !== MIME_BY_KIND[kind] && declaredType !== "application/octet-stream") {
    return {
      ok: false,
      error: `Declared type "${declaredType}" does not match the actual file contents (${kind}).`,
      size,
    };
  }

  void declaredName; // reserved for future extension-based checks
  return { ok: true, kind, mime: MIME_BY_KIND[kind], size };
}
