/**
 * HTTP 402 payment screen (mockup 3). Renders the GENUINE 402 challenge from
 * GET /api/report/{id}: price, payTo, live feePayer, request id, and the raw
 * server response (status + PAYMENT-REQUIRED header). Center shows the
 * wallet→API→Hedera particle flow and a 4-step settlement rail. Two actions:
 * "Pay with x402" and "Use Demo Wallet" (both call POST /api/pay; the parent
 * falls back to ?demo=1 on unconfigured deployments).
 *
 * The real 402 details stay visible at all times so the protocol is demonstrated
 * even when settlement is simulated.
 */
"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Lock,
  ChevronRight,
  Boxes,
  ShieldCheck,
  Zap,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Cred402Mark } from "@/components/brand/Logo";
import { HexBadge } from "@/components/brand/HexBadge";
import { PaymentFlow } from "@/components/viz/PaymentFlow";
import { CopyHash } from "@/components/ui/CopyHash";
import type { Challenge402, VerifyResponse } from "@/components/lib/api";
import { cn } from "@/lib/utils";

export type PayPhase = "challenge" | "paying" | "settling" | "unlocked";

const SUBSTEPS = [
  { n: 1, title: "Request", sub: "Report requested" },
  { n: 2, title: "Payment Required", sub: "402 returned" },
  { n: 3, title: "Settlement", sub: "Payment on Hedera" },
  { n: 4, title: "Report Unlocked", sub: "Access granted" },
];

function activeSub(phase: PayPhase): number {
  if (phase === "unlocked") return 3;
  if (phase === "settling" || phase === "paying") return 2;
  return 1;
}

