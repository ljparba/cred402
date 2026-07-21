/**
 * A single verification-check result card (mockup 5, result row). Status-coloured
 * border + icon, the human label, and the engine's evidence string. Optional
 * HashScan link when the check has an on-chain reference.
 */
"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { CHECK_META } from "@/components/lib/verdict";
import type { Check } from "@/components/lib/api";
import { cn } from "@/lib/utils";

export function CheckCard({ check, index, hashscanUrl }: { check: Check; index: number; hashscanUrl?: string | null }) {
  const meta = CHECK_META[check.status];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className={cn("flex flex-col gap-2 rounded-xl border bg-[color:rgba(8,14,28,0.6)] p-4", meta.ring)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border", meta.ring)}>
            <Icon className={cn("h-4 w-4", meta.text)} />
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-ink">{check.label}</span>
        </div>
        <span className={cn("shrink-0 text-xs font-bold", meta.text)}>{check.status}</span>
      </div>
      <p className="break-words text-xs leading-relaxed text-ink-dim">{check.evidence}</p>
      {hashscanUrl && (
        <a
          href={hashscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex items-center gap-1 text-xs text-brand-2 hover:underline"
        >
          View on HashScan <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </motion.div>
  );
}
