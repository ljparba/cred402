/**
 * Dependency-free .env loader for CLI scripts run under `tsx` (outside Next.js,
 * which loads env automatically). Loads `.env.local` then `.env`; existing
 * process.env values always win. Import this FIRST in any script.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadFile(file: string): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadFile(".env.local");
loadFile(".env");
