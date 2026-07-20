/**
 * Per-verdict headline treatment (mockup 5). VALID renders a satisfying animated
 * verified seal; TAMPERED an alert with a subtle glitch/split; the amber/orange/
 * grey verdicts a matching status crest. Reduced-motion drops the large motion.
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { VERDICT_META, TONE_CLASSES } from "@/components/lib/verdict";
import type { Verdict } from "@/components/lib/api";
import { cn } from "@/lib/utils";

export function VerdictSeal({ verdict, subtitle }: { verdict: Verdict; subtitle?: string }) {
  const reduce = useReducedMotion();
  const meta = VERDICT_META[verdict];
  const tone = TONE_CLASSES[meta.tone];
  const Icon = meta.icon;
  const isValid = verdict === "VALID";
  const isTampered = verdict === "TAMPERED";

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border p-5", tone.border, tone.bg)}>
      {/* seal / crest */}
      <div className="relative grid h-20 w-20 shrink-0 place-items-center">
        {isValid && !reduce && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full border-2"
              style={{ borderColor: meta.accent }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 1.15, 1], opacity: [0, 0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <motion.span
              className="absolute inset-2 rounded-full border"
              style={{ borderColor: meta.accent }}
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            />
          </>
        )}
        <motion.div
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 16 }}
          className={cn(
            "grid h-16 w-16 place-items-center rounded-full border-2",
            tone.border,
            tone.glow,
          )}
          style={{ background: `color-mix(in srgb, ${meta.accent} 12%, transparent)` }}
        >
          <Icon className={cn("h-8 w-8", tone.text)} strokeWidth={2.2} />
        </motion.div>
      </div>

      {/* label */}
      <div className="min-w-0">
        <motion.h2
          className={cn("text-2xl font-bold tracking-tight sm:text-3xl", tone.text)}
          initial={reduce ? false : { opacity: 0, x: isTampered ? -6 : 0 }}
          animate={
            isTampered && !reduce
              ? { opacity: 1, x: [-6, 4, -2, 0] }
              : { opacity: 1, x: 0 }
          }
          transition={{ duration: 0.5 }}
        >
          {meta.label}
        </motion.h2>
        <p className="mt-1 text-sm text-ink-dim">{subtitle ?? meta.tagline}</p>
      </div>
    </div>
  );
}
