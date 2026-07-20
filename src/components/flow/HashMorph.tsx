/**
 * "File fragments morph into SHA-256 hash data" — the small vertical stack of
 * hex chips streaming out of the scanner (mockup 2). Chips fade/slide in with a
 * stagger; under reduced-motion they render statically.
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { groupHex } from "@/components/lib/format";
import { cn } from "@/lib/utils";

export function HashMorph({ hash, active, className }: { hash?: string; active?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  // Show real hash fragments when available, else evocative placeholders.
  const source = hash ?? "4f1c9a2b7ce9d6f28b3da0a7a91f2c6e9d4e7f8a1bc3b5d7e9f01234567890abc";
  const chips = groupHex(source, 7).slice(0, 7).map((c) => `${c}…`);

  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {chips.map((chip, i) => (
        <motion.span
          key={i}
          initial={reduce ? false : { opacity: 0, x: -12 }}
          animate={active && !reduce ? { opacity: [0, 1, 0.75], x: 0 } : { opacity: 0.75, x: 0 }}
          transition={{ duration: 0.5, delay: i * 0.12, repeat: active && !reduce ? Infinity : 0, repeatDelay: 1.4 }}
          className="rounded-md border border-brand/30 bg-[color:rgba(0,180,255,0.06)] px-2.5 py-1 text-center font-mono text-[0.7rem] text-brand-ink"
        >
          {chip}
        </motion.span>
      ))}
    </div>
  );
}
