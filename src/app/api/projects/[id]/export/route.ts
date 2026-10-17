import { withAuth, bad, loadProject } from "@/lib/api";
import { files } from "@/lib/db";
import { resumeToPdf } from "@/lib/export/pdf";
import { resumeToDocx } from "@/lib/export/docx";
import { toBody } from "@/lib/bytes";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** GET ?format=pdf|docx&lang=main|second */
export const GET = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "pdf";
  const which = url.searchParams.get("lang") === "second" ? "second" : "main";
  const doc = which === "second" ? p.resumeSecond : p.resume;
  if (!doc) return bad(which === "second" ? "No second-language version yet" : "Craft the resume first", 404);

  const photo = p.photoFileId && doc.look === "visual" ? await (await files()).findOne({ _id: p.photoFileId }) : null;
  const photoBuf = photo ? Buffer.from(photo.data.buffer) : undefined;
  const base = `${(doc.name || "mosaic").replace(/[^\p{L}\p{N}]+/gu, "-")}-${(p.targetRole || "resume").replace(/[^\p{L}\p{N}]+/gu, "-")}`.replace(/^-+|-+$/g, "");

  if (format === "docx") {
    const buf = await resumeToDocx(doc, photo && photoBuf ? { data: photoBuf, mime: photo.mime } : undefined);
    return new Response(toBody(buf), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.docx"` },
    });
  }

  const pdf = await resumeToPdf(url.origin, p._id.toString(), which);
  return new Response(toBody(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${url.searchParams.get("inline") ? "inline" : "attachment"}; filename="${encodeURIComponent(base)}${which === "second" ? `-${doc.language}` : ""}.pdf"` },
  });
});
