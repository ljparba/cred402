/**
 * Config/mode banner driven by /api/health. In "unconfigured" mode it honestly
 * states that Hedera/x402 keys are absent so settlement + HCS anchoring are
 * simulated, while the 402 protocol itself is genuine. Dismissible.
 */
"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import type { HealthResponse } from "@/components/lib/api";

export function ModeBanner({ health }: { health: HealthResponse | null }) {
  const [dismissed, setDismissed] = useState(false);
  if (!health || health.mode === "configured" || dismissed) return null;

  return (
    <div className="border-b border-[color:rgba(245,158,11,0.25)] bg-[color:rgba(245,158,11,0.06)]">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <Info className="h-4 w-4 shrink-0 text-warn" />
        <p className="text-ink-dim">
          <span className="font-semibold text-warn-soft">Unconfigured demo mode.</span> No Hedera /
          x402 keys are set, so HCS anchoring and settlement are simulated. The 402 challenge and
          deterministic verification are real — add operator + payer keys for live testnet
          settlement.
        </p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="ml-auto shrink-0 text-ink-faint transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
