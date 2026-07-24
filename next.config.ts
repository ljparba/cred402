import type { NextConfig } from "next";

/**
 * Baseline security headers applied to EVERY response — pages and API routes
 * alike — through Next.js's supported `headers()` hook.
 *
 * Deliberately limited to headers that cannot break existing behaviour:
 * HashScan / GitHub links, the x402 facilitator, fonts, and the app's own
 * fetches are all unaffected. A Content-Security-Policy is NOT added here: the
 * app has none today, and introducing one needs its own compatibility review
 * (inline styles, framer-motion, Next's runtime) rather than a blind default.
 */
const SECURITY_HEADERS = [
  // Never let a browser MIME-sniff a response into something executable.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the full referrer only to same-origin; just the origin cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these; deny them outright.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // No framing — clickjacking protection for the verification/payment flow.
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // These packages must run as real Node modules, not be bundled by webpack.
  // PGlite locates its WASM via file URLs (bundling breaks it with an
  // "ERR_INVALID_ARG_TYPE: Received an instance of URL"); the Hedera SDK and
  // pdf-lib/postgres are likewise happier left external on the server.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@hiero-ledger/sdk",
    "pdf-lib",
    "postgres",
  ],

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
