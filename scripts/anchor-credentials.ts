/**
 * Anchor every local credential event onto Hedera Consensus Service.
 *
 *   npm run hedera:anchor
 *
 * For each row in `credential_events`, submit its stored `payload` envelope to
 * the configured topic (HEDERA_HCS_TOPIC_ID) and record the on-chain proof
 * coordinates in `hcs_records`. Also stamps `issuers.hedera_topic_id` so the
 * app can link an issuer to its event log.
 *
 * IDEMPOTENT: events that already have an `hcs_records` row are skipped, so the
 * script is safe to re-run (e.g. after a partial failure). It never re-submits.
 *
 * REQUIRES OPERATOR KEYS + a topic. In unconfigured mode it exits with
 * instructions instead of crashing.
 */
import "./lib/env";
import { eq } from "drizzle-orm";
import { serverConfig } from "@/lib/config";
import { getDb, schema } from "@/lib/db";
import { submitEvent } from "@/lib/hedera/hcs";
import { closeHederaClient } from "@/lib/hedera/client";
import { hashscanTopicUrl } from "@/lib/hedera/hashscan";
import type { HcsEvent } from "@/lib/hedera/types";

async function main() {
  if (!serverConfig.hederaConfigured) {
    console.error(
      "✗ Hedera is not configured.\n" +
        "  Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_PRIVATE_KEY in .env.local and re-run.",
    );
    process.exit(1);
  }

  const topicId = serverConfig.hcsTopicId;
  if (!topicId) {
    console.error(
      "✗ HEDERA_HCS_TOPIC_ID is not set.\n" +
        "  Run `npm run hedera:create-topic` first, then add the id to .env.local.",
    );
    process.exit(1);
  }

  const db = await getDb();

  const events = await db.select().from(schema.credentialEvents);
  if (events.length === 0) {
    console.warn("⚠ No credential_events found. Run `npm run db:seed` first.");
    process.exit(0);
  }

  // Which events are already anchored? (idempotency)
  const anchored = await db.select().from(schema.hcsRecords);
  const anchoredEventIds = new Set(anchored.map((r) => r.eventId));

  console.log(`Anchoring to topic ${topicId} on ${serverConfig.hederaNetwork}`);
  console.log(`  ${hashscanTopicUrl(topicId)}`);
  console.log(
    `  ${events.length} event(s) total, ${anchoredEventIds.size} already anchored.\n`,
  );

  let submitted = 0;
  let skipped = 0;

  // Submit in a stable order so the on-ledger sequence is deterministic.
  const ordered = [...events].sort((a, b) => a.id.localeCompare(b.id));

  for (const ev of ordered) {
    if (anchoredEventIds.has(ev.id)) {
      skipped++;
      continue;
    }

    const event = ev.payload as HcsEvent;
    const result = await submitEvent(topicId, event);

    await db.insert(schema.hcsRecords).values({
      id: `hcs_${ev.id}`,
      eventId: ev.id,
      topicId,
      sequenceNumber: result.sequenceNumber,
      consensusTimestamp: result.consensusTimestamp ?? null,
      transactionId: result.transactionId,
      runningHash: result.runningHash ?? null,
    });

    submitted++;
    console.log(
      `  ✓ ${ev.id} → seq ${result.sequenceNumber} · tx ${result.transactionId}`,
    );
  }

  // Stamp each issuer that has at least one event with the topic id.
  const issuerIds = Array.from(new Set(events.map((e) => e.issuerId)));
  for (const issuerId of issuerIds) {
    await db
      .update(schema.issuers)
      .set({ hederaTopicId: topicId })
      .where(eq(schema.issuers.id, issuerId));
  }

  console.log(
    `\n✓ anchor complete — ${submitted} submitted, ${skipped} skipped (already anchored).`,
  );
  console.log(`✓ tagged ${issuerIds.length} issuer(s) with topic ${topicId}.`);

  closeHederaClient();
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ anchor-credentials failed:", err);
  process.exit(1);
});
