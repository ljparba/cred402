/**
 * GET /api/samples  —  the downloadable demo certificate catalogue.
 * Powers the "Sample Certificates" panel; each entry links to its download.
 */
import { json, safeHandler } from "@/lib/http";
import { listSamples } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return safeHandler("api/samples", async () => {
    const rows = await listSamples();
    const samples = rows.map((s) => ({
      slug: s.slug,
      category: s.category,
      label: s.label,
      description: s.description,
      expectedVerdict: s.expectedVerdict,
      credentialId: s.credentialId,
      sha256: s.sha256,
      filename: s.filename,
      downloadUrl: `/api/samples/${s.slug}`,
    }));
    return json({ count: samples.length, samples });
  });
}
