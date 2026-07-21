/**
 * Live Activity feed (mockup 1, right column). Merged HCS events, x402
 * settlements, and verifications from /api/activity, each with a relative time
 * and (where available) a HashScan deep link. New items slide in.
 */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { UploadCloud, DollarSign, Search, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassPanel, SectionLabel } from "@/components/ui/GlassPanel";
import { HexBadge } from "@/components/brand/HexBadge";
import type { ActivityItem } from "@/components/lib/api";
import { timeAgo } from "@/components/lib/format";
import { cn } from "@/lib/utils";

function iconFor(item: ActivityItem): { Icon: LucideIcon | null; hex: boolean; tint: string } {
  if (item.kind === "hcs_event") return { Icon: null, hex: true, tint: "text-brand-2" };
  if (item.kind === "payment_settled") return { Icon: DollarSign, hex: false, tint: "text-ok" };
  if (item.title.includes("uploaded")) return { Icon: UploadCloud, hex: false, tint: "text-brand-2" };
  return { Icon: Search, hex: false, tint: "text-ok" };
}

export function LiveActivity({
  items,
  loading,
  now,
  className,
}: {
  items: ActivityItem[];
  loading: boolean;
  now: number;
  className?: string;
}) {
  return (
    <GlassPanel as="section" className={cn("flex flex-col p-6 sm:p-7", className)} aria-labelledby="activity-title">
      <div className="flex items-center justify-between">
        <SectionLabel>Live Activity</SectionLabel>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ok">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
          </span>
          Live
        </span>
      </div>
      <h2 id="activity-title" className="sr-only">
        Live Hedera activity
      </h2>

      <div
        className="mt-4 min-h-0 max-h-[30rem] flex-1 space-y-1 overflow-y-auto scroll-thin pr-1"
        aria-live="polite"
      >
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-dim">No recent activity.</p>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const { Icon, hex, tint } = iconFor(item);
              return (
                <motion.div
                  key={`${item.kind}-${item.ref ?? item.at}-${item.title}`}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2.5 hover:border-border hover:bg-white/[0.02]"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-[color:rgba(0,180,255,0.05)]">
                    {hex ? <HexBadge size={18} /> : Icon ? <Icon className={cn("h-4 w-4", tint)} /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                    <p className="break-all font-mono text-[0.7rem] leading-snug text-ink-dim">
                      {item.subtitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[0.7rem] text-ink-faint">{timeAgo(item.at, now)}</span>
                    {item.hashscanUrl && (
                      <a
                        href={item.hashscanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 py-0.5 text-[0.7rem] text-brand-2 hover:underline"
                      >
                        HashScan <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </GlassPanel>
  );
}
