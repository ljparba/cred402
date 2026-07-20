/**
 * "How It Works" — three-step explainer (mockup 1, bottom-left). Upload → Pay
 * via x402 → Get verification report. Static, staggered entrance.
 */
"use client";

import { motion } from "framer-motion";
import { UploadCloud, Wallet, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassPanel, SectionLabel } from "@/components/ui/GlassPanel";

const STEPS: { n: number; icon: LucideIcon; title: string; body: string }[] = [
  {
    n: 1,
    icon: UploadCloud,
    title: "Upload",
    body: "Upload any certificate (PDF, PNG, JPG). We hash it server-side — the file is never stored.",
  },
  {
    n: 2,
    icon: Wallet,
    title: "Pay via x402",
    body: "The report is gated by a genuine HTTP 402. Settle a small pay-per-use fee in testnet HBAR.",
  },
  {
    n: 3,
    icon: ShieldCheck,
    title: "Get Report",
    body: "Receive a deterministic, tamper-aware report backed by Hedera Consensus Service proof.",
  },
];

export function HowItWorks() {
  return (
    <GlassPanel id="how-it-works" as="section" className="p-6 sm:p-7" aria-labelledby="how-it-works-title">
      <SectionLabel>How it Works</SectionLabel>
      <h2 id="how-it-works-title" className="sr-only">
        How Cred402 works
      </h2>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="relative flex flex-col items-center gap-3 rounded-xl p-4 text-center"
          >
            {/* connector line */}
            {i < STEPS.length - 1 && (
              <span className="absolute right-0 top-9 hidden h-px w-1/2 translate-x-1/2 bg-gradient-to-r from-brand/40 to-transparent sm:block" />
            )}
            <div className="relative grid h-16 w-16 place-items-center rounded-2xl border border-border bg-[color:rgba(0,180,255,0.06)]">
              <span className="absolute -top-2 -left-2 grid h-6 w-6 place-items-center rounded-full border border-brand/50 bg-canvas text-xs font-bold text-brand-2">
                {s.n}
              </span>
              <s.icon className="h-7 w-7 text-brand-2" />
            </div>
            <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
            <p className="text-xs leading-relaxed text-ink-dim">{s.body}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-border bg-[color:rgba(0,180,255,0.04)] py-2.5 text-center text-xs font-medium text-brand-ink">
        Built for developers &amp; autonomous agents. Designed for trust.
      </div>
    </GlassPanel>
  );
}
