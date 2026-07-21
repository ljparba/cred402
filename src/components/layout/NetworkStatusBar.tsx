/**
 * Bottom network status bar (mockups 1-5). Reflects live /api/health: network,
 * mirror node, operator/mode, price, and a config indicator.
 *
 * Mobile-first: it lives in normal footer flow (NOT sticky, NOT fixed) and lays
 * the status items out as a wrapping grid — 1 column at 320px, 2 from sm — with
 * the HashScan action on its own full-width row, so nothing forces a horizontal
 * scroll. Only at desktop (lg+) does it become a single sticky bottom row.
 */
"use client";

import { Globe, ExternalLink } from "lucide-react";
import type { HealthResponse } from "@/components/lib/api";
import { cn } from "@/lib/utils";

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex min-w-0 max-w-full items-baseline gap-1.5">
      <span className="shrink-0 text-ink-faint">{label}:</span>
      <span className={cn("min-w-0 break-all font-mono text-ink-dim", valueClass)}>{value}</span>
    </div>
  );
}

export function NetworkStatusBar({ health }: { health: HealthResponse | null }) {
  const mode = health?.mode ?? "unconfigured";
  const configured = mode === "configured";
  const network = health?.hedera.network ?? "testnet";
  const mirror = health?.hedera.mirrorNode?.replace(/^https?:\/\//, "") ?? "testnet.mirrornode.hedera.com";
  const price = health ? `${health.x402.priceHbar} tHBAR` : "0.1 tHBAR";
  const facilitator = health?.x402.facilitator?.replace(/^https?:\/\//, "") ?? "x402.org/facilitator";

  return (
    <div className="border-t border-border bg-[color:rgba(4,7,13,0.9)] backdrop-blur-xl lg:sticky lg:bottom-0 lg:z-40">
      <div className="mx-auto w-full min-w-0 max-w-[1440px] px-4 py-3 text-xs sm:px-6 lg:px-8 lg:py-2.5">
        <div className="flex w-full min-w-0 max-w-full flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          {/* Testnet network badge (mobile row 1) */}
          <span className="inline-flex w-fit min-w-0 max-w-full shrink-0 items-center gap-2 rounded-full border border-border bg-[color:rgba(0,180,255,0.06)] px-2.5 py-1 font-semibold uppercase tracking-wider text-brand-ink">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">{network} network</span>
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", configured ? "bg-ok" : "bg-warn")}
              aria-hidden
            />
          </span>

          {/* Status items: 1-col (mobile) → 2-col (sm) → inline row (desktop). */}
          <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:flex lg:flex-1 lg:flex-wrap lg:items-center lg:gap-x-6 lg:gap-y-1">
            <Stat label="Network" value={`Hedera ${network}`} />
            <Stat label="Mirror Node" value={mirror} />
            <Stat
              label="Mode"
              value={configured ? "configured" : "unconfigured"}
              valueClass={configured ? "text-ok" : "text-warn"}
            />
            <Stat label="Price" value={price} />
            <Stat label="Facilitator" value={facilitator} />
            <Stat
              label="DB"
              value={health?.db.ok ? health.db.driver : "…"}
              valueClass={health?.db.ok ? "text-ok" : "text-ink-faint"}
            />
          </div>

          {/* HashScan — its own full-width row on mobile, inline-right on desktop. */}
          <a
            href="https://hashscan.io/testnet"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-brand-ink transition-colors hover:border-brand/50 lg:ml-auto lg:w-auto lg:justify-start lg:py-1.5"
          >
            View on HashScan <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}
