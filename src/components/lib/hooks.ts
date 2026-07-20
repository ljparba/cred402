/**
 * Shared client hooks for the Cred402 experience.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Animated count-up. Honors reduced-motion (snaps to the target). Re-runs when
 * `value` changes, easing from the previous rendered value for a live feel.
 */
export function useCountUp(value: number, durationMs = 1200): number {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(from + (value - from) * eased);
      setDisplay(next);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, durationMs, reduce]);

  return display;
}

/** Polls an async producer on an interval; pauses when the tab is hidden. */
export function usePoll<T>(
  producer: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    let controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      controller = new AbortController();
      try {
        const result = await producer(controller.signal);
        if (alive) {
          setData(result);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
      if (alive) timer = setTimeout(run, intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        run();
      }
    };

    run();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error };
}

/** Tracks the reduced-motion preference (re-export for CSS-fallback branches). */
export { useReducedMotion };
