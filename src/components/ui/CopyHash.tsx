/**
 * Monospace hash chip with copy-to-clipboard. Used for SHA-256 hashes, tx ids,
 * and account ids throughout the report + scanner. Shows a transient "Copied".
 */
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortHash } from "@/lib/utils";

export function CopyHash({
  value,
  display,
  full = false,
  wrap = false,
  className,
  label,
}: {
  value: string;
  /** Optional pre-shortened display text; otherwise shortHash() (unless full). */
  display?: string;
  full?: boolean;
  /**
   * When true, the (full) value WRAPS via `break-all` instead of truncating —
   * so a long Demo ID / SHA-256 stays fully visible and never forces the chip
   * (or its card) wider than the parent. Used by the Tamper Demo id/hash fields.
   */
  wrap?: boolean;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const shown = display ?? (full ? value : shortHash(value));

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={value}
      aria-label={`Copy ${label ?? "value"}: ${value}`}
      className={cn(
        "group inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-[color:rgba(5,9,18,0.6)] px-2.5 py-1.5 font-mono text-[0.8rem] text-brand-ink transition-colors hover:border-brand/50 hover:bg-[color:rgba(0,180,255,0.06)]",
        wrap && "items-start text-left",
        className,
      )}
    >
      <span className={cn("min-w-0", wrap ? "break-all" : "truncate")}>{shown}</span>
      {copied ? (
        <Check className={cn("h-3.5 w-3.5 shrink-0 text-ok", wrap && "mt-0.5")} />
      ) : (
        <Copy className={cn("h-3.5 w-3.5 shrink-0 text-ink-faint transition-colors group-hover:text-brand-2", wrap && "mt-0.5")} />
      )}
    </button>
  );
}
