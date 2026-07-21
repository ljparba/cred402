/**
 * Live system-logs panel (mockup 4). A streaming, monospace log the engine
 * emits as checks resolve. Lines append with a subtle slide + timestamp;
 * aria-live announces new entries for assistive tech.
 */
"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionLabel } from "@/components/ui/GlassPanel";

export interface LogLine {
  id: number;
  time: string;
  level: "INFO" | "PASS" | "FAIL" | "WARN";
  text: string;
  tail?: string;
}

const LEVEL_COLOR: Record<LogLine["level"], string> = {
  INFO: "text-brand-2",
  PASS: "text-ok",
  FAIL: "text-danger",
  WARN: "text-warn",
};

export function SystemLog({ lines, live }: { lines: LogLine[]; live: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest line in view by scrolling ONLY this panel's own container —
  // never the window. (The previous approach scrolled the newest line's ancestor
  // chain, which on mobile yanked the whole page down to the log on each new line
  // and made scanning feel like a scroll-lock; see refinement prompt §11.) Also
  // only auto-stick when the reader is already near the bottom, so scrolling up to
  // read earlier lines isn't fought.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-[color:rgba(4,7,14,0.85)] p-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Live System Logs</SectionLabel>
        {live && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ok">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            Live
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="mt-3 max-h-72 min-h-0 flex-1 space-y-0.5 overflow-y-auto scroll-thin font-mono text-[0.72rem] leading-relaxed"
        aria-live="polite"
        aria-label="System log"
      >
        <AnimatePresence initial={false}>
          {lines.map((l) => (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-baseline gap-2 whitespace-pre"
            >
              <span className="shrink-0 text-ink-faint">{l.time}</span>
              <span className={`shrink-0 ${LEVEL_COLOR[l.level]}`}>[{l.level}]</span>
              <span className="min-w-0 truncate text-ink-dim">{l.text}</span>
              {l.tail && <span className="ml-auto shrink-0 text-brand-ink">{l.tail}</span>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
