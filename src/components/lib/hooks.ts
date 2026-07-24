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

/**
 * Polls an async producer on an interval. The FIRST fetch is immediate (the
 * initial page data is never delayed). Recurring polling PAUSES while the tab is
 * hidden (`document.visibilityState === "hidden"`) and resumes with a fresh fetch
 * when the page becomes visible again — no background traffic from a tab nobody
 * is looking at. Only one request is ever in flight at a time (no overlap).
 *
 * On a FAILED poll the last known-good `data` is kept on screen and only `error`
 * is raised, so a transient blip never replaces real values with nulls/zeros.
 */
export function usePoll<T>(
  producer: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const hidden = () =>
      typeof document !== "undefined" && document.visibilityState === "hidden";

    // Queue the next poll — but never while the tab is backgrounded. The
    // visibilitychange handler resumes the loop when the page is shown again.
    const schedule = () => {
      clearTimeout(timer);
      if (alive && !hidden()) timer = setTimeout(run, intervalMs);
    };

    const run = async () => {
      if (!alive || inFlight) return; // one request at a time — never overlap
      inFlight = true;
      controller = new AbortController();
      try {
        const result = await producer(controller.signal);
        if (alive) {
          setData(result);
          setError(false);
        }
      } catch {
        // Keep the last known-good `data` visible; only flag the stale state.
        if (alive) setError(true);
      } finally {
        inFlight = false;
        schedule();
      }
    };

    const onVisibility = () => {
      if (hidden()) {
        clearTimeout(timer); // pause the recurring loop in a hidden tab
      } else {
        run(); // refresh immediately on return, then resume scheduling
      }
    };

    run(); // immediate first fetch
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
