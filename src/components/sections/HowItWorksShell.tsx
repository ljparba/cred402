/**
 * Client shell for `/how-it-works`.
 *
 * Owns a single fetch of `/api/health` + `/api/samples` and shares it with the
 * chrome (ModeBanner, NetworkStatusBar) and the page content (which needs it for
 * the CTAs + the gated Create Tamper Demo). Keeps the shared Nav/Footer so the
 * route feels continuous with the single-page app.
 */
"use client";

import { useEffect, useState } from "react";

import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { ModeBanner } from "@/components/layout/ModeBanner";
import { NetworkStatusBar } from "@/components/layout/NetworkStatusBar";
import { HowItWorksContent } from "@/components/sections/HowItWorksContent";
import { api, type HealthResponse } from "@/components/lib/api";

export function HowItWorksShell() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api.health(ac.signal).then(setHealth).catch(() => setHealth(null));
    return () => ac.abort();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <ModeBanner health={health} />
      <Nav />
      <main className="flex-1">
        <HowItWorksContent health={health} />
      </main>
      <Footer />
      <NetworkStatusBar health={health} />
    </div>
  );
}
