import { after } from "next/server";
import { ObjectId } from "mongodb";
import { withAuth, json, bad, loadProject, saveProject } from "@/lib/api";
import { files } from "@/lib/db";
import { config } from "@/lib/config";
import { extractResumeText } from "@/lib/parse";
import { understandResume } from "@/lib/ai/stages";
import { serializeProject } from "@/lib/types";
import { runResearch } from "@/lib/research-runner";

export const maxDuration = 300;

export const POST = withAuth(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const project = await loadProject(session, id);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return bad("No file received");
  if (file.size > config.maxUploadMb * 1024 * 1024) return bad(`That file is over ${config.maxUploadMb} MB`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const t0 = Date.now();
  const { text, pages } = await extractResumeText(buffer, file.type, file.name);
  if (text.replace(/\s/g, "").length < 60) return bad("I couldn't read any text in that file. Try a PDF, DOCX or a clear photo of the resume.");

  const fileId = new ObjectId();
  await (await files()).insertOne({ _id: fileId, userId: new ObjectId(session.uid), name: file.name, mime: file.type || "application/octet-stream", size: file.size, data: buffer, createdAt: new Date() });

  const { profile, understanding } = await understandResume(text, file.name, pages, Date.now() - t0, session.name);
  understanding.readMs = Date.now() - t0;

  await saveProject(project._id, {
    sourceFileId: fileId,
    sourceText: text,
    understanding,
    profile,
    title: profile.name ? `${profile.name}'s Mosaic` : project.title,
    skippedUpload: false,
    stage: Math.max(project.stage, 2),
    // reset downstream work since the source changed
    research: { status: "running", startedAt: new Date(), pagesChecked: 0, candidates: [] },
    extractions: [],
    readingStatus: "idle",
    questions: [],
  });

  // Research runs while the person reads "What I understood", so stage 3 is ready without a wait.
  after(() => runResearch(project._id));

  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh) });
});
