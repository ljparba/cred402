/**
 * Derive and fund a second testnet account to act as the x402 demo payer.
 *
 *   npm run hedera:create-wallet
 *
 * A valid transfer needs distinct payer and recipient accounts. This derives a
 * fresh key, creates a new testnet account funded with a few HBAR from the
 * operator, and prints the account id + private key to copy into .env.local as
 * X402_DEMO_PAYER_ID / X402_DEMO_PAYER_PRIVATE_KEY.
 *
 * Key type: defaults to ECDSA (portal/testnet convention). Pass `--ed25519`
 * to derive an ED25519 key instead.
 *
 * REQUIRES OPERATOR KEYS. In unconfigured mode it exits with instructions.
 * The private key is printed ONCE and never stored — capture it immediately.
 */
import "./lib/env";
import { AccountCreateTransaction, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { serverConfig } from "@/lib/config";
import { getHederaClient, closeHederaClient } from "@/lib/hedera/client";
import { hashscanAccountUrl } from "@/lib/hedera/hashscan";

/** Fund the new account with this many HBAR from the operator. */
const INITIAL_BALANCE_HBAR = 5;

async function main() {
  if (!serverConfig.hederaConfigured) {
    console.error(
      "✗ Hedera is not configured.\n" +
        "  Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_PRIVATE_KEY in .env.local and re-run.",
    );
    process.exit(1);
  }

  const useEd25519 = process.argv.includes("--ed25519");
  const client = getHederaClient();

  const newKey = useEd25519
    ? PrivateKey.generateED25519()
    : PrivateKey.generateECDSA();
  const keyType = useEd25519 ? "ED25519" : "ECDSA";

  console.log(
    `Creating a ${keyType} demo-payer account funded with ${INITIAL_BALANCE_HBAR} tHBAR…`,
  );

  const response = await new AccountCreateTransaction()
    .setKeyWithoutAlias(newKey.publicKey)
    .setInitialBalance(new Hbar(INITIAL_BALANCE_HBAR))
    .setAccountMemo("Cred402 x402 demo payer")
    .execute(client);

  const receipt = await response.getReceipt(client);
  const accountId = receipt.accountId;
  if (!accountId) {
    throw new Error("Account creation succeeded but receipt carried no accountId.");
  }

  const accountIdStr = accountId.toString();
  // Raw HEX private key — the form fromStringECDSA/ED25519 expects on load.
  const privateKeyStr = newKey.toStringRaw();

  console.log("\n✓ Demo payer account created");
  console.log(`  Account ID  : ${accountIdStr}`);
  console.log(`  Key type    : ${keyType}`);
  console.log(`  HashScan    : ${hashscanAccountUrl(accountIdStr)}`);
  console.log("\n⚠ Copy the private key now — it is shown only once:");
  console.log(`  Private key : ${privateKeyStr}`);
  console.log("\nAdd these to .env.local:");
  console.log(`  X402_DEMO_PAYER_ID=${accountIdStr}`);
  console.log(`  X402_DEMO_PAYER_PRIVATE_KEY=${privateKeyStr}\n`);

  closeHederaClient();
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ create-demo-wallet failed:", err);
  process.exit(1);
});
