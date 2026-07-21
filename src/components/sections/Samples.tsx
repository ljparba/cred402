/**
 * Sample Certificates catalogue (mockup 1). Pulls /api/samples and renders a
 * category-coded grid. Each card offers a direct download and a "Use this
 * sample" action that downloads the blob and feeds it through the verify flow.
 */
"use client";

import { motion } from "framer-motion";
import { Download, ArrowRight, FileWarning } from "lucide-react";
import { GlassPanel, SectionLabel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import type { SampleItem } from "@/components/lib/api";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<string, { chip: string; dot: string; ext: string }> = {
  valid: { chip: "text-ok border-[color:rgba(34,197,94,0.4)]", dot: "bg-ok", ext: "PDF" },
  tampered: { chip: "text-danger border-[color:rgba(239,68,68,0.4)]", dot: "bg-danger", ext: "PDF" },
  expired: { chip: "text-warn border-[color:rgba(245,158,11,0.4)]", dot: "bg-warn", ext: "PDF" },
  revoked: { chip: "text-warn border-[color:rgba(245,158,11,0.4)]", dot: "bg-warn", ext: "PDF" },
  unregistered: { chip: "text-orange border-[color:rgba(251,146,60,0.4)]", dot: "bg-orange", ext: "PDF" },
  fake: { chip: "text-neutral border-[color:rgba(148,163,184,0.4)]", dot: "bg-neutral", ext: "PDF" },
};

function MiniCert({ tone }: { tone: string }) {
  return (
    <div
      className="relative grid h-24 w-full place-items-center overflow-hidden rounded-lg border border-border"
      style={{ background: "linear-gradient(135deg, #eef3fb, #cdd9ec)" }}
    >
      <svg viewBox="0 0 120 76" className="h-full w-full opacity-90">
        <text x="60" y="22" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fontStyle="italic" fill="#20304e">
          Certificate
        </text>
        <line x1="30" y1="30" x2="90" y2="30" stroke="#a9b8d2" strokeWidth="0.8" />
        <text x="60" y="44" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" fontStyle="italic" fill="#3a4a68">
          Jane Doe
        </text>
        <line x1="20" y1="60" x2="55" y2="60" stroke="#a9b8d2" strokeWidth="0.6" />
        <circle cx="96" cy="58" r="8" fill="#cfa441" stroke="#8a5f12" strokeWidth="0.8" />
      </svg>
      <span className={cn("absolute right-1.5 top-1.5 h-2 w-2 rounded-full", tone)} />
    </div>
  );
}

export function Samples({
  samples,
  loading,
  onUseSample,
  className,
}: {
  samples: SampleItem[];
  loading: boolean;
  onUseSample: (sample: SampleItem) => void;
  className?: string;
}) {
  return (
    <GlassPanel id="samples" as="section" className={cn("flex flex-col p-6 sm:p-7", className)} aria-labelledby="samples-title">
      <div className="flex items-center justify-between">
        <SectionLabel>Sample Certificates</SectionLabel>
        <span className="text-xs text-ink-faint">{samples.length} synthetic demo files</span>
      </div>
      <h2 id="samples-title" className="sr-only">
        Downloadable sample certificates
      </h2>

      {loading ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-xl" />
          ))}
        </div>
      ) : samples.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 py-10 text-center text-ink-dim">
          <FileWarning className="h-8 w-8 text-ink-faint" />
          <p className="text-sm">No samples available — run the seed script.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {samples.map((s, i) => {
            const style = CATEGORY_STYLE[s.category] ?? CATEGORY_STYLE.fake;
            return (
              <motion.article
                key={s.slug}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.45, delay: Math.min(i, 6) * 0.05 }}
                className="flex flex-col gap-3 rounded-xl border border-border bg-[color:rgba(8,14,28,0.6)] p-3.5 transition-colors hover:border-brand/40"
              >
                <MiniCert tone={style.dot} />
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 text-sm font-semibold leading-snug text-ink">{s.label}</h3>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider",
                      style.chip,
                    )}
                  >
                    {s.category}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-ink-dim">{s.description}</p>
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <Button size="sm" className="min-w-0 flex-1" onClick={() => onUseSample(s)}>
                    <span className="truncate">Use this sample</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </Button>
                  <a
                    href={s.downloadUrl}
                    download={s.filename}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-ink-dim transition-colors hover:border-brand/50 hover:text-brand-2"
                    aria-label={`Download ${s.label}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}
