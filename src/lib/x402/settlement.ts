/**
 * Independent on-chain settlement proof.
 *
 * Per plan §3.5, Cred402 NEVER takes the facilitator's word that a payment
 * settled. After `settlePayment()` reports success, we re-verify the exact
 * transaction against the Hedera Mirror Node ourselves:
 *
 *  1. The transaction reached consensus with `result === "SUCCESS"`.
 *  2. `payTo` received a NET credit of EXACTLY `expectedTinybars` — computed by
 *     summing the signed `amount`s of every transfer whose account is `payTo`
 *     (a transaction may debit/re-credit an account across multiple entries).
 *
 * This is layer 3 of the defence-in-depth model. It closes the gap that the
 * Hedera `exact` scheme cannot cryptographically bind the resource into the
 * signed transaction: the money must provably, independently have moved.
 *
 * Never throws — Mirror Node lag or errors resolve to `{ ok: false, reason }`
 * so the route can return a clean 402 instead of a 500.
 */
import { pollForTransaction, type PollOptions } from "@/lib/hedera/mirror";
import { hederaAccountIdsEqual } from "@x402/hedera";

export interface SettlementProof {
  ok: boolean;
  reason?: string;
  consensusTimestamp?: string;
}

/**
 * Confirm that `dashedTxId` settled on-chain with an exact `expectedTinybars`
 * net credit to `payTo`. `dashedTxId` must be Mirror-Node form (`0.0.X-sss-nnn`);
 * callers pass it through `toDashedTxId` first.
 *
 * `poll` tunes the ingestion-lag polling: the default absorbs Mirror Node lag
 * right after a settlement, while a reconciliation read (where the transaction
 * is minutes old already) passes `{ maxAttempts: 1 }` for a single fast lookup.
 */
export async function verifySettlementOnChain(
  dashedTxId: string,
  payTo: string,
  expectedTinybars: number,
  poll?: PollOptions,
): Promise<SettlementProof> {
  let tx;
  try {
    tx = await pollForTransaction(dashedTxId, poll);
  } catch (err) {
    return {
      ok: false,
      reason: `Mirror Node lookup failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!tx) {
    return {
      ok: false,
      reason: `Transaction ${dashedTxId} did not appear on Mirror Node within the polling window.`,
    };
  }

  if (tx.result !== "SUCCESS") {
    return {
      ok: false,
      reason: `Transaction ${dashedTxId} did not reach SUCCESS (result: ${tx.result}).`,
      consensusTimestamp: tx.consensus_timestamp,
    };
  }

  // Net credit to payTo = sum of signed amounts on entries for that account.
  const netToPayTo = (tx.transfers ?? [])
    .filter((t) => hederaAccountIdsEqual(t.account, payTo))
    .reduce((sum, t) => sum + t.amount, 0);

  if (netToPayTo !== expectedTinybars) {
    return {
      ok: false,
      reason:
        `On-chain credit to ${payTo} was ${netToPayTo} tinybars, ` +
        `expected exactly ${expectedTinybars}.`,
      consensusTimestamp: tx.consensus_timestamp,
    };
  }

  return { ok: true, consensusTimestamp: tx.consensus_timestamp };
}
