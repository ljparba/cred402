/**
 * `/how-it-works` page content (client) — the full, polished explanation of how
 * Cred402 works, in the existing dark Hedera visual system.
 *
 * Sections (plan §8 / update prompt):
 *   A Hero + CTAs
 *   B The 8-step verification flow
 *   C The six checks + six verdicts
 *   D What happens with a custom certificate? (the honest boundary)
 *   E Why no login / registration
 *   F How credentials normally become verifiable (issuer side) + synthetic note
 *   G What makes Cred402 different (comparison — no "world's first" claims)
 *   H Privacy & security
 *   I Original-vs-tampered demonstration + Create Tamper Demo
 *   J Who it's for
 *
 * Live health + samples are fetched so the CTAs + Create Tamper Demo behave
 * correctly (the demo is fully gated on `tamperDemo.enabled`).
 */
"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  FileText,
  UploadCloud,
  Fingerprint,
  Search,
  Wallet,
  Boxes,
  Landmark,
  Ban,
  CalendarX,
  HelpCircle,
  Building2,
  AlertTriangle,
  FileSearch,
  Image as ImageIcon,
  KeyRound,
  Eye,
  Lock,
  Users,
  Bot,
  Briefcase,
  GraduationCap,
  Check,
  X,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassPanel, SectionLabel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { TamperDemo } from "@/components/demo/TamperDemo";
import { HederaNetworkViz } from "@/components/viz/HederaNetworkViz";
import type { HealthResponse } from "@/components/lib/api";
import { cn } from "@/lib/utils";

/** Small heading used at the top of each major section. */
function SectionHead({
  eyebrow,
  title,
  lead,
  icon,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <SectionLabel icon={icon} className="justify-center">
        {eyebrow}
      </SectionLabel>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {lead && <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-dim sm:text-base">{lead}</p>}
    </div>
  );
}

const FLOW_STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: UploadCloud, title: "Upload a file", body: "Any PDF, PNG, or JPG. No account, no sign-up." },
  { icon: Fingerprint, title: "Hash in memory", body: "The server computes a SHA-256 fingerprint. The file is never stored." },
  { icon: Search, title: "Identify credential", body: "Match by hash, or by an embedded credential ID for known PDFs." },
  { icon: Wallet, title: "402 Payment Required", body: "The full report is gated by a genuine HTTP 402 x402 challenge." },
  { icon: Boxes, title: "Settle on Hedera", body: "A small pay-per-use fee settles in testnet HBAR via x402." },
  { icon: ShieldCheck, title: "Confirm on Mirror", body: "Settlement is independently verified on the Hedera Mirror Node." },
  { icon: FileSearch, title: "Run six checks", body: "The deterministic engine resolves each check against the HCS anchor." },
  { icon: FileText, title: "Release the report", body: "A tamper-aware verdict with on-chain proof + HashScan links." },
];

const CHECKS: { title: string; body: string }[] = [
  { title: "Hash integrity", body: "Uploaded SHA-256 vs the HCS-anchored issuance hash." },
  { title: "Credential known", body: "The credential ID resolves in the registry." },
  { title: "Issuer registered", body: "The issuer exists and is trusted." },
  { title: "Revocation", body: "The latest HCS status event is not REVOKED." },
  { title: "Expiration", body: "The credential is within its valid time window." },
  { title: "HCS evidence", body: "The issuance event is retrievable from the Mirror Node with a matching hash." },
];

const VERDICTS: { label: string; icon: LucideIcon; tone: string; body: string }[] = [
  { label: "VALID", icon: ShieldCheck, tone: "text-ok border-[color:rgba(34,197,94,0.4)]", body: "Hash matches the anchored original." },
  { label: "TAMPERED", icon: AlertTriangle, tone: "text-danger border-[color:rgba(239,68,68,0.4)]", body: "Known credential, but the hash diverges from the anchor." },
  { label: "REVOKED", icon: Ban, tone: "text-warn border-[color:rgba(245,158,11,0.4)]", body: "A CREDENTIAL_REVOKED event exists." },
  { label: "EXPIRED", icon: CalendarX, tone: "text-warn border-[color:rgba(245,158,11,0.4)]", body: "Outside its valid time window." },
  { label: "UNREGISTERED_ISSUER", icon: Building2, tone: "text-orange border-[color:rgba(251,146,60,0.4)]", body: "Not issued by a registered Cred402 issuer." },
  { label: "UNKNOWN", icon: HelpCircle, tone: "text-neutral border-[color:rgba(148,163,184,0.35)]", body: "No matching anchored record was found." },
];

