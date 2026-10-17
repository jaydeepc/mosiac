import { withAuth, json, bad, loadProject, saveProject } from "@/lib/api";
import { suggestAim, insightsForRole, writeSummary } from "@/lib/ai/stages";
import { serializeProject } from "@/lib/types";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

/**
 * No body → role suggestions + shape (cached).
 * { role, jobDescription?, shape? } → saves the aim, writes insights and the summary.
 */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const body = (await req.json().catch(() => ({}))) as { role?: string; jobDescription?: string; shape?: "leader" | "builder" | "specialist"; refresh?: boolean };

  if (!body.role) {
    if (!p.roleSuggestions?.length || body.refresh) {
      const s = await suggestAim(p);
      await saveProject(p._id, { roleSuggestions: s.roleSuggestions, shape: p.shape ?? s.shape, shapeReason: s.shapeReason, targetRole: p.targetRole ?? s.defaultRole, stage: Math.max(p.stage, 5), liveDraft: undefined });
    }
    const fresh = await loadProject(session, id);
    return json({ project: serializeProject(fresh) });
  }

  const role = body.role.trim();
  if (!role) return bad("Name a role first");
  const [insights, summary] = await Promise.all([insightsForRole(p, role, body.jobDescription), writeSummary({ ...p, targetRole: role }, role)]);
  await saveProject(p._id, {
    targetRole: role,
    jobDescription: body.jobDescription?.trim() || undefined,
    shape: body.shape ?? p.shape,
    insights,
    profile: { ...p.profile, summary },
    stage: Math.max(p.stage, 5),
    // the resume must be re-crafted for a new aim
    craftStatus: "idle",
  });
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh) });
});
