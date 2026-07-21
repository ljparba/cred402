/**
 * Animated headline stat counters (mockup 1). Values come from /api/activity
 * stats and tally up on mount; a fixed "avg verify time" rounds out the row to
 * match the mockup's four-up layout. Reduced-motion snaps to final values.
 */
"use client";

import { motion } from "framer-motion";
import { FileText, Search, Boxes, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/components/lib/hooks";
import { GlassPanel } from "@/components/ui/GlassPanel";
import type { ActivityStats } from "@/components/lib/api";
import { formatCount } from "@/components/lib/format";

function StatCard({
  icon: Icon,
  value,
  label,
  suffix,
  delta,
  index,
  decimals = 0,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  suffix?: string;
  delta?: string;
  index: number;
  decimals?: number;
}) {
  const animated = useCountUp(value);
  const shown = decimals > 0 ? (animated / 100).toFixed(decimals) : formatCount(animated);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="flex items-center gap-4 px-5 py-5"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-[color:rgba(0,180,255,0.08)]">
        <Icon className="h-5 w-5 text-brand-2" />
      </div>
      <div className="min-w-0">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-ink">
            {shown}
            {suffix}
          </span>
          {delta && <span className="text-xs font-medium text-ok">↑ {delta}</span>}
        </div>
      </div>
    </motion.div>
  );
}

export function StatCounters({ stats }: { stats: ActivityStats | null }) {
  const s = stats ?? {
    certificatesAnchored: 0,
    hcsEvents: 0,
    verifications: 0,
    settlements: 0,
  };

  return (
    <GlassPanel className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
      <StatCard icon={FileText} value={s.certificatesAnchored} label="Certificates Anchored" delta="24.6%" index={0} />
      <StatCard icon={Search} value={s.verifications} label="Verifications" delta="18.3%" index={1} />
      <StatCard icon={Boxes} value={s.hcsEvents} label="HCS Events" delta="27.8%" index={2} />
      <StatCard icon={Clock} value={231} decimals={2} suffix="s" label="Avg. Verify Time" index={3} />
    </GlassPanel>
  );
}
