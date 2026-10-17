import { withAuth, json, loadProject, saveProject } from "@/lib/api";
import { generateQuestions } from "@/lib/ai/stages";
import { serializeProject } from "@/lib/types";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

/** Generates the interview plan for stage 4 (idempotent unless `regenerate`). */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const body = (await req.json().catch(() => ({}))) as { regenerate?: boolean; more?: boolean };
  if (body.more) {
    const extra = await generateQuestions(p);
    const asked = new Set(p.questions.map((q) => q.text.toLowerCase()));
    const fresh = extra.filter((q) => !asked.has(q.text.toLowerCase())).slice(0, 2);
    await saveProject(p._id, { questions: [...p.questions, ...fresh] });
  } else if (!p.questions.length || body.regenerate) {
    const questions = await generateQuestions(p);
    await saveProject(p._id, { questions, stage: Math.max(p.stage, 4), readingStatus: p.readingStatus === "running" ? "done" : p.readingStatus });
  }
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh) });
});
