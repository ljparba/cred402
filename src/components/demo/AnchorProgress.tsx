/**
 * Staged "anchoring" progress rail for the Create Tamper Demo.
 *
 * Instead of a bare spinner, the registration request is narrated through the
 * real stages the server performs: Validating file → Computing SHA-256 →
 * Creating demo credential → Submitting HCS event → Waiting for consensus →
 * Retrieving Mirror proof → Complete. The stages advance on a gentle timer for
 * visual truthfulness while the single POST is in flight; once the response
 * lands the caller flips `done` and every stage snaps to complete.
 *
 * Reduced-motion drops the timed advance and shows the current stage plainly.
 */
"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export const ANCHOR_STAGES = [
  "Validating file",
  "Computing SHA-256",
  "Creating demo credential",
  "Submitting HCS event",
  "Waiting for consensus",
  "Retrieving Mirror proof",
  "Complete",
] as const;

export function AnchorProgress({
  active,
  done,
  anchored,
}: {
  /** True while the POST is in flight (advance through stages). */
  active: boolean;
  /** True once the response has resolved (snap all stages complete). */
  done: boolean;
  /**
   * Whether the registration actually anchored on HCS. In unconfigured mode the
   * HCS/consensus/mirror stages are labelled as skipped rather than done.
   */
  anchored: boolean;
}) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (done) {
      setStage(ANCHOR_STAGES.length - 1);
      return;
    }
    if (!active || reduce) return;
    // Advance up to the second-to-last stage; the final "Complete" only lands
    // when `done` flips, so we never claim success before the server responds.
    const t = setInterval(() => {
      setStage((s) => Math.min(s + 1, ANCHOR_STAGES.length - 2));
    }, 700);
    return () => clearInterval(t);
  }, [active, done, reduce]);

  return (
    <ol className="space-y-2.5" aria-label="Anchoring progress" aria-live="polite">
      {ANCHOR_STAGES.map((label, i) => {
        const isComplete = done || i < stage;
        const isCurrent = !done && i === stage;
        // HCS-dependent stages are "skipped" when the demo could not anchor.
        const hcsStage = i >= 3 && i <= 5;
        const skipped = done && hcsStage && !anchored;

        return (
          <li key={label} className="flex items-center gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center">
              {skipped ? (
                <Circle className="h-4 w-4 text-ink-faint" />
              ) : isComplete ? (
                <motion.span
                  initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="grid h-5 w-5 place-items-center rounded-full bg-[color:rgba(34,197,94,0.15)]"
                >
                  <Check className="h-3.5 w-3.5 text-ok" />
                </motion.span>
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-2" />
              ) : (
                <Circle className="h-4 w-4 text-ink-faint" />
              )}
            </span>
            <span
              className={cn(
                "text-sm",
                skipped
                  ? "text-ink-faint"
                  : isComplete
                    ? "text-ink"
                    : isCurrent
                      ? "font-medium text-brand-2"
                      : "text-ink-dim",
              )}
            >
              {label}
              {skipped && <span className="ml-1.5 text-xs text-ink-faint">(skipped — no testnet keys)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
