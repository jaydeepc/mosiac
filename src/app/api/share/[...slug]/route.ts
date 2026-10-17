import { ensureSetup, projects } from "@/lib/db";
import { resumeToPdf } from "@/lib/export/pdf";
import { toBody } from "@/lib/bytes";

export const maxDuration = 300;

/** Public PDF for a shared Mosaic: /api/share/<slug...>/pdf?lang=main|second */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await ctx.params;
  const parts = [...slug];
  if (parts[parts.length - 1] !== "pdf") return new Response("Not found", { status: 404 });
  parts.pop();
  await ensureSetup();
  const p = await (await projects()).findOne({ shareSlug: decodeURIComponent(parts.join("/")) });
  if (!p?.resume) return new Response("Not found", { status: 404 });
  const which = new URL(req.url).searchParams.get("lang") === "second" ? "second" : "main";
  const doc = which === "second" && p.resumeSecond ? p.resumeSecond : p.resume;
  const pdf = await resumeToPdf(new URL(req.url).origin, p._id.toString(), which);
  const name = `${(doc.name || "mosaic").replace(/[^\p{L}\p{N}]+/gu, "-")}.pdf`;
  return new Response(toBody(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"` } });
}
