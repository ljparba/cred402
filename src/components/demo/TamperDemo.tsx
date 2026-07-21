/**
 * Create Tamper Demo — multi-step interface (plan §8.3, work item 7).
 *
 * A guided flow that lets anyone PROVE tamper-evidence end to end:
 *
 *   1 Upload original       → choose the file to anchor
 *   2 Anchor proof          → POST /api/demo/register (staged progress, not a
 *                             bare spinner); the file is hashed + a synthetic
 *                             demo credential is anchored on HCS (when keyed)
 *   3 Save demo ID          → copy the demoCredentialId + original hash + open
 *                             HashScan; persisted in state + sessionStorage
 *   4 Modify file locally    → clear instructions to edit any byte of the file
 *   5 Upload modified copy    → re-verify with credentialId=<demoCredentialId>
 *   6 View tamper result      → reuse the existing report flow (VALID for the
 *                             unchanged original, TAMPERED for the modified copy)
 *
 * SAFETY: registration + payment are REAL when configured. This component only
 * calls those endpoints on an explicit user click, and is fully gated on
 * `GET /api/health → tamperDemo.enabled`. When disabled it shows a friendly
 * "owner must enable TAMPER_DEMO_ENABLED" state and never attempts registration.
 *
 * The honest disclaimer is shown BEFORE and AFTER registration.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Info,
  Check,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  Loader2,
  Ban,
  FileWarning,
  Pencil,
  Lock,
} from "lucide-react";
import { GlassPanel, SectionLabel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { CopyHash } from "@/components/ui/CopyHash";
import { UploadDropzone } from "@/components/flow/UploadDropzone";
import { AnchorProgress } from "@/components/demo/AnchorProgress";
import { Report } from "@/components/flow/Report";
import { VerificationEngine } from "@/components/flow/VerificationEngine";
import {
  api,
  type ApiThrown,
  type DemoRegisterResponse,
  type HealthResponse,
  type ReportResponse,
  type VerifyResponse,
} from "@/components/lib/api";
import { cn } from "@/lib/utils";

const DISCLAIMER =
  "Demo registration proves whether a file changed after it was anchored. It does not prove " +
  "that the uploader is a real school, authorized issuer, or owner of the credential.";

const STEPS = [
  "Upload original",
  "Anchor proof",
  "Save demo ID",
  "Modify file",
  "Upload modified copy",
  "Tamper result",
] as const;

type Step = 0 | 1 | 2 | 3 | 4 | 5;
type ReportPhase = "engine" | "report";
const SESSION_KEY = "cred402:tamper-demo";

/** Friendly copy per known server error code. */
function errorCopy(code?: string): { title: string; body: string } {
  switch (code) {
    case "FEATURE_DISABLED":
      return {
        title: "Demo disabled on this deployment",
        body: "The owner can enable it by setting TAMPER_DEMO_ENABLED=true.",
      };
    case "NOT_TESTNET":
      return { title: "Testnet only", body: "The tamper demo runs on Hedera testnet only." };
    case "RATE_LIMITED":
      return {
        title: "Rate limit reached",
        body: "Too many demo registrations from your network. Please try again later.",
      };
    case "INVALID_FILE":
    case "NO_FILE":
      return { title: "Unsupported file", body: "Upload a PDF, PNG, or JPG under the size limit." };
    default:
      return { title: "Registration failed", body: "Something went wrong. Please try again." };
  }
}