const AUDIENCE: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Briefcase, title: "Employers & registrars", body: "Confirm a certificate hasn't been altered since issuance — no portal account." },
  { icon: Bot, title: "Autonomous agents", body: "A machine-readable, pay-per-call 402 API any agent can settle and consume." },
  { icon: GraduationCap, title: "Issuers exploring anchoring", body: "See how a hash-anchored credential proves integrity without exposing data." },
  { icon: Users, title: "Developers", body: "A reference implementation of x402 v2 on Hedera with independent settlement proof." },
];

export function HowItWorksContent({ health }: { health: HealthResponse | null }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      {/* ── A · Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-[color:rgba(8,14,28,0.5)] p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 hex-grid opacity-40" aria-hidden />
        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-brand-2">
            <ShieldCheck className="h-4 w-4" /> How it Works
          </div>
          <h1 className="max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl lg:text-5xl">
            How <span className="text-gradient-brand">Cred402</span> Works
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-dim">
            Cred402 verifies a credential against a proof anchored on Hedera — and tells you whether
            the file changed after it was issued. Verifiers need{" "}
            <span className="font-medium text-ink">no account, no login, and no registration</span>:
            upload a file, settle a tiny pay-per-use fee with x402, and get a tamper-aware report.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" href="/?verify=1">
              <ShieldCheck className="h-4.5 w-4.5" /> Verify a Certificate
            </Button>
            <Button size="lg" variant="outline" href="/#samples">
              <FileText className="h-4.5 w-4.5" /> Try a Sample
            </Button>
            <Button size="lg" variant="ghost" href="#tamper-demo">
              <AlertTriangle className="h-4.5 w-4.5" /> Create Tamper Demo
            </Button>
          </div>
        </div>
      </section>

      {/* ── B · 8-step verification flow ──────────────────────────────────── */}
      <section className="mt-16">
        <SectionHead
          eyebrow="The flow"
          title="Eight steps from upload to proof"
          lead="Everything is deterministic — no AI guesswork. Each step is observable in the live verification engine."
        />
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW_STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: (i % 4) * 0.06 }}
              className="relative flex flex-col gap-3 rounded-2xl border border-border bg-[color:rgba(8,14,28,0.55)] p-5"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-[color:rgba(0,180,255,0.06)]">
                  <s.icon className="h-5 w-5 text-brand-2" />
                </span>
                <span className="grid h-6 w-6 place-items-center rounded-full border border-brand/40 text-xs font-bold text-brand-2">
                  {i + 1}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
              <p className="text-xs leading-relaxed text-ink-dim">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ── C · Six checks + six verdicts ─────────────────────────────────── */}
      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <GlassPanel className="p-6 sm:p-7">
          <SectionLabel icon={<FileSearch className="h-3.5 w-3.5" />}>Six checks</SectionLabel>
          <p className="mt-3 text-sm text-ink-dim">
            Each check produces PASS / FAIL / WARN / SKIP with concrete evidence.
          </p>
          <ol className="mt-5 space-y-3">
            {CHECKS.map((c, i) => (
              <li key={c.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/40 text-xs font-semibold text-brand-2">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{c.title}</p>
                  <p className="text-xs leading-relaxed text-ink-dim">{c.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </GlassPanel>

        <GlassPanel className="p-6 sm:p-7">
          <SectionLabel icon={<ShieldCheck className="h-3.5 w-3.5" />}>Six verdicts</SectionLabel>
          <p className="mt-3 text-sm text-ink-dim">
            The checks resolve to one verdict by precedence: UNKNOWN → UNREGISTERED_ISSUER → TAMPERED
            → REVOKED → EXPIRED → VALID.
          </p>
          <ul className="mt-5 space-y-2.5">
            {VERDICTS.map((v) => (
              <li
                key={v.label}
                className={cn("flex items-start gap-3 rounded-xl border bg-[color:rgba(8,14,28,0.5)] p-3", v.tone)}
              >
                <v.icon className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="break-words font-mono text-xs font-semibold">{v.label}</p>
                  <p className="text-xs leading-relaxed text-ink-dim">{v.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </section>

      {/* ── D · Custom certificate boundary ───────────────────────────────── */}
      <section className="mt-16">
        <SectionHead
          eyebrow="The honest boundary"
          title="What happens with a custom certificate?"
          icon={<Info className="h-3.5 w-3.5" />}
        />
        <GlassPanel className="mt-8 p-6 sm:p-8">
          <div className="rounded-2xl border border-[color:rgba(0,180,255,0.3)] bg-[color:rgba(0,180,255,0.05)] p-5">
            <p className="text-base font-semibold leading-relaxed text-brand-ink">
              Cred402 verifies a file against a previously registered and anchored proof. It does not
              guess whether an arbitrary document looks authentic.
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { icon: UploadCloud, title: "Any file can be uploaded", body: "PDF, PNG, or JPG — the app accepts any supported file for verification." },
              { icon: Fingerprint, title: "Exact files match by SHA-256", body: "A byte-identical copy of an anchored file resolves against its stored hash." },
              { icon: FileSearch, title: "Known PDFs may match by ID", body: "Some PDFs carry an embedded credential ID the engine can resolve." },
              { icon: HelpCircle, title: "Random files → UNKNOWN", body: "A file with no matching anchor and no known ID returns UNKNOWN — not \"fake\"." },
              { icon: ImageIcon, title: "PNG / JPEG are hash-only", body: "Images are compared by hash. There is no OCR and no visual/content analysis." },
              { icon: AlertTriangle, title: "Tampering needs an anchor", body: "To prove a file was altered, its original must have been anchored first (see the demo below)." },
            ].map((t) => (
              <div key={t.title} className="flex items-start gap-3 rounded-xl border border-border bg-[color:rgba(8,14,28,0.5)] p-4">
                <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-2" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  <p className="text-xs leading-relaxed text-ink-dim">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </section>

      {/* ── E · Why no login / registration ───────────────────────────────── */}
      <section className="mt-16 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <GlassPanel className="p-6 sm:p-8">
          <SectionLabel icon={<KeyRound className="h-3.5 w-3.5" />}>No account required</SectionLabel>
          <h3 className="mt-3 text-xl font-bold text-ink">Verifiers never sign up</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-dim">
            Verification is a public, stateless action: you present a file and pay per call. There is
            nothing to register because Cred402 stores nothing about you — no profile, no email, no
            wallet connection in the browser. Payment is settled machine-to-machine through x402, so a
            human or an autonomous agent uses the exact same accountless path.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-ink">
            {[
              "No sign-up, no password, no session.",
              "Pay-per-use — you only pay for the reports you request.",
              "Identical flow for people and machines.",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-ok" /> {t}
              </li>
            ))}
          </ul>
        </GlassPanel>
        <GlassPanel className="flex flex-col items-center justify-center p-6 sm:p-8">
          <HederaNetworkViz className="h-40 w-full" />
          <p className="mt-4 text-center text-xs text-ink-faint">
            Every report is backed by Hedera Consensus Service — decentralized, immutable, verifiable.
          </p>
        </GlassPanel>
      </section>

      {/* ── F · Issuer side + synthetic note ──────────────────────────────── */}
      <section className="mt-16">
        <SectionHead
          eyebrow="The issuer side"
          title="How credentials normally become verifiable"
          lead="In a real deployment, the institution that issues a credential anchors a proof of it. Cred402 then verifies against that anchor."
          icon={<Landmark className="h-3.5 w-3.5" />}
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { n: 1, title: "Issue", body: "A school or authority issues a credential to a recipient." },
            { n: 2, title: "Anchor", body: "The issuer submits a minimal proof (a hash + ids, never the file) to a Hedera topic." },
            { n: 3, title: "Verify", body: "Anyone can later check a file against that anchor — exactly what Cred402 does." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-[color:rgba(8,14,28,0.55)] p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-brand/40 text-sm font-bold text-brand-2">
                {s.n}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-ink">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-[color:rgba(245,158,11,0.35)] bg-[color:rgba(245,158,11,0.06)] p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <p className="text-sm leading-relaxed text-ink-dim">
            <span className="font-semibold text-warn-soft">Honest note.</span> This proof of concept
            uses <span className="font-medium text-ink">synthetic issuers and synthetic sample
            certificates</span>. No real institution, person, or credential is represented. The
            mechanism is real; the data is fabricated for demonstration on Hedera testnet.
          </p>
        </div>
      </section>

      {/* ── G · What makes Cred402 different ──────────────────────────────── */}
      <section className="mt-16">
        <SectionHead
          eyebrow="The difference"
          title="What makes Cred402 different"
          lead="Not a claim to be the best — a description of the specific design choices."
        />
        <GlassPanel className="mt-8 overflow-hidden p-0">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-px bg-border text-sm">
            <Cell head>Property</Cell>
            <Cell head className="text-brand-ink">Cred402</Cell>
            <Cell head>Typical portal check</Cell>
            {[
              ["Account required", false, true],
              ["Pay-per-use (no subscription)", true, false],
              ["Machine-readable 402 API", true, false],
              ["Tamper detection by hash", true, false],
              ["On-chain proof (HCS + HashScan)", true, false],
              ["Independent settlement verification", true, false],
            ].map(([prop, a, b]) => (
              <RowCells key={prop as string} prop={prop as string} a={a as boolean} b={b as boolean} />
            ))}
          </div>
        </GlassPanel>
        <p className="mt-3 text-center text-xs text-ink-faint">
          Comparison is illustrative of design trade-offs, not a ranking of any specific product.
        </p>
      </section>

      {/* ── H · Privacy & security ────────────────────────────────────────── */}
      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Eye, title: "Files are never stored", body: "Uploads are hashed in memory and discarded — only a hash is kept." },
          { icon: Lock, title: "No personal data on-chain", body: "HCS records carry a hash, ids, and a timestamp. Never file bytes or PII." },
          { icon: ShieldCheck, title: "Genuine 402 gate", body: "Reports release only after a real, independently-confirmed x402 settlement." },
          { icon: KeyRound, title: "Replay-safe payments", body: "Each settled transaction unlocks exactly one report (first-use-wins)." },
        ].map((t) => (
          <GlassPanel key={t.title} className="p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-[color:rgba(0,180,255,0.06)]">
              <t.icon className="h-5 w-5 text-brand-2" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-ink">{t.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">{t.body}</p>
          </GlassPanel>
        ))}
      </section>

      {/* ── I · Original-vs-tampered demonstration + Create Tamper Demo ───── */}
      <section className="mt-16 scroll-mt-24" id="tamper-demo">
        <SectionHead
          eyebrow="Prove it yourself"
          title="Original vs. tampered — Create Tamper Demo"
          lead="Anchor a file, change one byte of a copy, and watch the verdict flip from VALID to TAMPERED — backed by the same HCS anchor."
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <div className="mt-8">
          <TamperDemo health={health} />
        </div>
      </section>

      {/* ── J · Who it's for ──────────────────────────────────────────────── */}
      <section className="mt-16">
        <SectionHead eyebrow="Audience" title="Who it's for" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((a) => (
            <GlassPanel key={a.title} className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-[color:rgba(0,180,255,0.06)]">
                <a.icon className="h-5 w-5 text-brand-2" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-ink">{a.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">{a.body}</p>
            </GlassPanel>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mt-16 rounded-3xl border border-border bg-[color:rgba(0,180,255,0.05)] p-8 text-center">
        <h2 className="text-2xl font-bold text-ink">Ready to verify a certificate?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-ink-dim">
          No account needed. Upload a file or try a synthetic sample.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="lg" href="/?verify=1">
            <ShieldCheck className="h-4.5 w-4.5" /> Verify a Certificate
          </Button>
          <Button size="lg" variant="outline" href="/#samples">
            <FileText className="h-4.5 w-4.5" /> Browse Samples <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}

function Cell({
  children,
  head,
  className,
}: {
  children: React.ReactNode;
  head?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-[color:rgba(8,14,28,0.6)] px-3 py-3 sm:px-4",
        head ? "text-xs font-semibold uppercase tracking-wider text-ink-faint" : "text-ink-dim",
        className,
      )}
    >
      {children}
    </div>
  );
}

function RowCells({ prop, a, b }: { prop: string; a: boolean; b: boolean }) {
  return (
    <>
      <Cell className="text-ink">{prop}</Cell>
      <Cell>{a ? <Check className="h-4 w-4 text-ok" /> : <X className="h-4 w-4 text-ink-faint" />}</Cell>
      <Cell>{b ? <Check className="h-4 w-4 text-ok" /> : <X className="h-4 w-4 text-ink-faint" />}</Cell>
    </>
  );
}
