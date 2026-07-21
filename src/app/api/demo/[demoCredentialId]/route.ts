/**
 * GET /api/demo/{demoCredentialId}  —  look up a Create-Tamper-Demo registration
 * and its HCS proof. Only resolves credentials created by the demo feature
 * (`source = 'demo'`); seeded catalogue credentials return 404 here.
 */
import type { NextRequest } from "next/server";
import { apiError, json, safeHandler } from "@/lib/http";
import { serverConfig } from "@/lib/config";
import { findCredentialById, getIssuer, getIssuanceHcsRecord } from "@/lib/db/queries";
import { hashscanTopicUrl, hashscanTransactionUrl } from "@/lib/hedera/hashscan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ demoCredentialId: string }> },
) {
  return safeHandler("api/demo/[demoCredentialId]", async () => {
    const { demoCredentialId } = await ctx.params;
    const credential = await findCredentialById(demoCredentialId);
    if (!credential || credential.source !== "demo") {
      return apiError("Demo registration not found.", 404, { code: "DEMO_NOT_FOUND" });
    }

    const issuer = await getIssuer(credential.issuerId);
    const record = await getIssuanceHcsRecord(credential.id);

    return json({
      demoCredentialId: credential.id,
      demo: true,
      synthetic: true,
      sha256: credential.sha256,
      issuerId: credential.issuerId,
      issuerName: issuer?.name ?? null,
      label: credential.studentName,
      status: credential.status,
      network: serverConfig.hederaNetwork,
      anchored: Boolean(record),
      hcs: record
        ? {
            topicId: record.topicId,
            sequenceNumber: record.sequenceNumber,
            transactionId: record.transactionId,
            consensusTimestamp: record.consensusTimestamp,
            hashscanUrl: hashscanTransactionUrl(record.transactionId),
            topicUrl: hashscanTopicUrl(record.topicId),
          }
        : null,
      createdAt: credential.createdAt.toISOString(),
    });
  });
}
