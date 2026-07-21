/**
 * POST /api/verify  —  FREE, unauthenticated.
 *
 * Upload a certificate (multipart `file`). The server validates it, hashes it
 * server-side (the raw file is never persisted), identifies the credential, and
 * computes the full verification report — but returns ONLY a locked preview.
 * The full report is released solely by the x402-gated GET /api/report/{id}.
 *
 * The engine result IS computed and stored here (we don't keep the uploaded
 * bytes), but it is withheld behind payment; the report route additionally
 * attaches live payment + on-chain proof that only exists post-settlement.
 */
import type { NextRequest } from "next/server";
import { apiError, json, safeHandler } from "@/lib/http";
import { serverConfig, tinybarsToHbar } from "@/lib/config";
import { newNonce, newRequestId, newResultId } from "@/lib/ids";
import { sha256 } from "@/lib/verify/hash";
import { validateUpload } from "@/lib/verify/upload";
import { extractCredentialId } from "@/lib/verify/extract";
import { verify } from "@/lib/verify/engine";
import { createVerificationRequest, createVerificationResult } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long the verification request + its nonce stay valid for payment. */
const REQUEST_TTL_MS = 15 * 60 * 1000;

/** Accept only a safe credential-id shape (letters, digits, dashes; capped). */
function sanitizeCredentialId(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^[A-Za-z0-9-]{1,80}$/.test(trimmed) ? trimmed.toUpperCase() : undefined;
}

export async function POST(req: NextRequest) {
  return safeHandler("api/verify", async () => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return apiError("Expected multipart/form-data with a 'file' field.", 400, {
        code: "BAD_REQUEST",
      });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiError("Missing 'file' upload.", 400, { code: "NO_FILE" });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateUpload(bytes, file.name, file.type || undefined);
    if (!validation.ok) {
      return apiError(validation.error ?? "Invalid file.", 415, { code: "INVALID_FILE" });
    }

    const uploadedHash = sha256(bytes);
    // An explicit credentialId (e.g. a Create-Tamper-Demo id supplied when
    // re-uploading a modified copy) takes precedence over PDF-embedded ids.
    const explicitId = sanitizeCredentialId(form.get("credentialId"));
    const claimedCredentialId = explicitId ?? (await extractCredentialId(bytes, validation.kind));
    const result = await verify({ uploadedHash, claimedCredentialId });

    const requestId = newRequestId();
    const now = new Date();
    const nonce = newNonce();

    await createVerificationRequest({
      id: requestId,
      uploadedFilename: file.name,
      uploadedSize: validation.size,
      uploadedMime: validation.mime,
      sha256: uploadedHash,
      credentialId: result.credentialId ?? null,
      issuerId: result.issuerId ?? null,
      nonce,
      nonceExpiresAt: new Date(now.getTime() + REQUEST_TTL_MS),
      status: "AWAITING_PAYMENT",
      previewVerdict: result.verdict,
    });

    // Store the full report (withheld until payment is settled).
    await createVerificationResult({
      id: newResultId(),
      requestId,
      verdict: result.verdict,
      checks: result.checks,
      uploadedHash,
      anchoredHash: result.anchoredHash ?? null,
      hcsSequenceNumber: result.hcs?.sequenceNumber ?? null,
      hcsTransactionId: result.hcs?.transactionId ?? null,
    });

    const identified = Boolean(result.credentialId);
    return json({
      requestId,
      file: {
        name: file.name,
        size: validation.size,
        mime: validation.mime,
        sha256: uploadedHash,
      },
      identified,
      credential: identified
        ? {
            id: result.credentialId,
            courseName: result.courseName,
            issuerName: result.issuerName,
          }
        : null,
      locked: true,
      reportUrl: `/api/report/${requestId}`,
      payment: {
        network: serverConfig.x402Network,
        asset: serverConfig.x402Asset,
        amount: serverConfig.x402Price,
        amountHbar: tinybarsToHbar(serverConfig.x402Price),
        currencyLabel: "tHBAR",
        payTo: serverConfig.x402PaymentRecipient ?? null,
        configured: serverConfig.x402Configured,
      },
    });
  });
}
