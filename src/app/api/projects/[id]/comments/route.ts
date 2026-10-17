import { withAuth, json, bad, loadProject, saveProject, uid } from "@/lib/api";
import { applyComment } from "@/lib/ai/stages";
import { serializeProject, type Comment, type ResumeDoc } from "@/lib/types";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

/** Adds a comment on a section and rewrites just that part. */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const body = (await req.json()) as { sectionId?: string; sectionLabel?: string; text?: string; mode?: "spoken" | "typed"; target?: "main" | "second" };
  if (!p.resume) return bad("Craft the resume first");
  if (!body.sectionId || !body.text?.trim()) return bad("Say what you'd change");
  const target = body.target === "second" && p.resumeSecond ? "second" : "main";
  const doc = target === "second" ? p.resumeSecond! : p.resume;
  const { doc: next, resolution } = await applyComment(p, doc, body.sectionId, body.sectionLabel ?? body.sectionId, body.text.trim());
  const comment: Comment = {
    id: uid("cm"),
    sectionId: body.sectionId,
    sectionLabel: body.sectionLabel ?? body.sectionId,
    text: body.text.trim(),
    mode: body.mode ?? "typed",
    createdAt: new Date().toISOString(),
    resolution,
    previous: { target, doc },
  };
  await saveProject(p._id, { comments: [comment, ...p.comments].slice(0, 50), ...(target === "second" ? { resumeSecond: next } : { resume: next }) });
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh), comment });
});

/** Undo a comment's rewrite. */
export const DELETE = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const { commentId } = (await req.json()) as { commentId?: string };
  const c = p.comments.find((x) => x.id === commentId);
  if (!c) return bad("Comment not found", 404);
  const prev = c.previous as { target: "main" | "second"; doc: ResumeDoc } | undefined;
  const set: Record<string, unknown> = { comments: p.comments.filter((x) => x.id !== commentId) };
  if (prev?.doc) set[prev.target === "second" ? "resumeSecond" : "resume"] = prev.doc;
  await saveProject(p._id, set);
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh) });
});
