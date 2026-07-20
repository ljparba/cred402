/**
 * Byte-level hash DIFF view (mockup 5). Compares the anchored (original) and
 * uploaded (current) SHA-256 hashes byte-by-byte, highlighting the bytes that
 * differ in red with an underline caret row, and tallies the differing-byte
 * count. Reveal animates the mismatched cells in.
 *
 * SHA-256 is 32 bytes = 64 hex chars; each byte is a hex pair.
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

function toBytes(hex: string): string[] {
  const clean = hex.toLowerCase().replace(/[^0-9a-f]/g, "");
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(clean.slice(i, i + 2));
  return out;
}

export function HashDiff({
  anchored,
  uploaded,
  className,
}: {
  anchored: string;
  uploaded: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const a = toBytes(anchored);
  const u = toBytes(uploaded);
  const len = Math.max(a.length, u.length);
  const diffFlags = Array.from({ length: len }, (_, i) => a[i] !== u[i]);
  const diffCount = diffFlags.filter(Boolean).length;

  // Show a readable window (first 16 bytes) for the mockup's compact diff strip.
  const window = 16;

  function Row({ bytes, label }: { bytes: string[]; label: string }) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[0.6rem] font-semibold uppercase tracking-wider text-ink-faint">
          {label}
        </span>
        <div className="flex flex-wrap gap-1 font-mono text-xs">
          {bytes.slice(0, window).map((b, i) => {
            const diff = diffFlags[i];
            return (
              <motion.span
                key={i}
                initial={reduce ? false : { opacity: diff ? 0 : 1 }}
                animate={{ opacity: 1 }}
                transition={{ delay: diff ? 0.02 * i : 0 }}
                className={cn(
                  "rounded px-1 py-0.5",
                  diff
                    ? "bg-[color:rgba(239,68,68,0.18)] font-semibold text-danger-soft"
                    : "text-ink-dim",
                )}
              >
                {b ?? "··"}
              </motion.span>
            );
          })}
          <span className="self-center px-1 text-ink-faint">…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-[color:rgba(239,68,68,0.35)] bg-[color:rgba(239,68,68,0.04)] p-4", className)}>
      <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-danger-soft">Diff View</p>
      <div className="space-y-2">
        <Row bytes={a} label="Anchored" />
        <Row bytes={u} label="Uploaded" />
        {/* caret row marking diffs */}
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0" />
          <div className="flex flex-wrap gap-1 font-mono text-xs text-danger">
            {diffFlags.slice(0, window).map((d, i) => (
              <span key={i} className="w-[1.6rem] text-center">
                {d ? "^^" : "  "}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-[color:rgba(239,68,68,0.2)] pt-3 text-xs">
        <span className="font-semibold uppercase tracking-wider text-danger-soft">Difference</span>
        <span className="rounded-md border border-[color:rgba(239,68,68,0.4)] bg-[color:rgba(239,68,68,0.1)] px-2 py-0.5 font-mono text-danger-soft">
          {diffCount} of {len} bytes differ
        </span>
      </div>
    </div>
  );
}
