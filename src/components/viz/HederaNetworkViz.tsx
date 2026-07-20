/**
 * Hedera Consensus Service node-network visualization (mockup 1, right column).
 *
 * A central glowing "H" hub with orbiting satellite nodes, animated connection
 * lines, and drifting data pulses — evoking decentralized consensus. Pure SVG +
 * framer-motion; fully static under reduced-motion.
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";

const NODES = [
  { x: 40, y: 40, r: 3 },
  { x: 250, y: 30, r: 2.5 },
  { x: 30, y: 160, r: 2.5 },
  { x: 260, y: 175, r: 3 },
  { x: 150, y: 18, r: 2 },
  { x: 150, y: 195, r: 2 },
  { x: 70, y: 105, r: 2 },
  { x: 230, y: 105, r: 2 },
];
const HUB = { x: 150, y: 108 };

export function HederaNetworkViz({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <svg viewBox="0 0 300 220" className={className} role="img" aria-label="Hedera consensus network">
      <defs>
        <radialGradient id="hub-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#00b4ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#00b4ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="net-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.05" />
          <stop offset="0.5" stopColor="#22d3ee" stopOpacity="0.5" />
          <stop offset="1" stopColor="#00b4ff" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* connection lines */}
      {NODES.map((n, i) => (
        <line
          key={`l-${i}`}
          x1={HUB.x}
          y1={HUB.y}
          x2={n.x}
          y2={n.y}
          stroke="url(#net-line)"
          strokeWidth="1"
        />
      ))}

      {/* data pulses travelling to the hub */}
      {!reduce &&
        NODES.map((n, i) => (
          <motion.circle
            key={`p-${i}`}
            r="1.8"
            fill="#7fdcff"
            initial={{ cx: n.x, cy: n.y, opacity: 0 }}
            animate={{ cx: [n.x, HUB.x], cy: [n.y, HUB.y], opacity: [0, 1, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.35, ease: "easeInOut" }}
          />
        ))}

      {/* satellite nodes */}
      {NODES.map((n, i) => (
        <motion.circle
          key={`n-${i}`}
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill="#22d3ee"
          initial={{ opacity: 0.4 }}
          animate={reduce ? { opacity: 0.6 } : { opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      {/* orbit ring */}
      <motion.circle
        cx={HUB.x}
        cy={HUB.y}
        r="58"
        fill="none"
        stroke="#0e7fd6"
        strokeOpacity="0.25"
        strokeDasharray="3 6"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}
      />

      {/* hub glow + H */}
      <circle cx={HUB.x} cy={HUB.y} r="46" fill="url(#hub-glow)" />
      <circle cx={HUB.x} cy={HUB.y} r="26" fill="rgba(4,10,24,0.9)" stroke="#00b4ff" strokeWidth="1.5" />
      <text
        x={HUB.x}
        y={HUB.y + 8}
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fill="#7fdcff"
        fontFamily="var(--font-sans)"
      >
        H
      </text>
    </svg>
  );
}
