/**
 * Wallet → Cred402 API → Hedera particle flow (mockup 3). Three glowing nodes
 * connected by animated HBAR "H" particles drifting left-to-right, intensifying
 * while a payment is settling. Reduced-motion renders the static topology.
 *
 * Laid out as a shrink-safe 3-column grid (`grid-cols-3`, `w-full min-w-0`) so it
 * always fits inside the mobile payment card: the connecting wire is a single
 * percentage-positioned line behind the (opaque) node circles — never a
 * fixed-width connector — and the circles/icons/labels scale down on mobile.
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Wallet } from "lucide-react";
import { Cred402Mark } from "@/components/brand/Logo";
import { HexBadge } from "@/components/brand/HexBadge";

const NODES = [
  { key: "wallet", short: "Your Wallet", full: "Your Wallet" },
  { key: "api", short: "Cred402 API", full: "Cred402 API" },
  { key: "hedera", short: "Hedera", full: "Hedera Network" },
] as const;

/** Particles drifting along the whole wire (node 1 → node 3). */
function Particles({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const count = active ? 4 : 2;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute top-1/2 grid h-3.5 w-3.5 -translate-y-1/2 place-items-center rounded-full bg-[color:rgba(0,180,255,0.9)] text-[8px] font-bold text-canvas shadow-[0_0_10px_2px_rgba(0,180,255,0.7)]"
          initial={{ left: "0%", opacity: 0 }}
          animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: active ? 1.4 : 2.6,
            repeat: Infinity,
            delay: i * (active ? 0.35 : 0.9),
            ease: "linear",
          }}
        >
          H
        </motion.span>
      ))}
    </>
  );
}

export function PaymentFlow({ active = false }: { active?: boolean }) {
  return (
    <div className="relative grid w-full min-w-0 max-w-full grid-cols-3 items-start gap-1 sm:gap-2">
      {/* Continuous wire behind the node circles — spans node-1 centre to node-3
          centre (the middle 2/3), percentage-positioned so it adds no width. */}
      <div className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-7 h-px -translate-y-1/2 bg-gradient-to-r from-brand/10 via-brand/50 to-brand/10 sm:top-10">
        <Particles active={active} />
      </div>

      {NODES.map((node) => (
        <div key={node.key} className="relative z-10 flex min-w-0 max-w-full flex-col items-center gap-2">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-border bg-[color:rgba(5,9,18,0.92)] shadow-[0_0_30px_-12px_rgba(0,180,255,0.6)] sm:h-20 sm:w-20">
            {node.key === "wallet" && <Wallet className="h-7 w-7 text-brand-2 sm:h-9 sm:w-9" />}
            {node.key === "api" && <Cred402Mark className="h-8 w-8 sm:h-11 sm:w-11" />}
            {node.key === "hedera" && (
              <>
                <HexBadge size={38} className="sm:hidden" />
                <HexBadge size={52} className="hidden sm:block" />
              </>
            )}
          </div>
          <span className="min-w-0 max-w-full break-words text-center text-[0.6rem] font-medium leading-tight text-ink-dim sm:text-[0.7rem]">
            <span className="sm:hidden">{node.short}</span>
            <span className="hidden sm:inline">{node.full}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
