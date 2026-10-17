import { after } from "next/server";
import { withAuth, json, loadProject, saveProject } from "@/lib/api";
import { runResearch } from "@/lib/research-runner";
import { serializeProject } from "@/lib/types";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** Starts (or restarts) the web research; used when the upload was skipped or research failed. */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const body = (await req.json().catch(() => ({}))) as { force?: boolean; name?: string; headline?: string; location?: string };
  if (body.name && body.name.trim()) {
    const profile = { ...p.profile, name: body.name.trim(), headline: body.headline?.trim() || p.profile.headline, location: body.location?.trim() || p.profile.location };
    await saveProject(p._id, { profile, title: `${profile.name}'s Mosaic`, skippedUpload: true });
  }
  const current = await loadProject(session, id);
  if (body.force || !current.research || current.research.status === "failed" || current.research.status === "idle") {
    await saveProject(p._id, { research: { status: "running", startedAt: new Date(), pagesChecked: 0, candidates: current.research?.candidates.filter((c) => c.addedByUser) ?? [] } });
    after(() => runResearch(p._id));
  }
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh) });
});

export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  return json({ research: p.research ?? { status: "idle", pagesChecked: 0, candidates: [] } });
});
