import { ObjectId } from "mongodb";
import { withAuth, json, bad, loadProject, saveProject } from "@/lib/api";
import { files } from "@/lib/db";
import { serializeProject } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return bad("Choose an image");
  if (file.size > 8 * 1024 * 1024) return bad("Photo is over 8 MB");
  const _id = new ObjectId();
  await (await files()).insertOne({ _id, userId: new ObjectId(session.uid), name: file.name, mime: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()), createdAt: new Date() });
  if (p.photoFileId) await (await files()).deleteOne({ _id: p.photoFileId });
  await saveProject(p._id, { photoFileId: _id });
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh) });
});

export const DELETE = withAuth(async (session, _req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  if (p.photoFileId) await (await files()).deleteOne({ _id: p.photoFileId });
  await saveProject(p._id, {}, { $unset: { photoFileId: "" } });
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh) });
});
