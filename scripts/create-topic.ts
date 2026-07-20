/**
 * One-time HCS topic provisioning.
 *
 *   npm run hedera:create-topic
 *
 * Creates the append-only credential-event topic and prints its id. Copy the
 * printed id into .env.local as HEDERA_HCS_TOPIC_ID, then run the anchor script.
 *
 * REQUIRES OPERATOR KEYS. With no keys (unconfigured mode) it exits cleanly with
 * instructions rather than crashing — nothing here hits Hedera until keys exist.
 */
import "./lib/env";
import { serverConfig } from "@/lib/config";
import { createTopic } from "@/lib/hedera/hcs";
import { closeHederaClient } from "@/lib/hedera/client";
import { hashscanTopicUrl } from "@/lib/hedera/hashscan";

async function main() {
  if (!serverConfig.hederaConfigured) {
    console.error(
      "✗ Hedera is not configured.\n" +
        "  Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_PRIVATE_KEY in .env.local\n" +
        "  (from portal.hedera.com testnet) and re-run `npm run hedera:create-topic`.",
    );
    process.exit(1);
  }

  console.log(`Creating HCS topic on ${serverConfig.hederaNetwork}…`);
  const topicId = await createTopic();

  console.log("\n✓ Topic created");
  console.log(`  Topic ID : ${topicId}`);
  console.log(`  HashScan : ${hashscanTopicUrl(topicId)}`);
  console.log("\nNext step — add this to .env.local:");
  console.log(`  HEDERA_HCS_TOPIC_ID=${topicId}\n`);
  console.log("Then run: npm run hedera:anchor");

  closeHederaClient();
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ create-topic failed:", err);
  process.exit(1);
});
