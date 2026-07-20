/**
 * Cred402 brand mark + wordmark.
 *
 * A NEW crystalline hexagon mark (distinct from the mockup's "V"): a faceted
 * cube-in-hexagon built from cyan→blue gradient facets with an inner "4" ridge
 * suggesting the 402 protocol. Pure inline SVG so it is crisp at any size and
 * needs no asset pipeline.
 */
import { cn } from "@/lib/utils";

export function Cred402Mark({ className, title = "Cred402" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-8 w-8", className)}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="c402-face-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#00b4ff" />
        </linearGradient>
        <linearGradient id="c402-face-b" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0e7fd6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="c402-face-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e40af" />
        </linearGradient>
        <filter id="c402-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer hexagon ring */}
      <path
        d="M24 3.5 L40.7 13 V33 L24 42.5 L7.3 33 V13 Z"
        stroke="url(#c402-face-a)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.65"
      />

      {/* Crystalline facets forming a cube */}
      <g filter="url(#c402-glow)">
        {/* top face */}
        <path d="M24 9 L34.5 15 L24 21 L13.5 15 Z" fill="url(#c402-face-a)" opacity="0.95" />
        {/* left face */}
        <path d="M13.5 15 L24 21 V33.5 L13.5 27.5 Z" fill="url(#c402-face-c)" opacity="0.92" />
        {/* right face */}
        <path d="M34.5 15 L24 21 V33.5 L34.5 27.5 Z" fill="url(#c402-face-b)" opacity="0.9" />
        {/* inner ridge highlight suggesting a "4" cut */}
        <path
          d="M24 21 L24 33.5"
          stroke="#eafaff"
          strokeWidth="0.9"
          opacity="0.7"
        />
        <path d="M24 21 L30 17.6" stroke="#bfefff" strokeWidth="0.7" opacity="0.55" />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
  markClassName,
}: {
  className?: string;
  showWordmark?: boolean;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <Cred402Mark className={cn("h-8 w-8 drop-shadow-[0_0_16px_rgba(0,180,255,0.45)]", markClassName)} />
      {showWordmark && (
        <span className="text-[1.35rem] font-semibold tracking-tight text-ink">
          Cred<span className="text-gradient-brand">402</span>
        </span>
      )}
    </span>
  );
}
