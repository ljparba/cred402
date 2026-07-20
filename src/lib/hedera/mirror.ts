/**
 * Mirror Node REST client — pure `fetch`, no SDK. Used for all reads: fetching
 * a transaction's consensus result, streaming topic messages, and re-verifying
 * on-chain evidence independently of any facilitator.
 *
 * Footguns handled here (see plan §2):
 *  - Mirror Node has ~2–3s ingestion lag; `pollForTransaction` retries with
 *    exponential backoff from 2s up to ~10s before giving up.
 *  - The SDK's `TransactionId.toString()` emits `0.0.X@sss.nnn`, which Mirror
 *    Node REJECTS (HTTP 400). `toDashedTxId` converts it to `0.0.X-sss-nnn`.
 *  - `message` and `memo_base64` fields are base64-encoded → decoded here.
 *
 * This module is server-oriented (it reads `serverConfig.mirrorNodeBaseUrl`),
 * but it imports nothing that throws at import time.
 */
import { serverConfig } from "@/lib/config";

/**
 * Convert an SDK-style transaction id to Mirror Node's dashed form.
 *
 *   "0.0.1234@1690000000.000000001"  →  "0.0.1234-1690000000-000000001"
 *
 * Idempotent: an already-dashed id is returned unchanged. Also tolerates a
 * `TransactionId`-like object by stringifying it first.
 */
export function toDashedTxId(id: string | { toString(): string }): string {
  const s = typeof id === "string" ? id : id.toString();
  // Already dashed (no '@'): return as-is.
  if (!s.includes("@")) return s;
  // Split on '@' so we only touch the "seconds.nanos" side; the account id
  // (e.g. "0.0.1234") keeps its dots. Then join with dashes.
  //   "0.0.1234@1690000000.000000001" → "0.0.1234-1690000000-000000001"
  const [account, validStart = ""] = s.split("@");
  return `${account}-${validStart.replace(".", "-")}`;
}

// ── Mirror Node response shapes (only the fields we consume) ──────────────────

export interface MirrorTransfer {
  account: string;
  amount: number; // tinybars, signed
  is_approval?: boolean;
}

export interface MirrorTransaction {
  transaction_id: string;
  consensus_timestamp: string; // "seconds.nanos"
  result: string; // e.g. "SUCCESS"
  charged_tx_fee?: number;
  transfers?: MirrorTransfer[];
  name?: string;
  /** Decoded from `memo_base64` when present. */
  memo?: string;
}

export interface MirrorTopicMessage {
  topic_id: string;
  sequence_number: number;
  consensus_timestamp: string;
  running_hash?: string;
  running_hash_version?: number;
  payer_account_id?: string;
  /** Decoded UTF-8 of the base64 `message` field. */
  message: string;
  /** Parsed JSON of `message`, when it is valid JSON (our envelopes always are). */
  data?: unknown;
}

interface RawTopicMessage {
  topic_id: string;
  sequence_number: number;
  consensus_timestamp: string;
  running_hash?: string;
  running_hash_version?: number;
  payer_account_id?: string;
  message: string; // base64
}

export class MirrorNodeError extends Error {
  readonly code = "MIRROR_NODE_ERROR";
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = "MirrorNodeError";
  }
}

function base64ToUtf8(b64: string): string {
  // Buffer is available under Node (scripts) and the Next.js server runtime.
  return Buffer.from(b64, "base64").toString("utf8");
}

function baseUrl(): string {
  return serverConfig.mirrorNodeBaseUrl; // already trailing-slash-stripped
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    throw new MirrorNodeError(
      `Mirror Node ${res.status} ${res.statusText} for ${path}`,
      res.status,
      url,
    );
  }
  return (await res.json()) as T;
}

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * Fetch a single transaction by its DASHED id (`0.0.X-sss-nnn`). Pass an SDK
 * `@`-form id through `toDashedTxId` first (this function does that defensively
 * too). Returns null on 404 (not yet ingested / unknown), throws on other errors.
 */
export async function getTransaction(
  dashedTxId: string,
  signal?: AbortSignal,
): Promise<MirrorTransaction | null> {
  const id = toDashedTxId(dashedTxId);
  let body: { transactions?: RawMirrorTransaction[] };
  try {
    body = await getJson(`/api/v1/transactions/${id}`, signal);
  } catch (err) {
    if (err instanceof MirrorNodeError && err.status === 404) return null;
    throw err;
  }
  const tx = body.transactions?.[0];
  if (!tx) return null;
  return normalizeTransaction(tx);
}

interface RawMirrorTransaction {
  transaction_id: string;
  consensus_timestamp: string;
  result: string;
  charged_tx_fee?: number;
  transfers?: MirrorTransfer[];
  name?: string;
  memo_base64?: string | null;
}

