/**
 * Shared top navigation for every Cred402 route + flow state.
 *
 * Uses REAL routes (never homepage anchors for cross-page links):
 *   Logo            → `/`
 *   How it Works    → `/how-it-works`   (a real Next.js route)
 *   Samples         → `/#samples`
 *   GitHub          → publicConfig.githubUrl (browser-safe)
 *   Verify          → the `/` scan state (via onVerifyClick on the homepage, or
 *                     a `/?verify=1` link from any other route)
 *
 * Sticky, glassy, condenses on scroll. Three responsive tiers (refinement §4):
 *   - < 1024px  → mobile: logo + compact verify icon + slide-down drawer.
 *   - 1024–1535 → compact laptop: tighter gaps, compact Verify pill, the network
 *                 badge shortened to "Hedera Testnet", the redundant circular
 *                 Hedera icon hidden.
 *   - 1536px+   → full desktop: comfortable spacing, "Built on Hedera Testnet".
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Menu, X, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/brand/Logo";
import { HexBadge } from "@/components/brand/HexBadge";
import { publicConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

/** Internal links that always resolve to real routes / on-page anchors. */
const LINKS = [
  { label: "How it Works", href: "/how-it-works" },
  { label: "Samples", href: "/#samples" },
] as const;

/**
 * Shared class for the "Verify a Certificate" pill (Link or button). Shown only
 * at laptop widths and up (lg+); below that the compact circular icon + drawer
 * cover verify. Compact padding at laptop, comfortable at full desktop (2xl).
 */
const VERIFY_PILL =
  "hidden items-center gap-1.5 rounded-full border border-brand/50 bg-[color:rgba(0,180,255,0.08)] px-3 py-1.5 text-xs font-semibold text-brand-ink transition-colors hover:border-brand hover:bg-[color:rgba(0,180,255,0.14)] lg:inline-flex 2xl:px-3.5";

export function Nav({
  onVerifyClick,
  onLogoClick,
}: {
  onVerifyClick?: () => void;
  onLogoClick?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const onHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /**
   * "Verify" affordance. On the homepage we drive the state machine directly;
   * from any other route we deep-link back to `/?verify=1` (read on mount there).
   */
  function handleVerify() {
    setOpen(false);
    if (onHome && onVerifyClick) onVerifyClick();
  }

  const verifyHref = onHome ? undefined : "/?verify=1";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled || open
          ? "border-b border-border bg-[color:rgba(5,7,14,0.9)] backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 2xl:gap-3">
        {/* Real route link to `/` (never a scroll anchor). On the homepage the
            optional onLogoClick also resets the in-page flow to the landing view
            and scrolls to the top, so the logo "goes home" from any flow stage. */}
        <Link
          href="/"
          onClick={() => {
            setOpen(false);
            onLogoClick?.();
          }}
          className="flex shrink-0 items-center rounded-lg"
          aria-label="Cred402 home"
        >
          <Logo />
        </Link>

        {/* Desktop links — laptop (lg) and up; compact gaps at laptop, wider at 2xl */}
        <div className="hidden items-center gap-4 lg:flex xl:gap-6 2xl:gap-7">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink-dim transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
          <a
            href={publicConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-dim transition-colors hover:text-ink"
          >
            GitHub <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="flex items-center gap-2 2xl:gap-3">
          {/* Verify affordance — text button on desktop, always reachable */}
          {verifyHref ? (
            <Link href={verifyHref} className={VERIFY_PILL}>
              <ShieldCheck className="h-3.5 w-3.5" /> Verify a Certificate
            </Link>
          ) : (
            <button onClick={handleVerify} className={VERIFY_PILL}>
              <ShieldCheck className="h-3.5 w-3.5" /> Verify a Certificate
            </button>
          )}

          <span className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-border bg-[color:rgba(0,180,255,0.06)] px-3 py-1.5 text-xs font-medium text-brand-ink lg:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            {/* Compact at laptop, full at desktop */}
            <span className="hidden 2xl:inline">Built on </span>Hedera Testnet
          </span>

          {verifyHref ? (
            <Link
              href={verifyHref}
              aria-label="Cred402 — verify a certificate"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-[color:rgba(13,23,48,0.6)] transition-colors hover:border-brand/50 lg:hidden 2xl:grid"
            >
              <HexBadge size={20} />
            </Link>
          ) : (
            <button
              onClick={handleVerify}
              aria-label="Cred402 — verify a certificate"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-[color:rgba(13,23,48,0.6)] transition-colors hover:border-brand/50 lg:hidden 2xl:grid"
            >
              <HexBadge size={20} />
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-[color:rgba(13,23,48,0.6)] text-ink-dim transition-colors hover:border-brand/50 hover:text-ink lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border bg-[color:rgba(5,7,14,0.96)] backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-4 py-4 sm:px-6">
              {verifyHref ? (
                <Link
                  href={verifyHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl border border-brand/50 bg-[color:rgba(0,180,255,0.1)] px-4 py-3 text-sm font-semibold text-brand-ink"
                >
                  <ShieldCheck className="h-4 w-4" /> Verify a Certificate
                </Link>
              ) : (
                <button
                  onClick={handleVerify}
                  className="flex items-center gap-2 rounded-xl border border-brand/50 bg-[color:rgba(0,180,255,0.1)] px-4 py-3 text-sm font-semibold text-brand-ink"
                >
                  <ShieldCheck className="h-4 w-4" /> Verify a Certificate
                </button>
              )}
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-ink-dim transition-colors hover:bg-white/5 hover:text-ink"
                >
                  {l.label}
                </Link>
              ))}
              <a
                href={publicConfig.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-xl px-4 py-3 text-sm font-medium text-ink-dim transition-colors hover:bg-white/5 hover:text-ink"
              >
                GitHub <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-[color:rgba(0,180,255,0.06)] px-3 py-1.5 text-xs font-medium text-brand-ink">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
                </span>
                Built on Hedera Testnet
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
