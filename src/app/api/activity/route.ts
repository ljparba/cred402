/**
 * GET /api/activity  —  live Hedera / x402 / verification activity feed + stats.
 * Powers the "Live Activity" panel and the headline stat counters.
 *
 * Merges recent HCS event records, settled x402 payments, and verification
 * requests into one reverse-chronological feed, each with a HashScan deep link
 * where applicable.
 */
import { json, safeHandler } from "@/lib/http";
import { tinybarsToHbar } from "@/lib/config";
import {
  getActivityStats,
  recentHcsRecords,
  recentSettlements,
  recentVerificationRequests,
} from "@/lib/db/queries";
import { hashscanTopicMessageUrl, hashscanTransactionUrl } from "@/lib/hedera/hashscan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ActivityItem {
  kind: "hcs_event" | "payment_settled" | "verification";
  title: string;
  subtitle: string;
  at: string; // ISO
  hashscanUrl?: string;
  ref?: string;
}

export async function GET() {
  return safeHandler("api/activity", async () => {
    const [stats, hcs, settlements, verifications] = await Promise.all([
      getActivityStats(),
      recentHcsRecords(8),
      recentSettlements(8),
      recentVerificationRequests(8),
    ]);

    const items: ActivityItem[] = [];

    for (const r of hcs) {
      items.push({
        kind: "hcs_event",
        title: "HCS event created",
        subtitle: `topic ${r.topicId} · seq ${r.sequenceNumber}`,
        at: r.createdAt.toISOString(),
        hashscanUrl: hashscanTopicMessageUrl(r.topicId, r.sequenceNumber),
        ref: r.transactionId,
      });
    }

    for (const s of settlements) {
      items.push({
        kind: "payment_settled",
        title: "x402 payment settled",
        subtitle: `${tinybarsToHbar(s.amount)} tHBAR · tx ${s.transactionId}`,
        at: s.createdAt.toISOString(),
        hashscanUrl: s.hashscanUrl ?? hashscanTransactionUrl(s.transactionId),
        ref: s.transactionId,
      });
    }

    for (const v of verifications) {
      const label =
        v.status === "COMPLETED"
          ? "Verification completed"
          : v.status === "PAID"
            ? "Payment received"
            : "Certificate uploaded";
      items.push({
        kind: "verification",
        title: label,
        subtitle: `${v.uploadedFilename ?? "certificate"} · ${v.id.slice(0, 10)}…`,
        at: v.createdAt.toISOString(),
        ref: v.id,
      });
    }

    items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

    return json({
      stats: {
        certificatesAnchored: stats.credentials,
        hcsEvents: stats.hcsRecords > 0 ? stats.hcsRecords : stats.credentialEvents,
        verifications: stats.verifications,
        settlements: stats.settlements,
      },
      items: items.slice(0, 12),
    });
  });
}
