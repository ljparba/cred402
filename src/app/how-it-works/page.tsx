/**
 * `/how-it-works` — a real Next.js route (never a homepage anchor).
 *
 * A polished, single-column-friendly explainer of the whole product, plus the
 * interactive Create Tamper Demo. Reuses the shared site chrome (Nav, Footer,
 * ModeBanner, NetworkStatusBar) so it feels continuous with the app, and the
 * dark Hedera visual system.
 */
import type { Metadata } from "next";
import { HowItWorksShell } from "@/components/sections/HowItWorksShell";

export const metadata: Metadata = {
  title: "How Cred402 Works — accountless credential verification on Hedera",
  description:
    "How Cred402 verifies a file against a Hedera-anchored proof: the 8-step flow, the six checks and verdicts, what happens with a custom certificate, and an interactive Create Tamper Demo.",
};

export default function HowItWorksPage() {
  return <HowItWorksShell />;
}
