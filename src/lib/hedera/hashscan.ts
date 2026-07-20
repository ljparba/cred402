/**
 * HashScan URL builders — pure, dependency-free, browser-safe.
 *
 * These are the only Hedera helpers meant to run in the browser, so this module
 * imports nothing server-only and never touches the SDK. The base URL defaults
 * to `publicConfig.hashscanBaseUrl` (a NEXT_PUBLIC_* value), but every builder
 * also accepts an explicit `base` argument for testability.
 *
 * HashScan tolerates BOTH transaction-id forms: the SDK's `0.0.X@sss.nnn` and
 * the dashed `0.0.X-sss-nnn`. We pass the id through unchanged. (Mirror Node,
 * by contrast, rejects the `@` form — that conversion lives in mirror.ts.)
 */
import { publicConfig } from "@/lib/config";

const DEFAULT_BASE = publicConfig.hashscanBaseUrl; // e.g. "https://hashscan.io/testnet"

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * URL for a transaction. Accepts either tx-id form (`@` or dashed); HashScan
 * resolves both. The `@` character is URL-safe enough in practice for HashScan,
 * but we encode the id to be robust to future path parsing.
 */
export function hashscanTransactionUrl(txId: string, base: string = DEFAULT_BASE): string {
  return `${stripTrailingSlash(base)}/transaction/${encodeURIComponent(txId)}`;
}

/** URL for a topic (its full message stream). */
export function hashscanTopicUrl(topicId: string, base: string = DEFAULT_BASE): string {
  return `${stripTrailingSlash(base)}/topic/${encodeURIComponent(topicId)}`;
}

/** URL for an account. */
export function hashscanAccountUrl(accountId: string, base: string = DEFAULT_BASE): string {
  return `${stripTrailingSlash(base)}/account/${encodeURIComponent(accountId)}`;
}

/**
 * URL for a single message within a topic, addressed by sequence number.
 *
 * NOTE: HashScan renders individual topic messages on the topic page under the
 * `?ps=` (page-size) / message table rather than a dedicated per-message route.
 * The stable, always-valid deep link is the topic page with a `#` fragment
 * hinting the sequence number; consumers that need the raw message should use
 * the Mirror Node `getTopicMessage(topicId, seq)` API instead. Format is
 * documented here because HashScan's per-message routing is not officially
 * guaranteed and may change.
 */
export function hashscanTopicMessageUrl(
  topicId: string,
  seq: number,
  base: string = DEFAULT_BASE,
): string {
  return `${hashscanTopicUrl(topicId, base)}/message/${seq}`;
}
