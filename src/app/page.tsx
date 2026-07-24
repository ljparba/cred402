/**
 * Cred402 — the single-page interactive experience.
 *
 * A client-side state machine drives the whole product journey against the
 * built-in API routes:
 *
 *   hero → upload/scan (POST /api/verify) → 402 payment (GET /api/report 402 →
 *   POST /api/pay, falling back to GET /api/report?demo=1) → verification engine
 *   (animated reveal of the released checks) → report.
 *
 * Live data (health, activity, samples) is fetched and polled so the hero feels
 * alive. Everything works WITHOUT testnet keys: the 402 is genuine and the
 * report is released in clearly-labelled simulated mode. Reduced-motion and
 * error/empty states are handled throughout.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { ModeBanner } from "@/components/layout/ModeBanner";
import { NetworkStatusBar } from "@/components/layout/NetworkStatusBar";
import { Hero } from "@/components/sections/Hero";
import { StatCounters } from "@/components/sections/StatCounters";
import { HowItWorksPreview } from "@/components/sections/HowItWorksPreview";
import { Samples } from "@/components/sections/Samples";
import { TamperDemoTeaser } from "@/components/sections/TamperDemoTeaser";
import { UploadScan, type ScanPhase } from "@/components/flow/UploadScan";
import { Payment402, type PayPhase, type PayError } from "@/components/flow/Payment402";
import { VerificationEngine } from "@/components/flow/VerificationEngine";
import { Report } from "@/components/flow/Report";

import { usePoll } from "@/components/lib/hooks";
import {
  api,
  type ActivityResponse,
  type Challenge402,
  type HealthResponse,
  type ReportResponse,
  type SampleItem,
  type SamplesResponse,
  type VerifyResponse,
} from "@/components/lib/api";

type Stage = "landing" | "scan" | "payment" | "engine" | "report";

export default function Home() {
  const reduce = useReducedMotion();

  // ── Live/ambient data ──────────────────────────────────────────────────────
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [samplesData, setSamplesData] = useState<SamplesResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // ~30s cadence (pauses in hidden tabs; the first fetch is still immediate).
  const { data: activity, error: activityError } = usePoll<ActivityResponse>(
    (signal) => api.activity(signal),
    30_000,
    [],
  );

  useEffect(() => {
    const ac = new AbortController();
    api.health(ac.signal).then(setHealth).catch(() => setHealth(null));
    api.samples(ac.signal).then(setSamplesData).catch(() => setSamplesData(null));
    return () => ac.abort();
  }, []);

  // Tick "now" so relative times stay fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const samples: SampleItem[] = samplesData?.samples ?? [];
  const samplesLoading = samplesData === null;

  // ── Flow state ──────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>("landing");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [preview, setPreview] = useState<VerifyResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [payPhase, setPayPhase] = useState<PayPhase>("challenge");
  const [challenge, setChallenge] = useState<Challenge402 | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [payError, setPayError] = useState<PayError | null>(null);

  const flowRef = useRef<HTMLDivElement>(null);
  const scrollToFlow = useCallback(() => {
    requestAnimationFrame(() => {
      flowRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  }, [reduce]);

  const resetFlow = useCallback(() => {
    setSelectedFile(null);
    setScanPhase("idle");
    setPreview(null);
    setScanError(null);
    setPayPhase("challenge");
    setChallenge(null);
    setReport(null);
    setPayError(null);
  }, []);

  /**
   * Return to the landing view. The header logo is a real `<Link href="/">`, but
   * on the homepage that link is a no-op (already at `/`), so we also reset the
   * client-side flow state and scroll to the top — the logo therefore always
   * "goes home" from any in-page flow stage too.
   */
  const goHome = useCallback(() => {
    resetFlow();
    setStage("landing");
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [resetFlow, reduce]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const goToScan = useCallback(() => {
    setStage("scan");
    scrollToFlow();
  }, [scrollToFlow]);

  const goToSamples = useCallback(() => {
    document.getElementById("samples")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }, [reduce]);

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file);
    setScanPhase("idle");
    setPreview(null);
    setScanError(null);
  }, []);

  /** POST the selected file to /api/verify and reveal the locked preview. */
  const runVerify = useCallback(
    async (file: File) => {
      setScanPhase("scanning");
      setScanError(null);
      const started = Date.now();
      try {
        const res = await api.verify(file, file.name);
        // Let the scan animation breathe for a beat.
        const elapsed = Date.now() - started;
        const wait = reduce ? 0 : Math.max(0, 1200 - elapsed);
        setTimeout(() => {
          setPreview(res);
          setScanPhase("identified");
        }, wait);
      } catch (err) {
        const e = err as Error & { status?: number };
        setScanPhase("error");
        setScanError(
          e.status === 415
            ? "That file type isn't supported. Upload a PDF, PNG, or JPG certificate."
            : e.message || "Verification failed. Please try again.",
        );
      }
    },
    [reduce],
  );

  const beginScan = useCallback(() => {
    if (selectedFile) runVerify(selectedFile);
  }, [selectedFile, runVerify]);

  /** Download a sample blob, jump to the scan stage, and verify it. */
  const handleUseSample = useCallback(
    async (sample: SampleItem) => {
      resetFlow();
      setStage("scan");
      scrollToFlow();
      try {
        const blob = await api.sampleBlob(sample.downloadUrl);
        const file = new File([blob], sample.filename, { type: blob.type || "application/pdf" });
        setSelectedFile(file);
        runVerify(file);
      } catch {
        setScanPhase("error");
        setScanError("Couldn't load that sample. Please try again.");
      }
    },
    [resetFlow, runVerify, scrollToFlow],
  );

  /** Move from scan → payment; fetch the genuine 402 challenge. */
  const goToPayment = useCallback(async () => {
    if (!preview) return;
    setStage("payment");
    setPayPhase("challenge");
    scrollToFlow();
    try {
      const res = await api.report(preview.requestId);
      if (res.status === 402 && res.challenge) {
        setChallenge(res.challenge);
      } else if (res.report) {
        // Already released (idempotent) — skip straight to engine.
        setReport(res.report);
        setStage("engine");
      }
    } catch {
      // Non-fatal: the panel still renders the price from the preview.
    }
  }, [preview, scrollToFlow]);

  /**
   * A released report is only allowed to advance the flow when it is COMPLETE:
   * a verdict plus a non-empty checks array plus a payment object. A missing or
   * malformed report keeps the user on the payment screen (never a blank engine).
   */
  const advanceToReport = useCallback(
    (candidate: ReportResponse | undefined | null): boolean => {
      const complete =
        !!candidate &&
        !!candidate.verdict &&
        Array.isArray(candidate.checks) &&
        candidate.checks.length > 0 &&
        !!candidate.payment;
      if (!complete) return false;
      setReport(candidate);
      setPayError(null);
      setPayPhase("unlocked");
      setStage("engine");
      scrollToFlow();
      return true;
    },
    [scrollToFlow],
  );

  /** Map a downstream payment code to a safe on-screen error + next action. */
  const failWith = useCallback((code: string | undefined, retryAfter?: number) => {
    const reupload = new Set(["REQUEST_EXPIRED", "REQUEST_NOT_FOUND", "PAYMENT_ALREADY_CONSUMED"]);
    const pending = new Set(["PAYMENT_IN_PROGRESS", "PAYMENT_CONFIRMATION_PENDING"]);
    let action: PayError["action"] = "retry";
    if (code && reupload.has(code)) action = "reupload";
    else if (code && pending.has(code)) action = "pending";

    const message =
      action === "reupload"
        ? code === "REQUEST_EXPIRED"
          ? "This request expired before payment completed. Upload the file again to get a fresh challenge."
          : code === "PAYMENT_ALREADY_CONSUMED"
            ? "That payment was already used for a report. Upload the file again to start over."
            : "This request is no longer available. Upload the file again."
        : action === "pending"
          ? "A payment for this request is being processed. No second payment was sent — use Check status."
          : code === "RATE_LIMITED"
            ? `Too many payment attempts. Try again in ~${retryAfter ?? 60}s.`
            : "Payment didn't go through. No charge was made — you can try again.";

    setPayError({ code, action, message, retryAfter });
    setPayPhase("challenge");
  }, []);

  /**
   * Pay via the built-in demo wallet. On success (a complete report) advance to
   * the engine; on failure stay on the payment screen with a safe message. The
   * honest ?demo=1 release is used ONLY when this deployment cannot settle at
   * all — never as a fallback in configured mode.
   */
  const pay = useCallback(async () => {
    if (!preview) return;
    // Guard: never start a second payment while one is in flight.
    if (payPhase === "paying" || payPhase === "settling") return;
    setPayError(null);
    setPayPhase("paying");
    const settlementConfigured = preview.payment.configured;
    try {
      const result = await api.pay(preview.requestId);
      if (result.ok) {
        setPayPhase("settling");
        if (advanceToReport(result.report)) return;
        // Paid but the report came back incomplete — do not advance blindly.
        failWith(undefined);
        return;
      }
      if (!result.configured && !settlementConfigured) {
        // No demo wallet AND no live settlement → honest simulated release.
        setPayPhase("settling");
        const demo = await api.report(preview.requestId, { demo: true });
        if (advanceToReport(demo.report)) return;
        failWith(undefined);
        return;
      }
      failWith(result.code, result.retryAfter);
    } catch {
      failWith(undefined);
    }
  }, [preview, payPhase, advanceToReport, failWith]);

  /**
   * PAYMENT-FREE status check for an in-progress/pending request. Re-reads the
   * report resource (no payment) and advances if it has since been released;
   * otherwise keeps the user informed without ever resubmitting payment.
   */
  const checkStatus = useCallback(async () => {
    if (!preview) return;
    setPayPhase("settling");
    try {
      const res = await api.report(preview.requestId);
      if (res.report && advanceToReport(res.report)) return;
      failWith(res.code ?? "PAYMENT_CONFIRMATION_PENDING");
    } catch {
      failWith("PAYMENT_CONFIRMATION_PENDING");
    }
  }, [preview, advanceToReport, failWith]);

  const engineComplete = useCallback(() => {
    setStage("report");
    scrollToFlow();
  }, [scrollToFlow]);

  // Deep link: `/?verify=1` (e.g. the shared nav's "Verify a Certificate" from
  // another route) jumps straight to the scan stage, then cleans the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verify") === "1") {
      setStage("scan");
      requestAnimationFrame(() =>
        flowRef.current?.scrollIntoView({ behavior: "auto", block: "start" }),
      );
      params.delete("verify");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
    }
    // Run once on mount.
  }, []);

  const verifyAnother = useCallback(() => {
    resetFlow();
    setStage("scan");
    scrollToFlow();
  }, [resetFlow, scrollToFlow]);

  // Kick a scan automatically when arriving on the scan stage with a fresh file
  // selected via the hero (keeps the "Begin Scan" affordance for manual uploads).

  // ── Render ────────────────────────────────────────────────────────────────────
  const showLanding = stage === "landing";

  return (
    <div id="top" className="flex min-h-screen flex-col">
      <ModeBanner health={health} />
      <Nav onVerifyClick={goToScan} onLogoClick={goHome} />

      <main className="flex-1 pb-10">
        {/* Landing */}
        {showLanding && (
          <>
            <Hero
              onVerify={goToScan}
              onSamples={goToSamples}
              activity={activity?.items ?? []}
              activityLoading={!activity}
              now={now}
            />

            <div className="mx-auto mt-10 max-w-[1440px] px-4 sm:px-6 lg:px-8">
              {/* Real counts only — an unavailable feed shows "—", never zeros. */}
              <StatCounters stats={activity?.stats ?? null} error={activityError} />
            </div>

            {/* Row — How-It-Works preview (35%, left) + Sample Certificates (65%, right). */}
            <div className="mx-auto mt-8 grid max-w-[1440px] gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)] lg:px-8">
              <HowItWorksPreview />
              <Samples samples={samples} loading={samplesLoading} onUseSample={handleUseSample} />
            </div>

            {/* Original vs. Tampered — Create Tamper Demo (full-width band). */}
            <div className="mx-auto mt-8 max-w-[1440px] px-4 sm:px-6 lg:px-8">
              <TamperDemoTeaser />
            </div>
          </>
        )}

        {/* Interactive flow */}
        <div ref={flowRef}>
          {/* Back to home — kept near the TOP of every flow stage, not only at the
              bottom of a long page (final refinement prompt §7). */}
          {!showLanding && (
            <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-8">
              <button
                onClick={goHome}
                className="inline-flex items-center gap-1.5 text-sm text-ink-dim underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                ← Back to home
              </button>
            </div>
          )}
          <AnimatePresence mode="wait">
            {stage === "scan" && (
              <motion.div
                key="scan"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4 }}
              >
                <UploadScan
                  selectedFile={selectedFile}
                  samples={samples}
                  phase={scanPhase}
                  preview={preview}
                  error={scanError}
                  onFile={handleFile}
                  onUseSample={handleUseSample}
                  onBeginScan={beginScan}
                  onContinue={goToPayment}
                />
              </motion.div>
            )}

            {stage === "payment" && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4 }}
              >
                <Payment402
                  challenge={challenge}
                  preview={preview}
                  phase={payPhase}
                  error={payError}
                  onPay={pay}
                  onCheckStatus={checkStatus}
                  onReupload={verifyAnother}
                  onBack={() => setStage("scan")}
                  onViewSample={() => {
                    const valid = samples.find((s) => s.category === "valid");
                    if (valid) handleUseSample(valid);
                  }}
                />
              </motion.div>
            )}

            {stage === "engine" && report && (
              <motion.div
                key="engine"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4 }}
              >
                <VerificationEngine report={report} onComplete={engineComplete} />
              </motion.div>
            )}

            {stage === "report" && report && (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4 }}
              >
                <Report report={report} preview={preview} onVerifyAnother={verifyAnother} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      <Footer />
      <NetworkStatusBar health={health} />
    </div>
  );
}
