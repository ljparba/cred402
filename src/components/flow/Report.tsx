/**
 * Verification Report (mockup 5). The released report after payment/demo.
 *
 * Renders the per-verdict headline treatment; a credential summary; the six
 * check cards; the payment proof (with an honest "simulated settlement" banner
 * in demo mode while keeping the genuine 402 details discoverable); the HCS
 * proof; HashScan links; a verification-activity timeline; and — for TAMPERED —
 * the anchored-vs-uploaded hash comparison with a byte-level DIFF VIEW.
 *
 * Layout (final refinement prompt §10): a top row of Credential · Verdict ·
 * Payment Proof, then a wide Verification Checks area beside a supporting column
 * of HCS Proof + Verification Activity. Cards align from the top with tight,
 * comfortable gaps — no tall empty columns — and every child is `min-w-0` so long
 * hashes/ids/timestamps wrap safely instead of forcing horizontal overflow.
 */
"use client";

import { motion } from "framer-motion";
import {
  ExternalLink,
  Info,
  RotateCcw,
  ShieldAlert,
  Boxes,
  DollarSign,
  FileText,
  Clock,
} from "lucide-react";
import { GlassPanel, SectionLabel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { VerdictSeal } from "@/components/report/VerdictSeal";
import { CheckCard } from "@/components/report/CheckCard";
import { HashDiff } from "@/components/report/HashDiff";
import { CopyHash } from "@/components/ui/CopyHash";
import { VERDICT_META, TONE_CLASSES } from "@/components/lib/verdict";
import { hashscanTransactionUrl, hashscanAccountUrl } from "@/lib/hedera/hashscan";
import type { ReportResponse, VerifyResponse } from "@/components/lib/api";
import { cn } from "@/lib/utils";

/**
 * A label/value proof row. `mono` values (hashes, tx-ids, account-ids) are
 * `break-all` so a long id wraps within the panel instead of overflowing; the
 * label column stays fixed-width and the value column is allowed to shrink
 * (`min-w-0`) and align right. HashScan links are preserved.
 */
function ProofField({
  label,
  value,
  href,
  mono = false,
}: {
  label: string;
  value: string;
  href?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border py-2 first:border-t-0 first:pt-0">
      <span className="shrink-0 pt-px text-xs text-ink-faint">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex min-w-0 items-start justify-end gap-1 text-right font-mono text-xs text-brand-2 hover:underline",
            mono ? "break-all" : "truncate",
          )}
        >
          <span className={mono ? "break-all" : "truncate"}>{value}</span>
          <ExternalLink className="mt-px h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span
          className={cn(
            "min-w-0 text-right font-mono text-xs text-ink-dim",
            mono ? "break-all" : "truncate",
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export function Report({
  report,
  preview,
  onVerifyAnother,
}: {
  report: ReportResponse;
  preview: VerifyResponse | null;
  onVerifyAnother: () => void;
}) {
  const verdict = report.verdict ?? "UNKNOWN";
  const meta = VERDICT_META[verdict];
  const tone = TONE_CLASSES[meta.tone];
  const isTampered = verdict === "TAMPERED";
  const { payment, hcs } = report;

  const paymentHashscan = payment.hashscanUrl ?? (payment.transactionId ? hashscanTransactionUrl(payment.transactionId) : null);
  const payerHashscan = payment.payer ? hashscanAccountUrl(payment.payer) : null;

  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <SectionLabel icon={<ShieldAlert className="h-3.5 w-3.5" />}>Verification Report</SectionLabel>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Verification Report</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Request {report.requestId} · {report.demo ? "demo release" : "paid release"}
          </p>
        </div>
        <Button variant="outline" onClick={onVerifyAnother}>
          <RotateCcw className="h-4 w-4" /> Verify another
        </Button>
      </div>

      {/* demo banner — honest disclosure, 402 stays real */}
      {report.demo && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start gap-3 rounded-xl border border-[color:rgba(245,158,11,0.4)] bg-[color:rgba(245,158,11,0.08)] p-4"
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <p className="text-sm text-ink-dim">
            <span className="font-semibold text-warn-soft">Testnet demo — settlement simulated.</span>{" "}
            This deployment has no x402 keys configured, so no real payment settled. The{" "}
            <span className="font-medium text-ink">402 challenge shown earlier is genuine</span>; with
            operator + payer keys, this report is released only after a real, Mirror-Node-confirmed
            x402 payment.
          </p>
        </motion.div>
      )}

      <div className="flex flex-col gap-5">
        {/*
          Top row — Credential · Verdict · Payment Proof. Cards align from the top
          (`items-start`) with tight gaps. On mobile the verdict leads (order-1),
          then credential, then payment proof. `min-w-0` everywhere so long
          hashes/ids/timestamps wrap instead of overflowing.
        */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
          {/* Credential summary */}
          <div className="order-2 min-w-0 lg:order-none">
            <GlassPanel className="p-5">
              <SectionLabel>Credential</SectionLabel>
              <div className="mt-4 space-y-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-ink-faint">Credential ID</p>
                  <p className="break-all font-mono text-ink">{report.credential?.id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-faint">Status</p>
                  <p className={cn("font-semibold", tone.text)}>{meta.label}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-ink-faint">File Name</p>
                  <p className="break-words text-ink">{preview?.file.name ?? "—"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-ink-faint">File Hash (uploaded)</p>
                  <CopyHash value={report.hashes.uploaded} label="uploaded hash" className="mt-1 w-full justify-between" />
                </div>
                {report.hashes.anchored && (
                  <div className="min-w-0">
                    <p className="text-xs text-ink-faint">Anchored Hash (original)</p>
                    <CopyHash value={report.hashes.anchored} label="anchored hash" className="mt-1 w-full justify-between" />
                  </div>
                )}
              </div>
            </GlassPanel>
          </div>

          {/* Verdict banner (+ tamper hash comparison directly beneath it) */}
          <div className="order-1 min-w-0 lg:order-none">
            <VerdictSeal verdict={verdict} subtitle={verdictSubtitle(verdict)} />

            {isTampered && report.hashes.anchored && (
              <GlassPanel glow={false} className="mt-5 border-[color:rgba(239,68,68,0.35)] p-5">
                <SectionLabel className="text-danger-soft">Hash Comparison</SectionLabel>
                <div className="mt-3 space-y-3">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-ink-faint">Anchored Hash (Original)</p>
                    <CopyHash value={report.hashes.anchored} label="anchored hash" className="w-full justify-between" />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs text-ink-faint">Uploaded Hash (Current)</p>
                    <CopyHash value={report.hashes.uploaded} label="uploaded hash" className="w-full justify-between" />
                  </div>
                </div>
                <HashDiff anchored={report.hashes.anchored} uploaded={report.hashes.uploaded} className="mt-4" />
              </GlassPanel>
            )}
          </div>

          {/* Payment Proof */}
          <div className="order-3 min-w-0 lg:order-none">
            <GlassPanel className={cn("p-5", payment.simulated ? "" : "glow-ok")}>
              <div className="flex items-center justify-between gap-2">
                <SectionLabel icon={<DollarSign className="h-3.5 w-3.5" />}>Payment Proof</SectionLabel>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider",
                    payment.simulated
                      ? "border-[color:rgba(245,158,11,0.4)] text-warn"
                      : "border-[color:rgba(34,197,94,0.4)] text-ok",
                  )}
                >
                  {payment.simulated ? "Simulated" : "Settled"}
                </span>
              </div>
              <div className="mt-4 space-y-0.5">
                <ProofField label="Amount" value={`${payment.amountHbar} ${payment.currencyLabel}`} />
                <ProofField label="Network" value={payment.network} />
                <ProofField
                  label="Transaction"
                  value={payment.transactionId ?? "— (simulated)"}
                  href={paymentHashscan}
                  mono
                />
                <ProofField label="Payer" value={payment.payer ?? "—"} href={payerHashscan} mono />
                <ProofField label="Pay To" value={payment.payTo ?? "—"} mono />
                <ProofField
                  label="Mirror Verified"
                  value={payment.mirrorVerified ? "yes" : payment.simulated ? "n/a (demo)" : "pending"}
                />
                <ProofField label="Consensus Ts" value={payment.consensusTimestamp ?? "—"} mono />
              </div>
            </GlassPanel>
          </div>
        </div>

        {/*
          Main content — a wide Verification Checks area beside a supporting
          column of HCS Proof + Verification Activity, so the HCS proof stays
          close to the checks it backs. Single column on mobile/tablet.
        */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          {/* Verification Checks (wide) */}
          <div className="min-w-0">
            <SectionLabel className="mb-3">Verification Checks</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {report.checks.map((c, i) => (
                <CheckCard
                  key={c.id}
                  check={c}
                  index={i}
                  hashscanUrl={c.id === "hcs_evidence" && hcs?.transactionId ? hashscanTransactionUrl(hcs.transactionId) : null}
                />
              ))}
            </div>
          </div>

          {/* Supporting column: HCS Proof + Verification Activity */}
          <div className="flex min-w-0 flex-col gap-5">
            <GlassPanel className="p-5">
              <SectionLabel icon={<Boxes className="h-3.5 w-3.5" />}>HCS Proof</SectionLabel>
              <div className="mt-4 space-y-0.5">
                <ProofField
                  label="Sequence"
                  value={hcs?.sequenceNumber != null ? String(hcs.sequenceNumber) : "—"}
                />
                <ProofField
                  label="Transaction"
                  value={hcs?.transactionId ?? "pending (testnet keys)"}
                  href={hcs?.transactionId ? hashscanTransactionUrl(hcs.transactionId) : null}
                  mono
                />
                <ProofField label="Anchored Hash" value={report.hashes.anchored ?? "—"} mono />
              </div>
            </GlassPanel>

            <GlassPanel className="p-5">
              <SectionLabel icon={<Clock className="h-3.5 w-3.5" />}>Verification Activity</SectionLabel>
              <ol className="mt-4 space-y-3">
                {[
                  { icon: FileText, t: "Certificate uploaded", s: preview?.file.name ?? "certificate" },
                  { icon: Boxes, t: "SHA-256 computed", s: "tamper-proof fingerprint" },
                  { icon: ShieldAlert, t: `Verdict resolved`, s: meta.label },
                  {
                    icon: DollarSign,
                    t: payment.simulated ? "Payment simulated" : "Payment settled",
                    s: `${payment.amountHbar} ${payment.currencyLabel}`,
                  },
                ].map((row, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-[color:rgba(0,180,255,0.05)]">
                      <row.icon className="h-4 w-4 text-brand-2" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{row.t}</p>
                      <p className="truncate text-xs text-ink-faint">{row.s}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </GlassPanel>
          </div>
        </div>
      </div>
    </section>
  );
}

function verdictSubtitle(verdict: string): string {
  switch (verdict) {
    case "VALID":
      return "The uploaded file matches the original anchored hash on Hedera.";
    case "TAMPERED":
      return "The uploaded file does not match the original anchored hash.";
    case "REVOKED":
      return "The issuer revoked this credential — a CREDENTIAL_REVOKED event exists.";
    case "EXPIRED":
      return "This credential is outside its valid time window.";
    case "UNREGISTERED_ISSUER":
      return "The issuing organisation is not a registered Cred402 issuer.";
    default:
      return "No matching anchored record was found for this file.";
  }
}
