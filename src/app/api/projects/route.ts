import { ObjectId } from "mongodb";
import { withAuth, json } from "@/lib/api";
import { projects } from "@/lib/db";
import { emptyProfile, serializeProject, type ProjectDoc } from "@/lib/types";

export const GET = withAuth(async (session) => {
  const col = await projects();
  const list = await col
    .find({ userId: new ObjectId(session.uid) }, { projection: { sourceText: 0, "profile.facts": 0 }, sort: { updatedAt: -1 } })
    .toArray();
  return json({ projects: list.map(serializeProject) });
});

export const POST = withAuth(async (session, req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { language?: string; outputLanguage?: string };
  const now = new Date();
  const doc: ProjectDoc = {
    _id: new ObjectId(),
    userId: new ObjectId(session.uid),
    title: "Untitled Mosaic",
    stage: 2,
    language: body.language || session.language || "en",
    outputLanguage: body.outputLanguage || "en",
    createdAt: now,
    updatedAt: now,
    profile: emptyProfile(session.name),
    extractions: [],
    questions: [],
    look: "visual",
    comments: [],
  };
  await (await projects()).insertOne(doc);
  return json({ project: serializeProject(doc) }, { status: 201 });
});
