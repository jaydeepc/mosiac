import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { ensureSetup, projects } from "@/lib/db";
import { emptyProfile, type ProjectDoc } from "@/lib/types";

/** Creates a fresh Mosaic and lands on stage 2. */
export async function GET(req: Request) {
  await ensureSetup();
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login?next=/new", req.url));
  const now = new Date();
  const doc: ProjectDoc = {
    _id: new ObjectId(),
    userId: new ObjectId(session.uid),
    title: "Untitled Mosaic",
    stage: 2,
    language: session.language || "en",
    outputLanguage: "en",
    createdAt: now,
    updatedAt: now,
    profile: emptyProfile(session.name),
    extractions: [],
    questions: [],
    look: "visual",
    comments: [],
  };
  await (await projects()).insertOne(doc);
  return NextResponse.redirect(new URL(`/m/${doc._id.toString()}/upload`, req.url));
}
