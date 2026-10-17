import { withAuth, json, bad, loadProject, saveProject } from "@/lib/api";
import { absorbAnswer, liveDraftLine } from "@/lib/ai/stages";
import { serializeProject, type Question } from "@/lib/types";
import { uid } from "@/lib/api";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

/**
 * Records an answer (spoken transcript or typed text) and folds it into the story.
 * `partial: true` only refreshes the live "writing as you speak" line.
 */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const body = (await req.json()) as { questionId?: string; text?: string; language?: string; translation?: string; durationSec?: number; skip?: boolean; partial?: boolean; freeform?: boolean };

  let question: Question | undefined = p.questions.find((q) => q.id === body.questionId);
  if (!question && body.freeform) {
    question = { id: uid("q"), text: "Anything else you want in your Mosaic?", status: "open" };
    await saveProject(p._id, { questions: [...p.questions, question] });
  }
  if (!question) return bad("Unknown question", 404);

  if (body.partial) {
    const line = await liveDraftLine(p, question, body.text ?? "");
    await saveProject(p._id, { liveDraft: line || undefined });
    return json({ liveDraft: line });
  }

  const questions = p.questions.map((q) => (q.id === question!.id ? q : q));
  const idx = questions.findIndex((q) => q.id === question!.id);
  if (idx < 0) questions.push(question);

  if (body.skip) {
    questions[idx < 0 ? questions.length - 1 : idx] = { ...question, status: "skipped" };
    await saveProject(p._id, { questions, liveDraft: undefined });
    const fresh = await loadProject(session, id);
    return json({ project: serializeProject(fresh), summaryOfChange: "Skipped." });
  }

  const text = (body.text ?? "").trim();
  if (text.length < 3) return bad("I didn't catch anything — try again or type instead.");

  const { profile, summaryOfChange, followUp } = await absorbAnswer(p, question, text, body.language);
  questions[idx < 0 ? questions.length - 1 : idx] = { ...question, status: "answered", answerText: text, answerLanguage: body.language, answerTranslation: body.translation, durationSec: body.durationSec };
  if (followUp && !questions.some((q) => q.text === followUp)) {
    // insert the follow-up right after this question
    const at = (idx < 0 ? questions.length - 1 : idx) + 1;
    questions.splice(at, 0, { id: uid("q"), text: followUp, why: "a detail that would make this stronger", status: "open" });
  }
  await saveProject(p._id, { profile, questions, liveDraft: undefined, stage: Math.max(p.stage, 4) });
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh), summaryOfChange, followUp });
});
