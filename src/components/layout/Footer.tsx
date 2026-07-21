/**
 * Minimal footer — brand, testnet PoC disclaimer, GitHub link. The persistent
 * network status bar (NetworkStatusBar) sits below this, fixed to the viewport.
 */
"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { publicConfig } from "@/lib/config";

export function Footer() {
  return (
    <footer className="mx-auto max-w-[1440px] px-4 pb-8 pt-14 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-6 border-t border-border pt-8 md:flex-row md:items-center">
        <div className="min-w-0">
          <Logo />
          <p className="mt-3 max-w-md text-sm text-ink-dim">
            Pay-per-use credential verification on Hedera. Accountless, machine-readable,
            tamper-evident.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:rgba(245,158,11,0.35)] bg-[color:rgba(245,158,11,0.06)] px-3 py-1 text-xs font-medium text-warn-soft">
            Testnet proof of concept — synthetic demo data only, no real credentials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Link href="/how-it-works" className="text-ink-dim transition-colors hover:text-ink">
            How it Works
          </Link>
          <Link href="/#samples" className="text-ink-dim transition-colors hover:text-ink">
            Samples
          </Link>
          <Link href="/how-it-works#tamper-demo" className="text-ink-dim transition-colors hover:text-ink">
            Tamper Demo
          </Link>
          <a
            href={publicConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-ink-dim transition-colors hover:text-ink"
          >
            GitHub <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
