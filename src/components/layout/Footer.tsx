/**
 * Minimal footer — brand, testnet PoC disclaimer, nav links. The network status
 * bar (NetworkStatusBar) sits below this: static in mobile document flow, sticky
 * only at desktop widths.
 *
 * Mobile-first: content stacks (logo → description → disclaimer → links), the
 * links become a 2-column grid, and the disclaimer is a full-width wrapping block
 * (never sized by its own text) so nothing overflows a 320px viewport.
 */
"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { publicConfig } from "@/lib/config";

export function Footer() {
  return (
    <footer className="mx-auto w-full min-w-0 max-w-[1440px] px-4 pb-8 pt-14 sm:px-6 lg:px-8">
      <div className="flex w-full min-w-0 max-w-full flex-col items-start gap-6 border-t border-border pt-8 md:flex-row md:items-center md:justify-between">
        <div className="w-full min-w-0 max-w-full md:w-auto">
          <Logo />
          <p className="mt-3 max-w-md break-words text-sm text-ink-dim">
            Pay-per-use credential verification on Hedera. Accountless, machine-readable,
            tamper-evident.
          </p>
          <p className="mt-3 flex w-full max-w-full items-start gap-2 break-words rounded-lg border border-[color:rgba(245,158,11,0.35)] bg-[color:rgba(245,158,11,0.06)] px-3 py-2 text-xs font-medium text-warn-soft md:w-fit">
            Testnet proof of concept — synthetic demo data only, no real credentials.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="grid w-full min-w-0 max-w-full grid-cols-2 gap-x-4 gap-y-2 text-sm sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-x-6"
        >
          <Link href="/how-it-works" className="min-w-0 rounded text-ink-dim transition-colors hover:text-ink">
            How it Works
          </Link>
          <Link href="/#samples" className="min-w-0 rounded text-ink-dim transition-colors hover:text-ink">
            Samples
          </Link>
          <Link href="/how-it-works#tamper-demo" className="min-w-0 rounded text-ink-dim transition-colors hover:text-ink">
            Tamper Demo
          </Link>
          <a
            href={publicConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1 rounded text-ink-dim transition-colors hover:text-ink"
          >
            GitHub <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
