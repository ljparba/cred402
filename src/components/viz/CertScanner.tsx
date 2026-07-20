/**
 * Certificate-in-scanner frame (mockups 1, 2, 4).
 *
 * A stylised certificate inside a HUD frame with animated corner brackets and a
 * sweeping cyan scan line. Optional "SCANNING CERTIFICATE" chip and a status
 * strip beneath. The certificate itself is drawn as inline SVG so it needs no
 * asset and reads crisply. Respects reduced-motion (scan line hidden).
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function CertificateArt({ studentName = "Jane Doe", course = "Data Structures & Algorithms" }: { studentName?: string; course?: string }) {
  return (
    <svg viewBox="0 0 320 220" className="h-full w-full" role="img" aria-label="Sample certificate">
      <defs>
        <linearGradient id="cert-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef3fb" />
          <stop offset="1" stopColor="#d7e2f2" />
        </linearGradient>
        <linearGradient id="cert-seal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9a441" />
          <stop offset="1" stopColor="#b6801f" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="312" height="212" rx="6" fill="url(#cert-paper)" />
      <rect x="12" y="12" width="296" height="196" rx="4" fill="none" stroke="#9fb2cf" strokeWidth="1.5" />
      <rect x="18" y="18" width="284" height="184" rx="3" fill="none" stroke="#c3d0e3" strokeWidth="1" />
      <text x="160" y="52" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fontStyle="italic" fill="#1e2b45">
        Certificate
      </text>
      <text x="160" y="70" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fill="#4a5a78">
        of Achievement
      </text>
      <line x1="90" y1="80" x2="230" y2="80" stroke="#c3d0e3" strokeWidth="1" />
      <text x="160" y="98" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" fill="#5a6a88">
        This is to certify that
      </text>
      <text x="160" y="120" textAnchor="middle" fontFamily="Georgia, serif" fontSize="18" fontStyle="italic" fill="#12203a">
        {studentName}
      </text>
      <text x="160" y="140" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" fill="#5a6a88">
        has successfully completed the course
      </text>
      <text x="160" y="156" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fontWeight="600" fill="#1e2b45">
        {course}
      </text>
      <line x1="40" y1="184" x2="120" y2="184" stroke="#8ea1c0" strokeWidth="1" />
      <text x="80" y="194" textAnchor="middle" fontFamily="Georgia, serif" fontSize="6" fill="#6a7a98">
        Registrar
      </text>
      <circle cx="250" cy="176" r="18" fill="url(#cert-seal)" stroke="#8a5f12" strokeWidth="1.5" />
      <text x="250" y="180" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fontWeight="700" fill="#fff">
        H
      </text>
    </svg>
  );
}

export function CertScanner({
  scanning = true,
  tone = "brand",
  label = "Scanning Certificate",
  studentName,
  course,
  className,
  footer,
}: {
  scanning?: boolean;
  tone?: "brand" | "danger" | "ok";
  label?: string;
  studentName?: string;
  course?: string;
  className?: string;
  footer?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const toneColor =
    tone === "danger" ? "var(--color-danger)" : tone === "ok" ? "var(--color-ok)" : "var(--color-brand)";
  const corners = [
    "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
    "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
    "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
    "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
  ];

  return (
    <div className={cn("relative", className)}>
      {/* Scanning chip */}
      {label && (
        <div className="absolute -top-3 left-1/2 z-20 -translate-x-1/2">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em]"
            style={{
              borderColor: `color-mix(in srgb, ${toneColor} 45%, transparent)`,
              background: "rgba(5,9,18,0.9)",
              color: toneColor,
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              {scanning && !reduce && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                  style={{ background: toneColor }}
                />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: toneColor }} />
            </span>
            {label}
          </span>
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-xl border p-4 sm:p-6"
        style={{
          borderColor: `color-mix(in srgb, ${toneColor} 30%, transparent)`,
          background: "linear-gradient(180deg, rgba(6,12,26,0.9), rgba(4,8,18,0.95))",
          boxShadow: `0 0 40px -12px color-mix(in srgb, ${toneColor} 60%, transparent)`,
        }}
      >
        {/* Animated corner brackets */}
        {corners.map((c, i) => (
          <span
            key={i}
            aria-hidden
            className={cn("pointer-events-none absolute h-6 w-6", c)}
            style={{ borderColor: toneColor, opacity: 0.9 }}
          />
        ))}

        {/* Certificate + scan line */}
        <div className="relative mx-auto aspect-[320/220] w-full max-w-md overflow-hidden rounded-md">
          <CertificateArt studentName={studentName} course={course} />

          {scanning && !reduce && (
            <>
              <motion.div
                aria-hidden
                className="absolute inset-x-0 h-16"
                style={{
                  background: `linear-gradient(180deg, transparent, color-mix(in srgb, ${toneColor} 35%, transparent), transparent)`,
                }}
                initial={{ top: "-20%" }}
                animate={{ top: ["-20%", "110%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                aria-hidden
                className="absolute inset-x-0 h-[2px]"
                style={{ background: toneColor, boxShadow: `0 0 14px 2px ${toneColor}` }}
                initial={{ top: "-10%" }}
                animate={{ top: ["-10%", "105%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </>
          )}
          {/* subtle overlay so cert reads as "in the machine" */}
          <div className="pointer-events-none absolute inset-0 bg-[color:rgba(0,60,120,0.12)] mix-blend-screen" />
        </div>
      </div>

      {footer}
    </div>
  );
}