function normalizeTransaction(tx: RawMirrorTransaction): MirrorTransaction {
  return {
    transaction_id: tx.transaction_id,
    consensus_timestamp: tx.consensus_timestamp,
    result: tx.result,
    charged_tx_fee: tx.charged_tx_fee,
    transfers: tx.transfers,
    name: tx.name,
    memo: tx.memo_base64 ? base64ToUtf8(tx.memo_base64) : undefined,
  };
}

export interface PollOptions {
  /** Total attempts before giving up. Default 5 (≈ 2+3+5+8+10s of waiting). */
  maxAttempts?: number;
  /** First delay in ms. Default 2000. */
  initialDelayMs?: number;
  /** Delay ceiling in ms. Default 10000. */
  maxDelayMs?: number;
  signal?: AbortSignal;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });

/**
 * Poll Mirror Node for a transaction until it appears, absorbing ingestion lag.
 * Backoff grows exponentially (×1.6) from `initialDelayMs`, capped at
 * `maxDelayMs`. Returns the transaction, or null if it never appears within
 * `maxAttempts`.
 */
export async function pollForTransaction(
  dashedTxId: string,
  opts: PollOptions = {},
): Promise<MirrorTransaction | null> {
  const {
    maxAttempts = 5,
    initialDelayMs = 2000,
    maxDelayMs = 10000,
    signal,
  } = opts;

  let delay = initialDelayMs;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tx = await getTransaction(dashedTxId, signal);
    if (tx) return tx;
    if (attempt < maxAttempts - 1) {
      await sleep(delay, signal);
      delay = Math.min(Math.round(delay * 1.6), maxDelayMs);
    }
  }
  return null;
}

// ── Topic messages ────────────────────────────────────────────────────────────

export interface TopicMessagesOptions {
  /** Return messages with sequence_number >= this (Mirror `sequencenumber=gte:`). */
  sequenceNumberGte?: number;
  /** Page size (Mirror `limit`, max 100). Default 100. */
  limit?: number;
  /** "asc" (default) or "desc". */
  order?: "asc" | "desc";
  signal?: AbortSignal;
}

function decodeTopicMessage(raw: RawTopicMessage): MirrorTopicMessage {
  const message = base64ToUtf8(raw.message);
  let data: unknown;
  try {
    data = JSON.parse(message);
  } catch {
    data = undefined; // non-JSON message; leave `data` unset.
  }
  return {
    topic_id: raw.topic_id,
    sequence_number: raw.sequence_number,
    consensus_timestamp: raw.consensus_timestamp,
    running_hash: raw.running_hash,
    running_hash_version: raw.running_hash_version,
    payer_account_id: raw.payer_account_id,
    message,
    data,
  };
}

/**
 * Fetch a page of messages for a topic, base64-decoding each `message`.
 * Does not auto-paginate; pass `sequenceNumberGte` to continue.
 */
export async function getTopicMessages(
  topicId: string,
  opts: TopicMessagesOptions = {},
): Promise<MirrorTopicMessage[]> {
  const { sequenceNumberGte, limit = 100, order = "asc", signal } = opts;
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("order", order);
  if (sequenceNumberGte !== undefined) {
    params.set("sequencenumber", `gte:${sequenceNumberGte}`);
  }
  const body = await getJson<{ messages?: RawTopicMessage[] }>(
    `/api/v1/topics/${topicId}/messages?${params.toString()}`,
    signal,
  );
  return (body.messages ?? []).map(decodeTopicMessage);
}

/**
 * Fetch one message from a topic by sequence number. Returns null on 404.
 */
export async function getTopicMessage(
  topicId: string,
  seq: number,
  signal?: AbortSignal,
): Promise<MirrorTopicMessage | null> {
  let raw: RawTopicMessage;
  try {
    raw = await getJson<RawTopicMessage>(
      `/api/v1/topics/${topicId}/messages/${seq}`,
      signal,
    );
  } catch (err) {
    if (err instanceof MirrorNodeError && err.status === 404) return null;
    throw err;
  }
  return decodeTopicMessage(raw);
}

/**
 * Poll for a specific topic message (sequence number) until it is ingested.
 * Same backoff profile as `pollForTransaction`.
 */
export async function pollForTopicMessage(
  topicId: string,
  seq: number,
  opts: PollOptions = {},
): Promise<MirrorTopicMessage | null> {
  const {
    maxAttempts = 5,
    initialDelayMs = 2000,
    maxDelayMs = 10000,
    signal,
  } = opts;

  let delay = initialDelayMs;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const msg = await getTopicMessage(topicId, seq, signal);
    if (msg) return msg;
    if (attempt < maxAttempts - 1) {
      await sleep(delay, signal);
      delay = Math.min(Math.round(delay * 1.6), maxDelayMs);
    }
  }
  return null;
}
