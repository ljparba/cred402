/**
 * Four-step flow progress rail (mockup 2 top): Upload → Scan → Verify → Complete.
 * `current` is the active 0-based index; completed steps get a check, the active
 * one glows.
 *
 * Layout is a shrink-safe 4-column grid (`grid-cols-4`, `w-full min-w-0`) so it
 * can never force horizontal overflow on a narrow phone: connectors are drawn as
 * half-width lines flanking each circle (no fixed-width connector or step items),
 * and labels truncate rather than pushing the row wider than its parent.
 */
"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Upload", "Scan", "Verify", "Complete"] as const;

export function StepProgress({ current, className }: { current: number; className?: string }) {
  return (
    <ol
      className={cn("grid w-full min-w-0 max-w-full grid-cols-4 gap-1", className)}
      aria-label="Verification progress"
    >
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const prevDone = i - 1 < current; // left segment fills when the previous step is done
        return (
          <li key={label} className="flex min-w-0 max-w-full flex-col items-center gap-1.5 text-center">
            {/* Circle row with shrink-safe connector halves (no fixed widths). */}
            <div className="relative flex w-full min-w-0 items-center justify-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 right-1/2 top-1/2 h-px -translate-y-1/2",
                    prevDone ? "bg-brand" : "bg-border",
                  )}
                />
              )}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-1/2 right-0 top-1/2 h-px -translate-y-1/2",
                    done ? "bg-brand" : "bg-border",
                  )}
                />
              )}
              <div
                className={cn(
                  "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-brand bg-brand text-white",
                  active && "border-brand bg-[color:rgba(0,180,255,0.14)] text-brand-2",
                  !done && !active && "border-border bg-[color:rgba(8,14,28,0.6)] text-ink-faint",
                )}
                aria-current={active ? "step" : undefined}
              >
                {active && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-full border border-brand"
                    animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  />
                )}
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
            </div>
            <span
              className={cn(
                "min-w-0 max-w-full truncate text-[0.6rem] font-medium sm:text-[0.68rem]",
                active ? "text-brand-2" : done ? "text-ink-dim" : "text-ink-faint",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
