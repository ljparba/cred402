/**
 * Reset the LOCAL PGlite database (delete its data dir), then re-migrate + seed.
 * Only touches PGlite — refuses to run against a real DATABASE_URL so it can
 * never drop a Neon/Render database by accident.
 *
 *   npm run db:reset
 */
import "./lib/env";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

if (process.env.DATABASE_URL) {
  console.error(
    "✗ db:reset refuses to run with DATABASE_URL set (would target a real database).\n" +
      "  To reset a remote DB, drop/recreate it in the provider console, then run db:setup.",
  );
  process.exit(1);
}

const dir = resolve(process.cwd(), process.env.PGLITE_DATA_DIR ?? "./.pglite");
if (existsSync(dir)) {
  rmSync(dir, { recursive: true, force: true });
  console.log(`✓ removed ${dir}`);
} else {
  console.log(`· ${dir} did not exist`);
}

const run = (args: string[]) => {
  const r = spawnSync("npm", ["run", ...args], { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run(["db:migrate"]);
run(["db:seed"]);
console.log("✓ reset complete");
