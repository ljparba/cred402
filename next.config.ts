import type { NextConfig } from "next";

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
};

export default nextConfig;
