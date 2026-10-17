import { withAuth, json, bad, loadProject, saveProject } from "@/lib/api";
import { projects } from "@/lib/db";
import { config } from "@/lib/config";

type Ctx = { params: Promise<{ id: string }> };

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const POST = withAuth(async (session, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  if (!p.resume) return bad("Craft the resume first");
  let slug = p.shareSlug;
  if (!slug) {
    const base = `${slugify(p.resume.name || "mosaic") || "mosaic"}/${slugify(p.targetRole || "resume") || "resume"}`;
    slug = base;
    const col = await projects();
    let n = 2;
    while (await col.findOne({ shareSlug: slug, _id: { $ne: p._id } }, { projection: { _id: 1 } })) slug = `${base}-${n++}`;
    await saveProject(p._id, { shareSlug: slug, stage: Math.max(p.stage, 8) });
  }
  return json({ slug, url: `${config.appUrl}/r/${slug}` });
});

export const DELETE = withAuth(async (session, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  await saveProject(p._id, {}, { $unset: { shareSlug: "" } });
  return json({ ok: true });
});
