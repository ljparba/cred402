/**
 * Hero (mockup 1). Headline + tagline + primary CTAs and the three feature cards
 * on the left; the animated certificate scanner in the centre with a live
 * SHA-256 status strip; and the live activity feed on the right.
 *
 * The right column used to repeat the HCS/x402/tamper "proof cards" already shown
 * elsewhere on the page — that redundant panel is replaced by the real
 * {@link LiveActivity} feed so the hero shows something live and non-duplicative.
 * On mobile the three areas stack into one full-width row each (headline →
 * scanner → live activity) rather than being squeezed into a narrow column.
 *
 * The scanner's hash/verdict strip is FIXED sample content, so it is labelled
 * "Illustrative preview" — only the Live Activity column shows real data.
 */
"use client";

import { motion } from "framer-motion";
import { ArrowRight, FileText, Boxes, DollarSign, ShieldCheck, CheckCircle2, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CertScanner } from "@/components/viz/CertScanner";
import { LiveActivity } from "@/components/sections/LiveActivity";
import type { ActivityItem } from "@/components/lib/api";

const FEATURES: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: Boxes, title: "HCS Proof", sub: "On-chain issuance evidence" },
  { icon: DollarSign, title: "x402 Payment", sub: "Genuine pay-per-use gate" },
  { icon: ShieldCheck, title: "Tamper Detection", sub: "Byte-level hash integrity" },
];

export function Hero({
  onVerify,
  onSamples,
  activity,
  activityLoading,
  now,
}: {
  onVerify: () => void;
  onSamples: () => void;
  activity: ActivityItem[];
  activityLoading: boolean;
  now: number;
}) {
  return (
    <section className="relative mx-auto max-w-[1440px] px-4 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,0.9fr)] lg:items-stretch">
        {/* ── Left: headline ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex min-w-0 max-w-xl flex-col justify-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-brand-2">
            <ShieldCheck className="h-4 w-4" />
            Verifiable · Transparent · Trusted
          </div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
            Pay-per-use credential verification on{" "}
            <span className="text-gradient-brand">Hedera</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-dim">
            Upload a certificate, pay with x402, and receive a tamper-aware
            verification report backed by Hedera Consensus Service.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={onVerify}>
              Verify a Certificate <ArrowRight className="h-4.5 w-4.5" />
            </Button>
            <Button size="lg" variant="outline" onClick={onSamples}>
              <FileText className="h-4.5 w-4.5" /> View Samples
            </Button>
          </div>

          {/* feature chips — one per row on mobile, 3-up from sm */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-3 rounded-xl border border-border bg-[color:rgba(8,14,28,0.6)] p-3 sm:flex-col sm:items-start sm:gap-0"
              >
                <f.icon className="h-5 w-5 shrink-0 text-brand-2 sm:mb-2" />
                <div className="min-w-0">
                  <div className="text-[0.8rem] font-semibold text-ink">{f.title}</div>
                  <div className="text-[0.68rem] text-ink-faint">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Centre: scanner ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex min-w-0 flex-col justify-center"
        >
          <CertScanner
            label="Scanning Certificate"
            footer={
              <div className="mt-4 rounded-xl border border-border bg-[color:rgba(5,9,18,0.7)] p-4">
                {/* This panel is FIXED example content, not a live verification and
                    not live network data — say so before showing the hash/verdict. */}
                <span className="inline-flex max-w-full items-center gap-1.5 break-words rounded-full border border-border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  <Info className="h-3 w-3 shrink-0" aria-hidden />
                  Illustrative preview
                </span>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">
                    SHA-256 Hash
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-sm text-brand-ink">
                  4f9c28e3b0a7…7c9d6f2a91e3
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">
                    Status
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok">
                    <CheckCircle2 className="h-4 w-4" />
                    Valid · Anchored on Hedera
                  </span>
                </div>
                <p className="mt-2 break-words text-[0.65rem] leading-snug text-ink-faint">
                  Sample anchored credential — example content, not the result of a live
                  verification. Upload a file to run a real one.
                </p>
              </div>
            }
          />
        </motion.div>

        {/* ── Right: live activity (replaces the redundant proof panel) ───── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="flex min-w-0"
        >
          <LiveActivity
            items={activity}
            loading={activityLoading}
            now={now}
            className="h-full w-full"
          />
        </motion.div>
      </div>
    </section>
  );
}
