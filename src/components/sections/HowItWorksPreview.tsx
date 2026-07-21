/**
 * Compact "How It Works" PREVIEW (homepage Row 2, left).
 *
 * A short three-step teaser — Upload → Pay via x402 → Get Report — that links to
 * the full `/how-it-works` route. Intentionally NOT the full explanation. On
 * mobile the steps stack as compact horizontal row cards (number + icon + title
 * + short description); on wider screens they lay out as a light vertical list
 * so the panel stays balanced beside Live Activity.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { UploadCloud, Wallet, ShieldCheck, ArrowRight } from "lucide-react";
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

export function HowItWorksPreview() {
  return (
    <GlassPanel
      id="how-it-works"
      as="section"
      className="flex flex-col p-6 sm:p-7"
      aria-labelledby="hiw-preview-title"
    >
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>How it Works</SectionLabel>
        <Link
          href="/how-it-works"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-2 hover:underline"
        >
          Full guide <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <h2 id="hiw-preview-title" className="sr-only">
        How Cred402 works — quick preview
      </h2>

      {/* Compact horizontal row cards: number + icon + title + short desc. */}
      <ol className="mt-5 flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.n}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className="flex items-start gap-3 rounded-xl border border-border bg-[color:rgba(8,14,28,0.55)] p-3.5"
          >
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-[color:rgba(0,180,255,0.06)]">
              <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-brand/50 bg-canvas text-[0.62rem] font-bold text-brand-2">
                {s.n}
              </span>
              <s.icon className="h-5 w-5 text-brand-2" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-dim">{s.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>

      <Link
        href="/how-it-works"
        className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-border bg-[color:rgba(0,180,255,0.04)] py-2.5 text-center text-xs font-medium text-brand-ink transition-colors hover:border-brand/50 hover:bg-[color:rgba(0,180,255,0.08)]"
      >
        See the 8-step flow, checks &amp; verdicts <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </GlassPanel>
  );
}
