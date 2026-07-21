/**
 * Upload & Scan workspace (mockup 2). Left: dropzone. Centre: the scanner with
 * hash fragments streaming out, plus Begin Scan / Use Sample actions. Right:
 * sample files, issuer hints, and a live scan-process checklist that fills in as
 * the verify request resolves.
 *
 * Drives POST /api/verify via the `onVerify` handler; the parent owns the
 * request lifecycle and passes `phase` + `preview` back down.
 */
"use client";

import { motion } from "framer-motion";
import { Boxes, ArrowRight, Loader2, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { GlassPanel, SectionLabel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { StepProgress } from "@/components/flow/StepProgress";
import { UploadDropzone } from "@/components/flow/UploadDropzone";
import { CertScanner } from "@/components/viz/CertScanner";
import { HashMorph } from "@/components/flow/HashMorph";
import { CopyHash } from "@/components/ui/CopyHash";
import { formatBytes } from "@/components/lib/format";
import type { SampleItem, VerifyResponse } from "@/components/lib/api";
import { cn } from "@/lib/utils";

export type ScanPhase = "idle" | "scanning" | "identified" | "error";

const SCAN_STEPS = [
  { id: "id", label: "Recognize certificate ID", sub: "Extracting unique identifier" },
  { id: "hash", label: "Generate SHA-256 hash", sub: "Creating tamper-proof fingerprint" },
  { id: "prep", label: "Prepare x402 verification", sub: "Initializing payment & report" },
  { id: "anchor", label: "Check Hedera record", sub: "Matching on-chain issuance" },
];

export function UploadScan({
  selectedFile,
  samples,
  phase,
  preview,
  error,
  onFile,
  onUseSample,
  onBeginScan,
  onContinue,
}: {
  selectedFile: File | null;
  samples: SampleItem[];
  phase: ScanPhase;
  preview: VerifyResponse | null;
  error: string | null;
  onFile: (file: File) => void;
  onUseSample: (sample: SampleItem) => void;
  onBeginScan: () => void;
  onContinue: () => void;
}) {
  const scanning = phase === "scanning";
  const identified = phase === "identified";
  const stepIndex = identified ? 2 : scanning ? 1 : 0;

  // Map high-level phase to per-step status for the checklist.
  const stepStatus = (i: number): "done" | "active" | "pending" => {
    if (identified) return "done";
    if (scanning) return i === 0 ? "done" : i === 1 ? "active" : "pending";
    return "pending";
  };

  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionLabel icon={<Boxes className="h-3.5 w-3.5" />}>Upload &amp; Scan</SectionLabel>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Upload your certificate
          </h1>
          <p className="mt-2 max-w-lg text-sm text-ink-dim">
            We&apos;ll securely hash and prepare it for decentralized verification on Hedera.
          </p>
        </div>
        <StepProgress current={stepIndex} className="lg:mb-1" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.85fr)]">
        {/* ── Left: dropzone ─────────────────────────────────────────────── */}
        <GlassPanel className="p-5 sm:p-6">
          <UploadDropzone
            onFile={onFile}
            disabled={scanning}
            selected={selectedFile ? { name: selectedFile.name, size: selectedFile.size } : null}
          />
        </GlassPanel>

        {/* ── Centre: scanner + actions ──────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <CertScanner
              scanning={scanning || identified}
              tone={phase === "error" ? "danger" : identified ? "ok" : "brand"}
              label={identified ? "Scan Complete" : scanning ? "Scanning Certificate" : "Ready to Scan"}
              footer={
                selectedFile ? (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-[color:rgba(5,9,18,0.7)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        File: {selectedFile.name}
                      </p>
                      <p className="text-xs text-ink-dim">{formatBytes(selectedFile.size)}</p>
                    </div>
                    {identified ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" />
                    ) : scanning ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-2" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-ink-faint" />
                    )}
                  </div>
                ) : undefined
              }
            />
            <HashMorph hash={preview?.file.sha256} active={scanning} className="hidden sm:flex" />
          </div>

          {/* preview result / hash */}
          {identified && preview && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-[color:rgba(5,9,18,0.7)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">
                  SHA-256 Hash
                </span>
                <CopyHash value={preview.file.sha256} label="SHA-256 hash" />
              </div>
              {preview.identified && preview.credential ? (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-sm text-ink">
                    Identified:{" "}
                    <span className="font-semibold text-brand-ink">{preview.credential.courseName}</span>
                  </p>
                  <p className="text-xs text-ink-dim">
                    {preview.credential.id} · issued by {preview.credential.issuerName}
                  </p>
                </div>
              ) : (
                <p className="mt-3 border-t border-border pt-3 text-sm text-ink-dim">
                  No registered credential matched by hash — the full report will explain why.
                </p>
              )}
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-warn">
                <AlertCircle className="h-3.5 w-3.5" /> Report locked — payment required to unlock the verdict
              </div>
            </motion.div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-[color:rgba(239,68,68,0.4)] bg-[color:rgba(239,68,68,0.08)] px-4 py-3 text-sm text-danger-soft"
            >
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* actions */}
          <div className="flex flex-wrap gap-3">
            {identified ? (
              <Button size="lg" onClick={onContinue}>
                Continue to Payment <ArrowRight className="h-4.5 w-4.5" />
              </Button>
            ) : (
              <Button size="lg" onClick={onBeginScan} disabled={!selectedFile || scanning}>
                {scanning ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" /> Scanning…
                  </>
                ) : (
                  <>
                    Begin Scan <ArrowRight className="h-4.5 w-4.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* ── Right: sample files → scan process → issuer hints ──────────── */}
        <div className="flex flex-col gap-5">
          {/* Sample Files — ALL samples in a controlled vertical scroll; no
              browse-all link, every sample is selectable directly. */}
          <GlassPanel className="flex min-h-0 flex-col p-5">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Sample Files</SectionLabel>
              <span className="shrink-0 text-xs text-ink-faint">{samples.length} files</span>
            </div>
            <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto scroll-thin pr-1">
              {samples.map((s) => (
                <li key={s.slug}>
                  <button
                    onClick={() => onUseSample(s)}
                    disabled={scanning}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-[color:rgba(8,14,28,0.5)] px-3 py-2.5 text-left transition-colors hover:border-brand/50 disabled:opacity-50"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-[0.6rem] font-bold text-brand-2">
                      {s.filename.split(".").pop()?.toUpperCase().slice(0, 3)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{s.label}</span>
                      <span className="block truncate text-xs capitalize text-ink-faint">{s.category} sample</span>
                    </span>
                  </button>
                </li>
              ))}
              {samples.length === 0 &&
                Array.from({ length: 3 }).map((_, i) => <li key={i} className="skeleton h-14 rounded-lg" />)}
            </ul>
          </GlassPanel>

          {/* Scan Process — moved ABOVE Issuer Hints (final refinement prompt §8). */}
          <GlassPanel className="p-5">
            <SectionLabel>Scan Process</SectionLabel>
            <ol className="mt-4 space-y-3">
              {SCAN_STEPS.map((step, i) => {
                const status = stepStatus(i);
                return (
                  <li key={step.id} className="flex items-start gap-3">
                    <span className="mt-0.5">
                      {status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-ok" />
                      ) : status === "active" ? (
                        <Loader2 className="h-5 w-5 animate-spin text-brand-2" />
                      ) : (
                        <Circle className="h-5 w-5 text-ink-faint" />
                      )}
                    </span>
                    <span>
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          status === "pending" ? "text-ink-dim" : "text-ink",
                        )}
                      >
                        {step.label}
                      </span>
                      <span className="block text-xs text-ink-faint">{step.sub}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </GlassPanel>

          <GlassPanel className="p-5">
            <SectionLabel>Issuer Hints</SectionLabel>
            <p className="mt-3 text-xs text-ink-dim">For best results, certificates should include:</p>
            <ul className="mt-3 space-y-2 text-sm text-ink">
              {["Issuer name or organization", "Recipient's name", "Issue date", "Unique certificate ID"].map((h) => (
                <li key={h} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-2" /> {h}
                </li>
              ))}
            </ul>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}
