/**
 * Top navigation — Cred402 wordmark, primary anchors, and the "Built on Hedera
 * Testnet" pill. Sticky, glassy, condenses on scroll.
 */
"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { HexBadge } from "@/components/brand/HexBadge";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/";

const LINKS = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Samples", href: "#samples" },
];

export function Nav({ onVerifyClick }: { onVerifyClick?: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-[color:rgba(5,7,14,0.82)] backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center" aria-label="Cred402 home">
          <Logo />
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink-dim transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-dim transition-colors hover:text-ink"
          >
            GitHub <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-border bg-[color:rgba(0,180,255,0.06)] px-3 py-1.5 text-xs font-medium text-brand-ink sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            Built on Hedera Testnet
          </span>
          <button
            onClick={onVerifyClick}
            aria-label="Cred402 — verify a certificate"
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-[color:rgba(13,23,48,0.6)] transition-colors hover:border-brand/50"
          >
            <HexBadge size={20} />
          </button>
        </div>
      </nav>
    </header>
  );
}