export function TamperDemo({ health }: { health: HealthResponse | null }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>(0);

  // ── Step 1/2: original + registration ──────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState<DemoRegisterResponse | null>(null);
  const [regError, setRegError] = useState<{ title: string; body: string } | null>(null);

  // ── Step 5/6: modified copy + report handoff ────────────────────────────────
  const [modifiedFile, setModifiedFile] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [preview, setPreview] = useState<VerifyResponse | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [reportPhase, setReportPhase] = useState<ReportPhase>("engine");

  const enabled = health?.tamperDemo.enabled ?? false;
  const configured = health?.mode === "configured";

  // Restore a previously-saved demo id so refreshing mid-demo keeps context.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as DemoRegisterResponse;
        if (saved?.demoCredentialId) {
          setRegistration(saved);
          setStep((s) => (s < 3 ? 3 : s));
        }
      }
    } catch {
      /* ignore malformed/absent session state */
    }
  }, []);

  const persist = useCallback((reg: DemoRegisterResponse) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(reg));
    } catch {
      /* sessionStorage unavailable — in-memory state still works */
    }
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const register = useCallback(async () => {
    if (!originalFile || !enabled) return;
    setRegistering(true);
    setRegError(null);
    setStep(1);
    try {
      const res = await api.demoRegister(originalFile, originalFile.name, label.trim() || undefined);
      setRegistration(res);
      persist(res);
      // Let the "Complete" stage land before advancing.
      setTimeout(() => setStep(2), reduce ? 0 : 600);
    } catch (err) {
      const e = err as ApiThrown;
      setRegError(errorCopy(e.code));
      setStep(0);
    } finally {
      setRegistering(false);
    }
  }, [originalFile, enabled, label, persist, reduce]);

  /**
   * Re-verify the modified copy, bound to the demo credential id. Then reuse the
   * EXISTING report flow: GET the 402'd report, fall back to ?demo=1 on
   * unconfigured deployments, or POST /api/pay when the user is on a keyed
   * deployment. The genuine 402 gate is never bypassed on a configured server.
   */
  const runTamperVerify = useCallback(
    async (file: File) => {
      if (!registration) return;
      setVerifying(true);
      setVerifyError(null);
      try {
        const pv = await api.verify(file, file.name, registration.demoCredentialId);
        setPreview(pv);

        // Ask for the report. On a keyed deployment this 402s until paid, so we
        // pay via the built-in demo wallet on this explicit user action; on an
        // unconfigured deployment we take the honest ?demo=1 release.
        const first = await api.report(pv.requestId);
        if (first.report) {
          setReport(first.report);
        } else {
          const pay = await api.pay(pv.requestId);
          if (pay.ok && pay.report) {
            setReport(pay.report);
          } else {
            const demo = await api.report(pv.requestId, { demo: true });
            if (demo.report) setReport(demo.report);
            else throw new Error("Could not release the report.");
          }
        }
        setReportPhase("engine");
        setStep(5);
      } catch (err) {
        const e = err as ApiThrown;
        setVerifyError(
          e.status === 415
            ? "That file type isn't supported. Upload a PDF, PNG, or JPG."
            : e.message || "Verification failed. Please try again.",
        );
      } finally {
        setVerifying(false);
      }
    },
    [registration],
  );

  const restart = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setStep(0);
    setOriginalFile(null);
    setLabel("");
    setRegistration(null);
    setRegError(null);
    setModifiedFile(null);
    setPreview(null);
    setReport(null);
    setVerifyError(null);
  }, []);

  const hcsUrl = registration?.hcs?.hashscanUrl ?? null;

  // ── Disabled / gated state ──────────────────────────────────────────────────
  if (health && !enabled) {
    return (
      <GlassPanel className="p-6 sm:p-8" id="tamper-demo">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-[color:rgba(245,158,11,0.4)] bg-[color:rgba(245,158,11,0.08)]">
            <Ban className="h-7 w-7 text-warn" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink">Create Tamper Demo is disabled here</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-dim">
              This demo writes a real proof to Hedera, so it is off by default. The deployment owner
              enables it by setting{" "}
              <code className="rounded bg-[color:rgba(0,180,255,0.08)] px-1.5 py-0.5 font-mono text-xs text-brand-ink">
                TAMPER_DEMO_ENABLED=true
              </code>
              {!(health?.tamperDemo.testnet ?? true) && " on a Hedera testnet deployment"}.
            </p>
          </div>
          <p className="mx-auto max-w-lg rounded-xl border border-border bg-[color:rgba(8,14,28,0.5)] p-3 text-xs leading-relaxed text-ink-faint">
            You can still explore the flagship original-vs-tampered demonstration using the seeded
            sample certificates on the homepage — the mechanism is identical.
          </p>
        </div>
      </GlassPanel>
    );
  }

  return (
    <div id="tamper-demo" className="flex flex-col gap-6">
      {/* Stepper */}
      <StepRail current={step} />

      {/* Persistent honest disclaimer (before AND after registration) */}
      <div className="flex items-start gap-3 rounded-xl border border-[color:rgba(245,158,11,0.35)] bg-[color:rgba(245,158,11,0.06)] p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
        <p className="text-sm leading-relaxed text-ink-dim">
          <span className="font-semibold text-warn-soft">Disclaimer.</span> {DISCLAIMER} Records are
          labelled <span className="font-medium text-ink">Synthetic · Demo · Hedera Testnet · Cred402 Demo Issuer</span>.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Steps 0–2: upload + anchor + save ─────────────────────────────── */}
        {step <= 2 && (
          <motion.div
            key="register"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            {/* Left: upload / progress */}
            <GlassPanel className="p-5 sm:p-6">
              {step === 0 && (
                <>
                  <SectionLabel>Step 1 · Upload original</SectionLabel>
                  <p className="mb-4 mt-3 text-sm text-ink-dim">
                    Choose the file you want to anchor. It is hashed in memory and never stored.
                  </p>
                  <UploadDropzone
                    onFile={setOriginalFile}
                    selected={originalFile ? { name: originalFile.name, size: originalFile.size } : null}
                  />
                  <label className="mt-4 block">
                    <span className="text-xs font-medium text-ink-dim">Label (optional)</span>
                    <input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      maxLength={60}
                      placeholder="e.g. My demo certificate"
                      className="mt-1.5 w-full rounded-lg border border-border bg-[color:rgba(5,9,18,0.6)] px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand/60"
                    />
                  </label>
                  {regError && (
                    <div
                      role="alert"
                      className="mt-4 flex items-start gap-2 rounded-lg border border-[color:rgba(239,68,68,0.4)] bg-[color:rgba(239,68,68,0.08)] px-3 py-2 text-sm text-danger-soft"
                    >
                      <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="font-semibold">{regError.title}.</span> {regError.body}
                      </span>
                    </div>
                  )}
                  <Button
                    size="lg"
                    className="mt-5 w-full"
                    onClick={register}
                    disabled={!originalFile || registering || !health}
                  >
                    {registering ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Anchoring…
                      </>
                    ) : !health ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Checking availability…
                      </>
                    ) : (
                      <>
                        Anchor proof <ArrowRight className="h-4.5 w-4.5" />
                      </>
                    )}
                  </Button>
                </>
              )}

              {step >= 1 && (
                <>
                  <SectionLabel>Step 2 · Anchor proof</SectionLabel>
                  <p className="mb-4 mt-3 text-sm text-ink-dim">
                    {registration
                      ? "Proof anchored. Your demo credential is ready below."
                      : "Registering your original file and anchoring its proof…"}
                  </p>
                  <div className="rounded-xl border border-border bg-[color:rgba(5,9,18,0.6)] p-4">
                    <AnchorProgress
                      active={registering}
                      done={Boolean(registration)}
                      anchored={registration?.anchored ?? configured}
                    />
                  </div>
                </>
              )}
            </GlassPanel>

            {/* Right: what happens + saved id */}
            <GlassPanel className="p-5 sm:p-6">
              {step < 2 ? (
                <>
                  <SectionLabel>What this does</SectionLabel>
                  <ul className="mt-4 space-y-3 text-sm text-ink-dim">
                    {[
                      "Computes the SHA-256 of your file in memory.",
                      "Creates a synthetic demo credential under the fixed Cred402 Demo Issuer.",
                      configured
                        ? "Anchors a minimal proof event on Hedera Consensus Service."
                        : "Records a local issuance event (no testnet keys — proof is simulated).",
                      "Returns a demo ID you use to prove tampering next.",
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-2" /> {t}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 rounded-lg border border-border bg-[color:rgba(8,14,28,0.5)] p-3 text-xs leading-relaxed text-ink-faint">
                    No file bytes or personal data are written on-chain — only a hash, ids, and a
                    timestamp.
                  </p>
                </>
              ) : registration ? (
                <SavedIdPanel registration={registration} hcsUrl={hcsUrl} onContinue={() => setStep(3)} />
              ) : null}
            </GlassPanel>
          </motion.div>
        )}

        {/* ── Step 3: modify instructions ───────────────────────────────────── */}
        {step === 3 && registration && (
          <motion.div
            key="modify"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            <GlassPanel className="p-5 sm:p-6">
              <SectionLabel icon={<Pencil className="h-3.5 w-3.5" />}>Step 4 · Modify the file locally</SectionLabel>
              <p className="mt-3 text-sm text-ink-dim">
                Make ANY change to a copy of your original file — the smallest edit flips the hash:
              </p>
              <ol className="mt-4 space-y-3 text-sm text-ink">
                {[
                  "Open a copy of the original file you just anchored.",
                  "Change one thing — a name, a date, a single character, or re-save/re-export it.",
                  "Save the modified copy somewhere you can find it.",
                  "Then upload that modified copy on the right to see the TAMPERED result.",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/40 text-xs font-semibold text-brand-2">
                      {i + 1}
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 rounded-lg border border-border bg-[color:rgba(8,14,28,0.5)] p-3 text-xs text-ink-faint">
                Re-uploading the UNCHANGED original with this demo ID returns{" "}
                <span className="font-semibold text-ok">VALID</span>. Any modified copy returns{" "}
                <span className="font-semibold text-danger-soft">TAMPERED</span>.
              </div>
            </GlassPanel>

            <GlassPanel className="flex flex-col p-5 sm:p-6">
              <SectionLabel>Your demo credential</SectionLabel>
              <div className="mt-3 space-y-2">
                <IdRow label="Demo ID" value={registration.demoCredentialId} />
                <IdRow label="Original hash" value={registration.sha256} />
              </div>
              <div className="mt-auto pt-5">
                <Button size="lg" className="w-full" onClick={() => setStep(4)}>
                  I&apos;ve modified my copy — continue <ArrowRight className="h-4.5 w-4.5" />
                </Button>
                <button
                  onClick={() => setStep(2)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to saved ID
                </button>
              </div>
            </GlassPanel>
          </motion.div>
        )}

        {/* ── Step 4: upload modified copy ──────────────────────────────────── */}
        {step === 4 && registration && (
          <motion.div
            key="reupload"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            <GlassPanel className="p-5 sm:p-6">
              <SectionLabel>Step 5 · Upload the modified copy</SectionLabel>
              <p className="mb-4 mt-3 text-sm text-ink-dim">
                Bound to demo ID{" "}
                <span className="break-all font-mono text-xs text-brand-ink">{registration.demoCredentialId}</span>.
              </p>
              <UploadDropzone
                onFile={setModifiedFile}
                disabled={verifying}
                selected={modifiedFile ? { name: modifiedFile.name, size: modifiedFile.size } : null}
              />
              {verifyError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-lg border border-[color:rgba(239,68,68,0.4)] bg-[color:rgba(239,68,68,0.08)] px-3 py-2 text-sm text-danger-soft"
                >
                  <FileWarning className="mt-0.5 h-4 w-4 shrink-0" /> {verifyError}
                </div>
              )}
              <Button
                size="lg"
                className="mt-5 w-full"
                onClick={() => modifiedFile && runTamperVerify(modifiedFile)}
                disabled={!modifiedFile || verifying}
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    Verify tampering <ArrowRight className="h-4.5 w-4.5" />
                  </>
                )}
              </Button>
              <button
                onClick={() => setStep(3)}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" /> Back to instructions
              </button>
            </GlassPanel>

            <GlassPanel className="p-5 sm:p-6">
              <SectionLabel icon={<Lock className="h-3.5 w-3.5" />}>How the result is released</SectionLabel>
              <p className="mt-3 text-sm leading-relaxed text-ink-dim">
                The modified copy is hashed and compared to the anchored original. Because the demo
                credential exists and has HCS evidence, a changed hash resolves to{" "}
                <span className="font-semibold text-danger-soft">TAMPERED</span>. The full report is
                released through the same genuine x402 gate the rest of the app uses
                {configured ? "" : " (simulated on this unconfigured deployment)"}.
              </p>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[color:rgba(245,158,11,0.3)] bg-[color:rgba(245,158,11,0.05)] p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                <p className="text-xs leading-relaxed text-ink-faint">{DISCLAIMER}</p>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step 5: report handoff (engine → report) ────────────────────────── */}
      {step === 5 && report && (
        <div>
          {reportPhase === "engine" ? (
            <VerificationEngine report={report} onComplete={() => setReportPhase("report")} />
          ) : (
            <>
              <Report report={report} preview={preview} onVerifyAnother={restart} />
              <div className="mx-auto mt-8 flex max-w-[1440px] flex-wrap gap-3 px-4 sm:px-6 lg:px-8">
                <Button variant="outline" onClick={restart}>
                  <RotateCcw className="h-4 w-4" /> Start another demo
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setModifiedFile(null);
                    setReport(null);
                    setPreview(null);
                    setStep(4);
                  }}
                >
                  Try a different file
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepRail({ current }: { current: Step }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
                done && "border-brand/40 bg-[color:rgba(0,180,255,0.08)] text-brand-ink",
                active && "border-brand bg-[color:rgba(0,180,255,0.14)] text-brand-2",
                !done && !active && "border-border text-ink-faint",
              )}
            >
              <span
                className={cn(
                  "grid h-4 w-4 place-items-center rounded-full text-[0.6rem] font-bold",
                  done ? "bg-brand text-white" : active ? "bg-brand/20 text-brand-2" : "bg-border text-ink-faint",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SavedIdPanel({
  registration,
  hcsUrl,
  onContinue,
}: {
  registration: DemoRegisterResponse;
  hcsUrl: string | null;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Step 3 · Save your demo ID</SectionLabel>
        <span className="inline-flex items-center gap-1 rounded-md border border-[color:rgba(34,197,94,0.4)] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-ok">
          <Check className="h-3 w-3" /> {registration.anchored ? "Anchored" : "Registered"}
        </span>
      </div>
      <p className="mt-3 text-sm text-ink-dim">
        Keep this ID — you&apos;ll need it to prove the modified copy was tampered with.
      </p>
      <div className="mt-4 space-y-2">
        <IdRow label="Demo ID" value={registration.demoCredentialId} />
        <IdRow label="Original hash" value={registration.sha256} />
      </div>
      {hcsUrl && (
        <a
          href={hcsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-2 hover:underline"
        >
          Open on HashScan <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {registration.labels.map((l) => (
          <span
            key={l}
            className="rounded-md border border-border bg-[color:rgba(8,14,28,0.6)] px-2 py-0.5 text-[0.6rem] font-medium text-ink-faint"
          >
            {l}
          </span>
        ))}
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={onContinue}>
        Continue to tamper test <ArrowRight className="h-4.5 w-4.5" />
      </Button>
    </>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs text-ink-faint">{label}</p>
      <CopyHash value={value} full label={label} className="w-full justify-between" />
    </div>
  );
}
