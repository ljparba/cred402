/**
 * HTTP 402 payment screen (mockup 3). Renders the GENUINE 402 challenge from
 * GET /api/report/{id}: price, payTo, live feePayer, request id, and the raw
 * server response (status + PAYMENT-REQUIRED header). Center shows the
 * wallet→API→Hedera particle flow and a 4-step settlement rail.
 *
 * ONE payment action: "Use Demo Wallet", which calls POST /api/pay (the built-in
 * server-side testnet payer; the parent falls back to ?demo=1 on unconfigured
 * deployments). This used to be rendered as two buttons — "Pay with x402" and
 * "Use Demo Wallet" — wired to the same `onPay` handler, which implied a choice
 * of payment methods that does not exist. Agents settle the same 402 themselves
 * via the API; the link under the button points at that flow.
 *
 * The strip under the actions states implemented properties only: no promise
 * about settlement speed, and no blanket "decentralized/immutable" claim.
 *
 * The real 402 details stay visible at all times so the protocol is demonstrated
 * even when settlement is simulated.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Lock,
  ChevronRight,
  Boxes,
  ShieldCheck,
  Radar,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
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

/**
 * A safe, on-screen payment failure. `action` decides which recovery control is
 * offered — and, crucially, NONE of them auto-submits a second payment:
 *   retry    → a "Try again" button (pre-settlement failures only)
 *   reupload → a "Re-upload" button (expired / not-found requests)
 *   pending  → a "Check status" button (a PAYMENT-FREE report re-read)
 */
