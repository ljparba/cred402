/**
 * Four-step flow progress rail (mockup 2 top): Upload → Scan → Verify → Complete.
 * `current` is the active 0-based index; completed steps get a check, the active
 * one glows. Connector fill animates as you advance.
 */
"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Upload", "Scan", "Verify", "Complete"] as const;

export function StepProgress({ current, className }: { current: number; className?: string }) {
  return (
    <ol className={cn("flex items-center justify-center gap-1 sm:gap-2", className)} aria-label="Verification progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-brand bg-brand text-white",
                  active && "border-brand bg-[color:rgba(0,180,255,0.14)] text-brand-2",
                  !done && !active && "border-border bg-[color:rgba(8,14,28,0.6)] text-ink-faint",
                )}
                aria-current={active ? "step" : undefined}
              >
                {active && (
                  <motion.span
                    className="absolute h-8 w-8 rounded-full border border-brand"
                    animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  />
                )}
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[0.68rem] font-medium",
                  active ? "text-brand-2" : done ? "text-ink-dim" : "text-ink-faint",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="relative -mt-5 h-px w-8 overflow-hidden bg-border sm:w-14">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-brand"
                  initial={false}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
