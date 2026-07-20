/**
 * GET /api/samples/{slug}  —  download a demo certificate file.
 *
 * The slug resolves to a catalogue row; the file path comes from that row's
 * stored `filename`, never from user input, so path traversal is impossible.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NextRequest } from "next/server";
import { apiError, safeHandler } from "@/lib/http";
import { getSampleBySlug } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  return safeHandler("api/samples/[slug]", async () => {
    const { slug } = await ctx.params;
    const sample = await getSampleBySlug(slug);
    if (!sample) {
      return apiError("Sample not found.", 404, { code: "SAMPLE_NOT_FOUND" });
    }

    // filename is a trusted catalogue value (e.g. "valid/hedera-fundamentals.pdf").
    const path = resolve(process.cwd(), "samples", sample.filename);
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch {
      return apiError(
        "Sample file is not available. Run `npm run certs:generate` to produce it.",
        404,
        { code: "SAMPLE_FILE_MISSING" },
      );
    }

    const ext = sample.filename.split(".").pop()?.toLowerCase() ?? "pdf";
    const downloadName = `${sample.slug}.${ext}`;
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": CONTENT_TYPE[ext] ?? "application/octet-stream",
        "content-disposition": `attachment; filename="${downloadName}"`,
        "content-length": String(bytes.byteLength),
        "cache-control": "public, max-age=3600",
      },
    });
  });
}
