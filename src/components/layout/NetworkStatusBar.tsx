/**
 * Persistent bottom status bar (mockups 1-5). Reflects live /api/health:
 * network, mirror node, operator/mode, price, and a config indicator. Fixed to
 * the viewport bottom on desktop; becomes a normal footer strip on mobile.
 */
"use client";

import { Globe, ExternalLink } from "lucide-react";
import type { HealthResponse } from "@/components/lib/api";
import { cn } from "@/lib/utils";

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-ink-faint">{label}:</span>
      <span className={cn("font-mono text-ink-dim", valueClass)}>{value}</span>
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
    <div className="sticky bottom-0 z-40 border-t border-border bg-[color:rgba(4,7,13,0.9)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 overflow-x-auto scroll-thin px-4 py-2.5 text-xs sm:px-6 lg:px-8">
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-[color:rgba(0,180,255,0.06)] px-2.5 py-1 font-semibold uppercase tracking-wider text-brand-ink">
          <Globe className="h-3.5 w-3.5" />
          {network} network
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              configured ? "bg-ok" : "bg-warn",
            )}
            aria-hidden
          />
        </span>

        <div className="flex items-center gap-4 sm:gap-6">
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

        <a
          href="https://hashscan.io/testnet"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-brand-ink transition-colors hover:border-brand/50 sm:inline-flex"
        >
          View on HashScan <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
