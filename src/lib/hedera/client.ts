/**
 * Hiero client factory — the single place operator credentials become a live
 * `Client`. Unconfigured-safe: importing this module never throws and never
 * touches the network. `getHederaClient()` throws a typed
 * `HederaNotConfiguredError` only when actually called without operator keys.
 *
 * We use `@hiero-ledger/sdk` (the vendor-neutral successor to `@hashgraph/sdk`).
 * Never import both SDKs into one process — duplicate on-disk SDKs break the
 * SDK's internal brand checks (`t.startsWith is not a function`). See plan §2.
 */
import { Client, PrivateKey } from "@hiero-ledger/sdk";
import { serverConfig } from "@/lib/config";

/** Thrown when a Hedera operation is attempted without operator credentials. */
export class HederaNotConfiguredError extends Error {
  readonly code = "HEDERA_NOT_CONFIGURED";
  constructor(
    message = "Hedera is not configured. Set HEDERA_OPERATOR_ID and " +
      "HEDERA_OPERATOR_PRIVATE_KEY in .env.local to enable on-chain operations.",
  ) {
    super(message);
    this.name = "HederaNotConfiguredError";
  }
}

/** Convenience mirror of `serverConfig.hederaConfigured` for Hedera callers. */
export const hederaConfigured = serverConfig.hederaConfigured;

/**
 * Parse an operator private key string. Portal testnet accounts are typically
 * ECDSA, so we try ECDSA first and fall back to ED25519. `fromString()` is
 * deprecated and ambiguous, so it is deliberately avoided. See plan §2.
 */
export function parsePrivateKey(raw: string): PrivateKey {
  try {
    return PrivateKey.fromStringECDSA(raw);
  } catch {
    try {
      return PrivateKey.fromStringED25519(raw);
    } catch (err) {
      throw new Error(
        "Could not parse HEDERA_OPERATOR_PRIVATE_KEY as ECDSA or ED25519. " +
          "Provide a HEX-encoded testnet private key from portal.hedera.com.",
        { cause: err },
      );
    }
  }
}

/** Cached on globalThis so hot-reload / warm invocations reuse one client. */
const globalForHedera = globalThis as unknown as { __cred402Hedera?: Client };

/**
 * Build (and memoise) a Hiero `Client` for the configured network with the
 * operator set. Throws `HederaNotConfiguredError` when keys are absent.
 */
export function getHederaClient(): Client {
  if (!serverConfig.hederaConfigured) {
    throw new HederaNotConfiguredError();
  }
  if (globalForHedera.__cred402Hedera) {
    return globalForHedera.__cred402Hedera;
  }

  // hederaConfigured guarantees both are present; assert for the type checker.
  const operatorId = serverConfig.operatorId as string;
  const operatorKeyRaw = serverConfig.operatorKey as string;

  const client = Client.forName(serverConfig.hederaNetwork);
  client.setOperator(operatorId, parsePrivateKey(operatorKeyRaw));

  globalForHedera.__cred402Hedera = client;
  return client;
}

/** Close and drop the cached client (tests / graceful shutdown). */
export function closeHederaClient(): void {
  if (globalForHedera.__cred402Hedera) {
    globalForHedera.__cred402Hedera.close();
    globalForHedera.__cred402Hedera = undefined;
  }
}
