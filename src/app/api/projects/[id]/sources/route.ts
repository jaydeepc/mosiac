import { withAuth, json, bad, loadProject, saveProject } from "@/lib/api";
import { candidateFromUrl } from "@/lib/ai/stages";
import { serializeProject } from "@/lib/types";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

/** Adds a link the person pasted ("Add a link I missed" / "paste my profile link"). */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const { url } = (await req.json()) as { url?: string };
  let clean = (url ?? "").trim();
  if (clean && !/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
  try {
    new URL(clean);
  } catch {
    return bad("That doesn't look like a link");
  }
  const existing = p.research?.candidates ?? [];
  if (existing.some((c) => c.url.replace(/\/$/, "") === clean.replace(/\/$/, ""))) return bad("That link is already in the list");
  const candidate = await candidateFromUrl(p, clean);
  const research = p.research ?? { status: "done" as const, pagesChecked: 0, candidates: [] };
  const candidates = [...existing, candidate];
  if (candidate.group === "linkedin") {
    // a pasted LinkedIn link becomes the chosen one
    await saveProject(p._id, { research: { ...research, candidates }, linkedinChoice: candidate.id });
  } else {
    await saveProject(p._id, { research: { ...research, candidates } });
  }
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh), candidate });
});

/** Saves ticks: which pages are theirs, and which LinkedIn profile. */
export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const { selectedIds, linkedinChoice } = (await req.json()) as { selectedIds?: string[]; linkedinChoice?: string };
  if (!p.research) return bad("No research yet");
  const candidates = p.research.candidates.map((c) => ({ ...c, selected: selectedIds ? selectedIds.includes(c.id) : c.selected }));
  await saveProject(p._id, { research: { ...p.research, candidates }, ...(linkedinChoice !== undefined ? { linkedinChoice } : {}) });
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh) });
});
