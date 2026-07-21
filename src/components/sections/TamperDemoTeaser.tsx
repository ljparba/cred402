/**
 * Homepage "Original vs. Tampered — Create Tamper Demo" section (plan §6 / final
 * refinement prompt §6).
 *
 * A strong but compact full-width band that reintroduces the flagship tamper
 * demonstration on the landing page WITHOUT duplicating the full workflow from
 * `/how-it-works`. Left: a short explanation, the five-beat flow, a concise
 * disclaimer, and a CTA. Right: a simple original-vs-tampered visual (the same
 * anchored hash resolving VALID for the original and TAMPERED for a modified
 * copy). Single-column and tap-friendly on mobile.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  UploadCloud,
  Boxes,
  Pencil,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassPanel, SectionLabel } from "@/components/ui/GlassPanel";

const FLOW: { icon: LucideIcon; text: string }[] = [
  { icon: UploadCloud, text: "Upload an original file" },
  { icon: Boxes, text: "Anchor its proof on Hedera" },
  { icon: Pencil, text: "Modify a local copy" },
  { icon: RefreshCw, text: "Upload the modified version" },
];

/** A single before/after card for the original-vs-tampered visual. */
function CompareCard({
  tone,
  verdict,
  hash,
  caption,
}: {
  tone: "ok" | "danger";
  verdict: string;
  hash: string;
  caption: string;
}) {
  const isOk = tone === "ok";
  return (
    <div
      className={
        "min-w-0 flex-1 rounded-xl border bg-[color:rgba(5,9,18,0.6)] p-4 " +
        (isOk
          ? "border-[color:rgba(34,197,94,0.4)]"
          : "border-[color:rgba(239,68,68,0.4)]")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-ink-faint">
          {caption}
        </span>
        <span
          className={
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider " +
            (isOk
              ? "border-[color:rgba(34,197,94,0.4)] text-ok"
              : "border-[color:rgba(239,68,68,0.4)] text-danger-soft")
          }
        >
          {isOk ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {verdict}
        </span>
      </div>
      <p className="mt-3 break-all font-mono text-[0.7rem] leading-relaxed text-ink-dim">{hash}</p>
      <div className={"mt-3 h-1 rounded-full " + (isOk ? "bg-ok/70" : "bg-danger/70")} />
    </div>
  );
}

export function TamperDemoTeaser() {
  return (
    <GlassPanel as="section" className="p-6 sm:p-8" aria-labelledby="tamper-teaser-title">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        {/* Left — explanation + CTA */}
        <div className="min-w-0">
          <SectionLabel icon={<AlertTriangle className="h-3.5 w-3.5" />}>
            Original vs. Tampered
          </SectionLabel>
          <h2
            id="tamper-teaser-title"
            className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl"
          >
            Watch a verdict flip from{" "}
            <span className="text-ok">VALID</span> to{" "}
            <span className="text-danger-soft">TAMPERED</span>
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-dim">
            Anchor an original file, change a single byte of a copy, and re-verify. Because both are
            checked against the same Hedera-anchored proof, the modified copy is provably tampered.
          </p>

          <ol className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {FLOW.map((s, i) => (
              <motion.li
                key={s.text}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-[color:rgba(8,14,28,0.55)] px-3 py-2.5"
              >
                <s.icon className="h-4 w-4 shrink-0 text-brand-2" />
                <span className="min-w-0 text-xs font-medium text-ink">{s.text}</span>
              </motion.li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/how-it-works#tamper-demo"
              className="inline-flex items-center gap-2 rounded-full border border-brand/50 bg-[color:rgba(0,180,255,0.1)] px-5 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:border-brand hover:bg-[color:rgba(0,180,255,0.16)]"
            >
              <AlertTriangle className="h-4 w-4" /> Create Tamper Demo
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-2 hover:underline"
            >
              How it works <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
            Synthetic demo on Hedera testnet. It proves a file changed after anchoring — not that the
            uploader is a real issuer or owner.
          </p>
        </div>

        {/* Right — original-vs-tampered visual */}
        <div className="min-w-0 rounded-2xl border border-border bg-[color:rgba(8,14,28,0.5)] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <CompareCard
              tone="ok"
              caption="Original file"
              verdict="VALID"
              hash="4f9c28e3b0a7d1f6 92c4a8e5b3d7f019"
            />
            <CompareCard
              tone="danger"
              caption="Modified copy"
              verdict="TAMPERED"
              hash="a1b2c3d4e5f60718 29e0d1c2b3a49586"
            />
          </div>
          <p className="mt-4 text-center text-xs text-ink-faint">
            Same anchored proof · one changed byte · a different SHA-256
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}