export interface PayError {
  code?: string;
  action: "retry" | "reupload" | "pending";
  message: string;
  retryAfter?: number;
}

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
  error,
  onPay,
  onCheckStatus,
  onReupload,
  onBack,
  onViewSample,
}: {
  challenge: Challenge402 | null;
  preview: VerifyResponse | null;
  phase: PayPhase;
  error?: PayError | null;
  onPay: () => void;
  onCheckStatus?: () => void;
  onReupload?: () => void;
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

      {/* One column by default; the 3-column layout only activates at xl. Every
          wrapper/card is w-full/min-w-0/max-w-full so nothing exceeds the mobile
          content column. */}
      <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_minmax(0,0.85fr)]">
        {/* ── Left: request + raw server response ────────────────────────── */}
        <div className="flex w-full min-w-0 max-w-full flex-col gap-5">
          <GlassPanel className="w-full min-w-0 max-w-full overflow-hidden p-5">
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

          <GlassPanel className="w-full min-w-0 max-w-full overflow-hidden border-[color:rgba(239,68,68,0.35)] p-5">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 shrink-0 text-danger" />
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">
                Server Response
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-danger-soft">HTTP 402 Payment Required</p>
            <p className="text-xs text-ink-dim">Pay-per-use access via x402</p>
            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 font-mono text-xs">
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-ink-faint">Status</dt>
                <dd className="min-w-0 break-words text-right text-ink-dim">402 Payment Required</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-ink-faint">Header</dt>
                <dd className="min-w-0 break-words text-right text-ink-dim">PAYMENT-REQUIRED</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-ink-faint">Configured</dt>
                <dd className={cn("min-w-0 break-words text-right", challenge?.configured ? "text-ok" : "text-warn")}>
                  {challenge?.configured ? "true" : "false"}
                </dd>
              </div>
            </dl>
          </GlassPanel>

          {/* locked preview */}
          <GlassPanel className="relative w-full min-w-0 max-w-full overflow-hidden p-5">
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
        <GlassPanel glow className="flex w-full min-w-0 max-w-full flex-col gap-6 overflow-hidden p-5 sm:p-8">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="break-words text-2xl font-bold tracking-tight text-ink sm:text-4xl"
            >
              402 Payment Required
            </motion.h1>
            <p className="mt-2 break-words text-sm text-ink-dim sm:text-base">
              Pay <span className="font-semibold text-brand-ink">{price} tHBAR</span> to unlock the
              verification report.
            </p>
          </div>

          {/* sub-steps rail — shrink-safe 4-col grid, no fixed-width connectors */}
          <ol className="grid w-full min-w-0 max-w-full grid-cols-4 gap-1">
            {SUBSTEPS.map((s, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              return (
                <li key={s.n} className="flex min-w-0 max-w-full flex-col items-center gap-1 text-center">
                  <div className="relative flex w-full min-w-0 items-center justify-center">
                    {i < SUBSTEPS.length - 1 && (
                      <ChevronRight
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 translate-x-1/2",
                          done ? "text-brand" : "text-ink-faint/50",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                        done && "border-brand bg-brand text-white",
                        active && "border-brand bg-[color:rgba(0,180,255,0.14)] text-brand-2",
                        !done && !active && "border-border bg-canvas text-ink-faint",
                      )}
                      aria-current={active ? "step" : undefined}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "min-w-0 max-w-full break-words text-[0.58rem] font-medium leading-tight sm:text-[0.62rem]",
                      active ? "text-brand-2" : "text-ink-faint",
                    )}
                  >
                    {s.title}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* particle flow */}
          <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-[color:rgba(5,9,18,0.5)] p-4 sm:p-6">
            <PaymentFlow active={busy} />
          </div>

          <p className="text-center text-sm text-ink-dim">
            Pay-per-use access. No account required.
          </p>

          {/* Safe payment-failure banner. Stays on THIS screen; the report is
              never advanced without a complete report, and no control here ever
              triggers a second automatic payment. */}
          {error && !busy && (
            <div
              role="alert"
              className="flex w-full min-w-0 max-w-full items-start gap-2.5 rounded-xl border border-[color:rgba(239,68,68,0.35)] bg-[color:rgba(239,68,68,0.08)] p-3.5"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <p className="min-w-0 break-words text-xs text-danger-soft">{error.message}</p>
            </div>
          )}

          {/* action — ONE payment path (the built-in server-side demo wallet).
              A pending/in-progress state offers only a payment-free status check;
              an expired/not-found request offers re-upload; a safe pre-settlement
              failure offers a retry. */}
          <div className="flex w-full min-w-0 max-w-full flex-col items-center gap-2">
            {error?.action === "pending" ? (
              <Button
                size="lg"
                variant="outline"
                className="w-full min-w-0 whitespace-normal text-center"
                onClick={onCheckStatus}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> Checking…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5 shrink-0" /> Check status
                  </>
                )}
              </Button>
            ) : error?.action === "reupload" ? (
              <Button
                size="lg"
                className="w-full min-w-0 whitespace-normal text-center"
                onClick={onReupload}
                disabled={busy}
              >
                <UploadCloud className="h-5 w-5 shrink-0" /> Re-upload to start over
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full min-w-0 whitespace-normal text-center"
                onClick={onPay}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> Settling…
                  </>
                ) : error?.action === "retry" ? (
                  <>
                    <RefreshCw className="h-5 w-5 shrink-0" /> Try again · {price} tHBAR
                  </>
                ) : (
                  <>
                    <Cred402Mark className="h-5 w-5 shrink-0" /> Use Demo Wallet · {price} tHBAR
                  </>
                )}
              </Button>
            )}
            <p className="break-words text-center text-xs text-ink-faint">
              Testnet demo wallet — the server-side payer settles this 402 for you. No wallet
              connect, no account.
            </p>
            <Link
              href="/how-it-works#x402-flow"
              className="break-words text-center text-xs text-brand-2 hover:underline"
            >
              Building an agent? See the x402 API flow
            </Link>
          </div>

          {/* feature strip — 2 cols on mobile, 4 from sm. Implemented properties
              only: no settlement-time promise, no blanket decentralisation claim. */}
          <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
            {[
              { icon: Boxes, t: "HCS Record", s: "Tamper-evident" },
              { icon: HexBadge, t: "Public Evidence", s: "Hedera Testnet", hex: true },
              { icon: ShieldCheck, t: "Tamper Check", s: "Deterministic" },
              { icon: Radar, t: "Mirror Verified", s: "Independent confirmation" },
            ].map((f) => (
              <div key={f.t} className="flex min-w-0 max-w-full items-center gap-2">
                {f.hex ? (
                  <HexBadge size={22} className="shrink-0" />
                ) : (
                  <f.icon className="h-5 w-5 shrink-0 text-brand-2" />
                )}
                <div className="min-w-0">
                  <div className="break-words text-xs font-semibold text-ink">{f.t}</div>
                  <div className="break-words text-[0.65rem] text-ink-faint">{f.s}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* ── Right: transaction preview / metadata ──────────────────────── */}
        <GlassPanel className="flex w-full min-w-0 max-w-full flex-col gap-5 overflow-hidden p-5">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">
            Transaction Preview
          </span>

          <div className="min-w-0">
            <p className="text-xs text-ink-faint">You pay</p>
            <p className="break-words text-3xl font-bold text-ink">
              {price} <span className="text-lg text-ink-dim">tHBAR</span>
            </p>
          </div>

          <div className="min-w-0 border-t border-border pt-4">
            <p className="text-xs text-ink-faint">To</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="min-w-0 break-words text-sm font-medium text-ink">Cred402 API</span>
              <Cred402Mark className="h-6 w-6 shrink-0" />
            </div>
            {payTo ? (
              <CopyHash value={payTo} label="payTo account" className="mt-2 w-full justify-between" />
            ) : (
              <p className="mt-2 break-all font-mono text-xs text-ink-faint">payTo pending (testnet keys)</p>
            )}
          </div>

          <div className="min-w-0 border-t border-border pt-4">
            <p className="text-xs text-ink-faint">Fee Payer (facilitator)</p>
            {feePayer ? (
              <CopyHash value={feePayer} label="fee payer" className="mt-1.5 w-full justify-between" />
            ) : (
              <p className="mt-1.5 break-all font-mono text-xs text-ink-faint">— (advertised once configured)</p>
            )}
          </div>

          <div className="min-w-0 border-t border-border pt-4">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-faint">
              Payment Metadata
            </p>
            {/* Rows stack (label above value) on mobile; horizontal from sm. */}
            <dl className="space-y-3 text-sm">
              {[
                ["Protocol", `x402 v${challenge?.x402Version ?? 2}`],
                ["Network", network],
                ["Asset", asset],
                ["Amount", `${price} tHBAR`],
                ["Scheme", accept?.scheme ?? "exact"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex flex-col items-start gap-0.5 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                >
                  <dt className="shrink-0 text-ink-faint">{k}</dt>
                  <dd className="min-w-0 max-w-full break-all font-mono text-xs text-ink-dim sm:text-right">{v}</dd>
                </div>
              ))}
              <div className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <dt className="shrink-0 text-ink-faint">Request ID</dt>
                <dd className="min-w-0 max-w-full">
                  <CopyHash value={requestId} label="request id" className="w-full justify-between sm:w-auto" />
                </dd>
              </div>
            </dl>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}
