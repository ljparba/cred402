/**
 * Verification Engine (mockup 4). Animates the SIX deterministic checks
 * resolving one-by-one from the released report, streaming matching log lines,
 * driving an overall-progress bar, and surfacing proof/trace panels. When all
 * checks have resolved it calls `onComplete` to transition into the report.
 *
 * The checks + verdict are REAL (from the paid/demo report); only their reveal
 * is animated so the wait visually explains what the engine is doing.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, RefreshCw, GaugeCircle } from "lucide-react";
import { GlassPanel, SectionLabel } from "@/components/ui/GlassPanel";
import { CertScanner } from "@/components/viz/CertScanner";
import { HederaNetworkViz } from "@/components/viz/HederaNetworkViz";
import { CopyHash } from "@/components/ui/CopyHash";
import { SystemLog, type LogLine } from "@/components/flow/SystemLog";
import { CHECK_META } from "@/components/lib/verdict";
import type { ReportResponse } from "@/components/lib/api";
import { cn } from "@/lib/utils";

/** Labels for each check as the engine "works" on it (present tense). */
const WORKING_LABEL: Record<string, string> = {
  hash_integrity: "Generating SHA-256 hash",
  credential_known: "Matching Hedera record",
  issuer_registered: "Checking issuer registry",
  revocation: "Reviewing revocation history",
  expiration: "Validating expiration",
  hcs_evidence: "Building verification report",
};

const BASE_LOGS: Omit<LogLine, "id">[] = [
  { time: "00.124", level: "INFO", text: "Upload received", tail: "24.3 KB" },
  { time: "00.231", level: "INFO", text: "File type validated", tail: "application/pdf" },
  { time: "00.357", level: "INFO", text: "Computing SHA-256 hash" },
  { time: "00.623", level: "PASS", text: "Hash computed successfully" },
  { time: "00.842", level: "INFO", text: "Connecting to Hedera Network" },
  { time: "01.014", level: "INFO", text: "HCS topic lookup initiated" },
];

