import { withAuth, json, loadProject, saveProject } from "@/lib/api";
import { projects, files } from "@/lib/db";
import { serializeProject, type ProjectDoc } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (session, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  return json({ project: serializeProject(p) });
});

/** Shallow patch of editable fields. */
const EDITABLE: (keyof ProjectDoc)[] = [
  "title",
  "stage",
  "language",
  "outputLanguage",
  "secondLanguage",
  "linkedinChoice",
  "targetRole",
  "jobDescription",
  "shape",
  "look",
  "nudge",
  "skippedUpload",
  "questions",
  "extractions",
  "comments",
  "resume",
  "profile",
  "research",
  "readingStatus",
  "liveDraft",
];

export const PATCH = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const body = (await req.json()) as Partial<ProjectDoc>;
  const set: Partial<ProjectDoc> = {};
  for (const k of EDITABLE) {
    if (k in body) (set as Record<string, unknown>)[k] = (body as Record<string, unknown>)[k];
  }
  if (typeof set.stage === "number") set.stage = Math.max(p.stage, Math.min(8, set.stage));
  await saveProject(p._id, set);
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh) });
});

export const DELETE = withAuth(async (session, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  await (await projects()).deleteOne({ _id: p._id });
  const ids = [p.sourceFileId, p.photoFileId].filter(Boolean);
  if (ids.length) await (await files()).deleteMany({ _id: { $in: ids as NonNullable<typeof p.sourceFileId>[] } });
  return json({ ok: true });
});
