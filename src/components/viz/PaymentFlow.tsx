/**
 * Wallet → Cred402 API → Hedera particle flow (mockup 3). Three glowing nodes
 * connected by animated HBAR "H" particles drifting left-to-right, intensifying
 * while a payment is settling. Reduced-motion renders the static topology.
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Wallet } from "lucide-react";
import { Cred402Mark } from "@/components/brand/Logo";
import { HexBadge } from "@/components/brand/HexBadge";

function Node({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid h-20 w-20 place-items-center rounded-2xl border border-border bg-[color:rgba(5,9,18,0.7)] shadow-[0_0_30px_-12px_rgba(0,180,255,0.6)] sm:h-24 sm:w-24">
        {children}
      </div>
      <span className="text-[0.7rem] font-medium text-ink-dim">{label}</span>
    </div>
  );
}

function Wire({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const particles = active ? 4 : 2;
  return (
    <div className="relative mx-1 h-px flex-1 self-center bg-gradient-to-r from-brand/10 via-brand/50 to-brand/10 sm:mx-2">
      {!reduce &&
        Array.from({ length: particles }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-[color:rgba(0,180,255,0.9)] text-[8px] font-bold text-canvas shadow-[0_0_10px_2px_rgba(0,180,255,0.7)]"
            initial={{ left: "-6%", opacity: 0 }}
            animate={{ left: ["-6%", "106%"], opacity: [0, 1, 1, 0] }}
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
    </div>
  );
}

export function PaymentFlow({ active = false }: { active?: boolean }) {
  return (
    <div className="flex items-stretch justify-between gap-1">
      <Node label="Your Wallet">
        <Wallet className="h-9 w-9 text-brand-2" />
      </Node>
      <Wire active={active} />
      <Node label="Cred402 API">
        <Cred402Mark className="h-11 w-11" />
      </Node>
      <Wire active={active} />
      <Node label="Hedera Network">
        <HexBadge size={44} />
      </Node>
    </div>
  );
}
