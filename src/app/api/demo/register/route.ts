/**
 * POST /api/demo/register  —  Create Tamper Demo: register an ORIGINAL file.
 *
 * Guarded (plan §8.5): feature flag (default OFF), testnet-only, DB-backed rate
 * limit, strict upload validation, issuer forced server-side. Writes minimal
 * proof to HCS when configured. Never persists the uploaded file; never accepts
 * a client-chosen issuer/topic/payer.
 */
import type { NextRequest } from "next/server";
import { apiError, enforceRequestSize, json, safePrivateHandler } from "@/lib/http";
import { serverConfig } from "@/lib/config";
import { validateUpload } from "@/lib/verify/upload";
import { registerDemoOriginal } from "@/lib/demo/register";
import { checkAndRecord, bucketKey } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCLAIMER =
  "Demo registration proves whether a file changed after it was anchored. It does not prove " +
  "that the uploader is a real school, authorized issuer, or owner of the credential.";

export async function POST(req: NextRequest) {
  return safePrivateHandler("api/demo/register", async () => {
    // 0. Reject a clearly-oversized declared body before parsing it.
    const tooLarge = enforceRequestSize(req, serverConfig.maxUploadRequestSize);
    if (tooLarge) return tooLarge;

    // 1. Feature flag.
    if (!serverConfig.tamperDemoEnabled) {
      return apiError("The Create Tamper Demo feature is disabled on this deployment.", 403, {
        code: "FEATURE_DISABLED",
      });
    }
    // 2. Testnet-only guard.
    if (!serverConfig.isTestnet) {
      return apiError("The tamper demo is available on Hedera testnet only.", 403, {
        code: "NOT_TESTNET",
      });
    }

    // 3. Parse the upload.
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

    // 4. Rate limit (DB-backed, per hashed IP).
    const rl = await checkAndRecord(
      bucketKey("demo_register", req.headers),
      serverConfig.tamperDemoRateLimitMax,
      serverConfig.tamperDemoRateLimitWindowSeconds,
    );
    if (!rl.ok) {
      return apiError(
        `Rate limit reached (${rl.limit} demo registrations per ` +
          `${Math.round(serverConfig.tamperDemoRateLimitWindowSeconds / 60)} minutes). ` +
          `Try again in ~${rl.retryAfterSeconds}s.`,
        429,
        {
          code: "RATE_LIMITED",
          headers: { "retry-after": String(rl.retryAfterSeconds ?? 60) },
        },
      );
    }

    // 5. Register (issuer forced to Cred402 Demo Issuer inside).
    const label = typeof form.get("label") === "string" ? (form.get("label") as string) : null;
    const registration = await registerDemoOriginal(bytes, label);

    // Log only safe metadata (never the file, never the raw IP).
    console.log(
      `[demo/register] ${registration.demoCredentialId} anchored=${registration.anchored} ` +
        `sha=${registration.sha256.slice(0, 12)}…`,
    );

    return json({
      ...registration,
      disclaimer: DISCLAIMER,
      labels: ["Synthetic", "Demo", "Hedera Testnet", "Cred402 Demo Issuer"],
      nextSteps: {
        message:
          "Save this demo credential ID. Edit any field of your file, then re-upload the modified " +
          "copy WITH this ID to see a TAMPERED result. Re-uploading the unchanged original returns VALID.",
        verifyWith: "POST /api/verify with the modified file and credentialId=" + registration.demoCredentialId,
      },
      rateLimit: { remaining: rl.remaining, limit: rl.limit },
    });
  });
}
