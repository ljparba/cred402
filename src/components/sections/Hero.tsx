/**
 * Hero (mockup 1). Headline + tagline + primary CTAs on the left; the animated
 * certificate scanner in the centre with a live SHA-256 status strip; the HCS
 * network visualization + proof feature cards on the right.
 */
"use client";

import { motion } from "framer-motion";
import { ArrowRight, FileText, Boxes, DollarSign, ShieldCheck, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CertScanner } from "@/components/viz/CertScanner";
import { HederaNetworkViz } from "@/components/viz/HederaNetworkViz";
import { HexBadge } from "@/components/brand/HexBadge";

const FEATURES: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: Boxes, title: "HCS Proof", sub: "On-chain issuance evidence" },
  { icon: DollarSign, title: "x402 Payment", sub: "Genuine pay-per-use gate" },
  { icon: ShieldCheck, title: "Tamper Detection", sub: "Byte-level hash integrity" },
];

const PROOF_CARDS = [
  { title: "HCS Proof", status: "Anchored", detail: "Hedera Consensus Service" },
  { title: "x402 Payment", status: "Settled", detail: "Independent Mirror proof" },
  { title: "Tamper Detection", status: "Deterministic", detail: "SHA-256 comparison" },
];

export function Hero({ onVerify, onSamples }: { onVerify: () => void; onSamples: () => void }) {
  return (
    <section className="relative mx-auto max-w-[1440px] px-4 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,0.9fr)]">
        {/* ── Left: headline ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-xl"
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

          {/* feature chips */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-[color:rgba(8,14,28,0.6)] p-3"
              >
                <f.icon className="h-5 w-5 text-brand-2" />
                <div className="mt-2 text-[0.8rem] font-semibold text-ink">{f.title}</div>
                <div className="text-[0.68rem] text-ink-faint">{f.sub}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Centre: scanner ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <CertScanner
            label="Scanning Certificate"
            footer={
              <div className="mt-4 rounded-xl border border-border bg-[color:rgba(5,9,18,0.7)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">
                    SHA-256 Hash
                  </span>
                </div>
                <p className="mt-1 font-mono text-sm text-brand-ink">
                  4f9c28e3b0a7…7c9d6f2a91e3
                </p>
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">
                    Status
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok">
                    <CheckCircle2 className="h-4 w-4" />
                    Valid · Anchored on Hedera
                  </span>
                </div>
              </div>
            }
          />
        </motion.div>

        {/* ── Right: network + proof cards ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="hidden lg:block"
        >
          <div className="mb-3 flex items-center gap-3">
            <HexBadge size={34} />
            <div>
              <div className="text-sm font-semibold text-ink">Hedera Consensus Service</div>
              <div className="text-[0.7rem] text-ink-faint">Decentralized · Immutable · Verifiable</div>
            </div>
          </div>
          <HederaNetworkViz className="h-40 w-full" />
          <div className="mt-3 space-y-2.5">
            {PROOF_CARDS.map((c) => (
              <div
                key={c.title}
                className="flex items-center gap-3 rounded-xl border border-border bg-[color:rgba(8,14,28,0.6)] px-3.5 py-2.5"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">{c.title}</div>
                  <div className="truncate text-[0.7rem] text-ink-faint">{c.detail}</div>
                </div>
                <span className="ml-auto shrink-0 text-xs font-medium text-ok">{c.status}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