export function Payment402({
  challenge,
  preview,
  phase,
  onPay,
  onBack,
  onViewSample,
}: {
  challenge: Challenge402 | null;
  preview: VerifyResponse | null;
  phase: PayPhase;
  onPay: () => void;
  onBack: () => void;
  onViewSample?: () => void;
}) {
  const accept = challenge?.accepts?.[0];
  const price =
    preview?.payment.amountHbar ?? challenge?.price?.amountHbar ?? "0.10";
  const payTo = accept?.payTo ?? preview?.payment.payTo ?? null;
  const feePayer = accept?.extra?.feePayer ?? null;
  const network = accept?.network ?? challenge?.price?.network ?? preview?.payment.network ?? "hedera:testnet";
  const asset = accept?.asset ?? challenge?.price?.asset ?? preview?.payment.asset ?? "0.0.0";
  const requestId = challenge?.requestId ?? preview?.requestId ?? "—";
  const busy = phase === "paying" || phase === "settling";
  const activeIdx = activeSub(phase);

  const courseLabel = preview?.credential?.courseName ?? preview?.file.name ?? "credential";

  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Scan
      </button>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_minmax(0,0.85fr)]">
        {/* ── Left: request + raw server response ────────────────────────── */}
        <div className="flex flex-col gap-5">
          <GlassPanel className="p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-ok" />
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">
                Request Submitted
              </span>
            </div>
            <p className="mt-3 text-sm text-ink-dim">
              You requested a verification report for{" "}
              <span className="font-medium text-ink">{courseLabel}</span>.
            </p>
          </GlassPanel>

          <GlassPanel className="border-[color:rgba(239,68,68,0.35)] p-5">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-danger" />
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">
                Server Response
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-danger-soft">HTTP 402 Payment Required</p>
            <p className="text-xs text-ink-dim">Pay-per-use access via x402</p>
            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 font-mono text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Status</dt>
                <dd className="text-ink-dim">402 Payment Required</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Header</dt>
                <dd className="text-ink-dim">PAYMENT-REQUIRED</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Configured</dt>
                <dd className={challenge?.configured ? "text-ok" : "text-warn"}>
                  {challenge?.configured ? "true" : "false"}
                </dd>
              </div>
            </dl>
          </GlassPanel>

          {/* locked preview */}
          <GlassPanel className="relative overflow-hidden p-5">
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full border border-border bg-[color:rgba(5,9,18,0.7)]">
                <Lock className="h-6 w-6 text-ink-faint" />
              </div>
              <p className="text-sm font-semibold text-ink">Verification report is locked</p>
              <p className="text-xs text-ink-dim">Complete payment to unlock full details</p>
            </div>
            {onViewSample && (
              <Button variant="outline" size="sm" className="w-full" onClick={onViewSample}>
                View a Sample Report
              </Button>
            )}
          </GlassPanel>
        </div>

        {/* ── Centre: 402 headline + flow + actions ──────────────────────── */}
        <GlassPanel glow className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            >
              402 Payment Required
            </motion.h1>
            <p className="mt-2 text-sm text-ink-dim sm:text-base">
              Pay <span className="font-semibold text-brand-ink">{price} tHBAR</span> to unlock the
              verification report.
            </p>
          </div>

          {/* sub-steps rail */}
          <ol className="flex items-start justify-between gap-1">
            {SUBSTEPS.map((s, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              return (
                <li key={s.n} className="flex min-w-0 flex-1 items-start gap-1">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                        done && "border-brand bg-brand text-white",
                        active && "border-brand bg-[color:rgba(0,180,255,0.14)] text-brand-2",
                        !done && !active && "border-border text-ink-faint",
                      )}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
                    </span>
                    <span
                      className={cn(
                        "w-full text-[0.6rem] font-medium leading-tight sm:text-[0.62rem]",
                        active ? "text-brand-2" : "text-ink-faint",
                      )}
                    >
                      {s.title}
                    </span>
                  </div>
                  {i < SUBSTEPS.length - 1 && (
                    <ChevronRight className={cn("mt-2 h-4 w-4 shrink-0", done ? "text-brand" : "text-ink-faint/50")} />
                  )}
                </li>
              );
            })}
          </ol>

          {/* particle flow */}
          <div className="rounded-2xl border border-border bg-[color:rgba(5,9,18,0.5)] p-5 sm:p-6">
            <PaymentFlow active={busy} />
          </div>

          <p className="text-center text-sm text-ink-dim">
            Pay-per-use access. No account required.
          </p>

          {/* actions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" onClick={onPay} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Settling…
                </>
              ) : (
                <>
                  <HexBadge size={22} glow={false} /> Pay with x402 · {price} tHBAR
                </>
              )}
            </Button>
            <Button size="lg" variant="outline" onClick={onPay} disabled={busy}>
              <Cred402Mark className="h-5 w-5" /> Use Demo Wallet
            </Button>
          </div>

          {/* feature strip */}
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
            {[
              { icon: Boxes, t: "HCS Proof", s: "Delivered" },
              { icon: HexBadge, t: "Decentralized", s: "Immutable", hex: true },
              { icon: ShieldCheck, t: "Tamper Check", s: "Deterministic" },
              { icon: Zap, t: "Fast Settlement", s: "~2-5 seconds" },
            ].map((f) => (
              <div key={f.t} className="flex items-center gap-2">
                {f.hex ? <HexBadge size={22} /> : <f.icon className="h-5 w-5 text-brand-2" />}
                <div>
                  <div className="text-xs font-semibold text-ink">{f.t}</div>
                  <div className="text-[0.65rem] text-ink-faint">{f.s}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* ── Right: transaction preview / metadata ──────────────────────── */}
        <GlassPanel className="flex flex-col gap-5 p-5">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">
            Transaction Preview
          </span>

          <div>
            <p className="text-xs text-ink-faint">You pay</p>
            <p className="text-3xl font-bold text-ink">
              {price} <span className="text-lg text-ink-dim">tHBAR</span>
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-ink-faint">To</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">Cred402 API</span>
              <Cred402Mark className="h-6 w-6" />
            </div>
            {payTo ? (
              <CopyHash value={payTo} label="payTo account" className="mt-2 w-full justify-between" />
            ) : (
              <p className="mt-2 font-mono text-xs text-ink-faint">payTo pending (testnet keys)</p>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-ink-faint">Fee Payer (facilitator)</p>
            {feePayer ? (
              <CopyHash value={feePayer} label="fee payer" className="mt-1.5 w-full justify-between" />
            ) : (
              <p className="mt-1.5 font-mono text-xs text-ink-faint">— (advertised once configured)</p>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">
              Payment Metadata
            </p>
            <dl className="space-y-2 text-sm">
              {[
                ["Protocol", `x402 v${challenge?.x402Version ?? 2}`],
                ["Network", network],
                ["Asset", asset],
                ["Amount", `${price} tHBAR`],
                ["Scheme", accept?.scheme ?? "exact"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="text-ink-faint">{k}</dt>
                  <dd className="truncate font-mono text-xs text-ink-dim">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-faint">Request ID</dt>
                <dd className="truncate">
                  <CopyHash value={requestId} label="request id" />
                </dd>
              </div>
            </dl>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}
