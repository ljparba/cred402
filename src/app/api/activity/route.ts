/**
 * GET /api/activity  —  live Hedera / x402 / verification activity feed + stats.
 * Powers the "Live Activity" panel and the headline stat counters.
 *
 * Merges recent HCS event records, settled x402 payments, and verification
 * requests into one reverse-chronological feed, each with a HashScan deep link
 * where applicable.
 *
 * `stats` carries only real counts from this deployment's database — no sample,
 * seeded-for-show, or growth figures. Field names say exactly what is counted so
 * the UI can label them truthfully:
 *
 *  - `registeredCredentials`  rows in `credentials` (registered, not necessarily anchored)
 *  - `verificationRequests`   rows in `verification_requests`, INCLUDING locked/unpaid ones
 *  - `hcsRecords` + `hcsSource`  real anchored `hcs_records` when any exist
 *      (`hcsSource: "network"`); otherwise the local offline event fixtures in
 *      `credential_events` (`hcsSource: "fixture"`), which the UI must label as
 *      demo data rather than live network activity
 *  - `settlements`            successful (SETTLED) x402 settlements
 */
import { json, PUBLIC_SHORT_CACHE, safeHandler } from "@/lib/http";
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

    // Real on-chain records win; with none anchored yet we fall back to the local
    // event fixtures and SAY SO, so the UI never presents them as network activity.
    const anchoredOnNetwork = stats.hcsRecords > 0;

    // This route carries only PUBLIC aggregate/feed data, so it gets a short
    // shared-cache policy (a CDN can absorb the homepage poll). It is applied
    // ONLY to this success response — the sanitized generic 500 from safeHandler
    // is never marked cacheable. Never use this on a private report/payment route.
    return json(
      {
        stats: {
          registeredCredentials: stats.credentials,
          verificationRequests: stats.verifications,
          hcsRecords: anchoredOnNetwork ? stats.hcsRecords : stats.credentialEvents,
          hcsSource: anchoredOnNetwork ? "network" : "fixture",
          settlements: stats.settlements,
        },
        items: items.slice(0, 12),
      },
      { headers: { "Cache-Control": PUBLIC_SHORT_CACHE } },
    );
  });
}
