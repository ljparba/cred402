/**
 * Hedera hexagonal "H" motif — a recurring decorative mark from the mockups
 * (network nodes, badges, the "Built on Hedera" pill). Pure inline SVG.
 */
import { cn } from "@/lib/utils";

export function HexBadge({
  className,
  size = 32,
  glow = true,
}: {
  className?: string;
  size?: number;
  glow?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={cn(glow && "drop-shadow-[0_0_10px_rgba(0,180,255,0.55)]", className)}
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <linearGradient id="hex-h" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#00b4ff" />
        </linearGradient>
      </defs>
      <path
        d="M20 2 L35.6 11 V29 L20 38 L4.4 29 V11 Z"
        stroke="url(#hex-h)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="rgba(0,180,255,0.06)"
      />
      {/* The "H" */}
      <path
        d="M14 13 V27 M26 13 V27 M14 20 H26"
        stroke="url(#hex-h)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
