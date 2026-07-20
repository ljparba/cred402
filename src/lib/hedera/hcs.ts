/**
 * Hedera Consensus Service operations: create the credential-event topic and
 * submit envelopes to it. Reads use Mirror Node (mirror.ts); this module only
 * writes.
 *
 * Unconfigured-safe: importing never throws. Every exported function calls
 * `getHederaClient()`, which throws `HederaNotConfiguredError` when operator
 * keys are absent — so failure is a clear typed error, never a crash.
 *
 * Footguns handled here (plan §2):
 *  - `receipt.topicSequenceNumber` is a `Long` → `.toNumber()`.
 *  - `TransactionReceipt` has no `consensusTimestamp` → read it from Mirror
 *    Node (best-effort here; callers that need certainty poll mirror.ts).
 *  - `TransactionId.toString()` yields the `@` form → converted with
 *    `toDashedTxId` so the returned id is Mirror-Node-ready.
 */
import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";
import { getHederaClient } from "./client";
import { toDashedTxId, getTransaction } from "./mirror";
import type { HcsEvent } from "./types";

/** Result of submitting one HCS message. */
export interface SubmitResult {
  /** Topic sequence number of the accepted message (Long → number). */
  sequenceNumber: number;
  /** Mirror-Node-ready DASHED transaction id (`0.0.X-sss-nnn`). */
  transactionId: string;
  /** Consensus timestamp, if a quick Mirror Node lookup resolved it. */
  consensusTimestamp?: string;
  /** Topic running hash after this message (hex), when available. */
  runningHash?: string;
}

/**
 * Create the HCS topic used as the append-only credential-event log.
 * The operator is set as admin + submit key so only we can post events.
 * Returns the new topic id as a string (`0.0.X`).
 */
export async function createTopic(memo = "Cred402 credential events"): Promise<string> {
  const client = getHederaClient();
  const operatorKey = client.operatorPublicKey ?? undefined;

  let tx = new TopicCreateTransaction().setTopicMemo(memo);
  if (operatorKey) {
    // Restrict posting to the operator; admin key allows future topic updates.
    tx = tx.setAdminKey(operatorKey).setSubmitKey(operatorKey);
  }

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const topicId = receipt.topicId;
  if (!topicId) {
    throw new Error("Topic creation succeeded but receipt carried no topicId.");
  }
  return topicId.toString();
}

/**
 * Submit one event envelope to a topic. The envelope is JSON-stringified as the
 * message body. Returns the sequence number (as a JS number), the dashed
 * transaction id, and — best-effort — the consensus timestamp / running hash.
 *
 * The consensus timestamp is fetched from Mirror Node opportunistically with a
 * single, immediate lookup; because of ingestion lag it is often not yet
 * available, so it is optional in the result. Callers needing a guaranteed
 * timestamp should poll `mirror.pollForTransaction` after this returns.
 */
export async function submitEvent(topicId: string, event: HcsEvent): Promise<SubmitResult> {
  const client = getHederaClient();
  const message = JSON.stringify(event);

  const response = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .execute(client);

  const receipt = await response.getReceipt(client);

  // Long footgun: topicSequenceNumber is a Long | null.
  const seqLong = receipt.topicSequenceNumber;
  if (seqLong == null) {
    throw new Error(
      "HCS submit receipt carried no topicSequenceNumber (submission may have failed).",
    );
  }
  const sequenceNumber = seqLong.toNumber();

  // Receipt has no consensusTimestamp; the id is in @-form → dash it for Mirror.
  const transactionId = toDashedTxId(response.transactionId.toString());

  // Running hash lives on the receipt as raw bytes; expose as hex when present.
  const runningHash = receipt.topicRunningHash
    ? Buffer.from(receipt.topicRunningHash).toString("hex")
    : undefined;

  // Best-effort: a single, immediate Mirror lookup for the consensus timestamp.
  // Ingestion lag usually means this is not yet present — that is fine.
  let consensusTimestamp: string | undefined;
  try {
    const tx = await getTransaction(transactionId);
    consensusTimestamp = tx?.consensus_timestamp;
  } catch {
    consensusTimestamp = undefined;
  }

  return { sequenceNumber, transactionId, consensusTimestamp, runningHash };
}