export function VerificationEngine({
  report,
  onComplete,
}: {
  report: ReportResponse;
  onComplete: () => void;
}) {
  const reduce = useReducedMotion();
  const checks = report.checks;
  // Number of checks whose animation has resolved.
  const [resolved, setResolved] = useState(reduce ? checks.length : 0);
  const [logs, setLogs] = useState<LogLine[]>(() =>
    BASE_LOGS.map((l, i) => ({ ...l, id: i })),
  );
  const logId = useRef(BASE_LOGS.length);
  const firedComplete = useRef(false);

  // Reveal checks on a timer, appending a log line per resolution.
  useEffect(() => {
    if (reduce) return;
    if (resolved >= checks.length) return;
    const timer = setTimeout(() => {
      const c = checks[resolved];
      setLogs((prev) => [
        ...prev,
        {
          id: logId.current++,
          time: `0${(1.3 + resolved * 0.4).toFixed(3)}`.slice(0, 6),
          level: c.status === "PASS" ? "PASS" : c.status === "FAIL" ? "FAIL" : c.status === "WARN" ? "WARN" : "INFO",
          text: `${WORKING_LABEL[c.id] ?? c.label}: ${c.status}`,
        },
      ]);
      setResolved((r) => r + 1);
    }, 850);
    return () => clearTimeout(timer);
  }, [resolved, checks, reduce]);

  // When all resolved, pause then transition to the report.
  useEffect(() => {
    if (resolved < checks.length || firedComplete.current) return;
    firedComplete.current = true;
    setLogs((prev) => [
      ...prev,
      { id: logId.current++, time: "done", level: "PASS", text: "Verification report ready" },
    ]);
    const t = setTimeout(onComplete, reduce ? 300 : 1100);
    return () => clearTimeout(t);
  }, [resolved, checks.length, onComplete, reduce]);

  const progress = Math.round((resolved / Math.max(1, checks.length)) * 100);
  const activeIdx = Math.min(resolved, checks.length - 1);

  const topic = useMemo(() => report.hcs?.transactionId ?? null, [report]);
  const uploadedHash = report.hashes.uploaded;

  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <SectionLabel icon={<GaugeCircle className="h-3.5 w-3.5" />}>Verification Engine</SectionLabel>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-[color:rgba(0,180,255,0.06)] px-3 py-1.5 text-xs font-medium text-brand-2">
          <RefreshCw className={cn("h-3.5 w-3.5", !reduce && "animate-spin")} /> Verification in progress
        </span>
      </div>

      {/* One column by default; the desktop 3-column layout only activates at xl.
          Every direct child + card is w-full/min-w-0/max-w-full so no inner child
          (hash text, check card, log line) can render wider than the viewport. */}
      <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,0.9fr)]">
        {/* ── Left: certificate preview + meta ───────────────────────────── */}
        <div className="flex w-full min-w-0 max-w-full flex-col gap-5">
          <GlassPanel className="w-full min-w-0 max-w-full overflow-hidden p-5">
            <SectionLabel>Certificate Preview</SectionLabel>
            <div className="mt-4">
              <CertScanner scanning label="" className="w-full min-w-0 max-w-full [&_*]:!shadow-none" />
            </div>
            <div className="mt-4 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-[color:rgba(5,9,18,0.7)] p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">SHA-256 Hash</p>
              <CopyHash value={uploadedHash} label="uploaded hash" className="mt-1.5 w-full justify-between" />
              <p className="mt-2 text-xs font-medium text-brand-2">Verification in progress…</p>
            </div>
          </GlassPanel>
        </div>

        {/* ── Centre: the six checks ─────────────────────────────────────── */}
        <GlassPanel className="flex w-full min-w-0 max-w-full flex-col p-5 sm:p-6">
          <ol className="w-full min-w-0 space-y-2">
            {checks.map((c, i) => {
              const isResolved = i < resolved;
              const isActive = i === activeIdx && i >= resolved;
              const meta = CHECK_META[c.status];
              return (
                <li
                  key={c.id}
                  className={cn(
                    "w-full min-w-0 max-w-full overflow-hidden rounded-xl border p-4 transition-colors",
                    isResolved ? "border-border bg-[color:rgba(8,14,28,0.5)]" : "border-transparent",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                        isResolved ? meta.ring : "border-border text-ink-faint",
                      )}
                    >
                      {isResolved ? <meta.icon className={cn("h-4 w-4", meta.text)} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("min-w-0 break-words text-sm font-semibold", isResolved ? "text-ink" : "text-ink-dim")}>
                          {c.label}
                        </p>
                        {isResolved ? (
                          <span className={cn("shrink-0 text-xs font-semibold", meta.text)}>{c.status}</span>
                        ) : isActive ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-2" />
                        ) : (
                          <span className="shrink-0 text-xs text-ink-faint">PENDING</span>
                        )}
                      </div>
                      <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-dim">
                        {isResolved ? c.evidence : `${WORKING_LABEL[c.id] ?? c.label}…`}
                      </p>
                      {isResolved && (
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          className={cn("mt-2 h-0.5 origin-left rounded-full", meta.dot)}
                        />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* orbit viz */}
          <div className="mt-4 grid w-full min-w-0 max-w-full place-items-center">
            <HederaNetworkViz className="h-28 w-full min-w-0 max-w-sm opacity-80" />
          </div>

          {/* overall progress */}
          <div className="mt-4 w-full min-w-0 max-w-full rounded-xl border border-border bg-[color:rgba(5,9,18,0.6)] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-brand-2">Overall Progress</span>
              <span className="font-mono text-ink">{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#00b4ff)]"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        </GlassPanel>

        {/* ── Right: logs + proof/trace panels ───────────────────────────── */}
        <div className="flex w-full min-w-0 max-w-full flex-col gap-5">
          <SystemLog lines={logs} live={resolved < checks.length} />

          <GlassPanel className="w-full min-w-0 max-w-full overflow-hidden p-5">
            <SectionLabel>Proof &amp; Trace</SectionLabel>
            <div className="mt-4 grid w-full min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-[color:rgba(5,9,18,0.6)] p-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">HCS Evidence</p>
                <p className="mt-1 truncate font-mono text-xs text-brand-ink">
                  {report.hcs?.sequenceNumber != null ? `seq ${report.hcs.sequenceNumber}` : "—"}
                </p>
              </div>
              <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-[color:rgba(5,9,18,0.6)] p-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">Consensus Tx</p>
                <p className="mt-1 truncate font-mono text-xs text-brand-ink">{topic ?? "pending (testnet keys)"}</p>
              </div>
              <div className="col-span-1 min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-[color:rgba(5,9,18,0.6)] p-3 sm:col-span-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">Verification Trace</p>
                <p className="mt-1 truncate font-mono text-xs text-ink-dim">
                  request {report.requestId}
                </p>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}
