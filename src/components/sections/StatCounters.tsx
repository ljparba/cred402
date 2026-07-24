/**
 * Headline stat counters (mockup 1). Every figure comes from GET /api/activity —
 * real counts from this deployment's database. Nothing here is hardcoded: no
 * growth deltas, no average-verification-time, no placeholder values.
 *
 * Honest states: while the request is in flight (and if it fails) the row shows
 * an em-dash with "Loading" / "Unavailable" instead of zeros or invented numbers,
 * and the count-up animation only runs once real values have arrived.
 *
 * The HCS card is labelled by its source — anchored Hedera records when the
 * deployment has any, otherwise the local offline fixtures, explicitly marked as
 * demo data rather than live network activity. Reduced-motion snaps to finals.
 */
"use client";

import { motion } from "framer-motion";
import { FileText, Search, Boxes, DollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/components/lib/hooks";
import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ActivityStats } from "@/components/lib/api";
import { formatCount } from "@/components/lib/format";

function StatCard({
  icon: Icon,
  value,
  label,
  note,
  ready,
  index,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  /** Small caption under the value: what is counted, or the pending state. */
  note: string;
  /** True once real data has arrived — gates both the value and the animation. */
  ready: boolean;
  index: number;
}) {
  const animated = useCountUp(ready ? value : 0);
  const shown = ready ? formatCount(animated) : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="flex items-center gap-4 px-5 py-5"
      role="group"
      aria-label={`${label}: ${ready ? `${formatCount(value)} — ${note}` : note}`}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-[color:rgba(0,180,255,0.08)]">
        <Icon className="h-5 w-5 text-brand-2" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-ink" aria-hidden>
            {shown}
          </span>
        </div>
        <div className="mt-0.5 break-words text-[0.65rem] leading-snug text-ink-faint">{note}</div>
      </div>
    </motion.div>
  );
}

export function StatCounters({
  stats,
  error = false,
}: {
  stats: ActivityStats | null;
  /** The activity request failed and no earlier real values are available. */
  error?: boolean;
}) {
  const ready = stats !== null;
  const pending = error ? "Unavailable" : "Loading";

  return (
    <GlassPanel className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
      <StatCard
        icon={FileText}
        value={stats?.registeredCredentials ?? 0}
        label="Registered Credentials"
        note={ready ? "Credential records" : pending}
        ready={ready}
        index={0}
      />
      <StatCard
        icon={Search}
        value={stats?.verificationRequests ?? 0}
        label="Verification Requests"
        note={ready ? "Includes locked, unpaid requests" : pending}
        ready={ready}
        index={1}
      />
      <StatCard
        icon={Boxes}
        value={stats?.hcsRecords ?? 0}
        label="HCS Records"
        note={
          ready
            ? stats.hcsSource === "network"
              ? "Anchored on Hedera Testnet"
              : "Local demo fixtures — not live network records"
            : pending
        }
        ready={ready}
        index={2}
      />
      <StatCard
        icon={DollarSign}
        value={stats?.settlements ?? 0}
        label="x402 Settlements"
        note={ready ? "Settled testnet payments" : pending}
        ready={ready}
        index={3}
      />
    </GlassPanel>
  );
}
