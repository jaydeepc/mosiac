import type { ObjectId } from "mongodb";
import { projects } from "./db";
import { findCandidates } from "./ai/stages";

/** Runs stage-3 research for a project and stores the candidates. Safe to call twice. */
export async function runResearch(id: ObjectId): Promise<void> {
  const col = await projects();
  const p = await col.findOne({ _id: id });
  if (!p) return;
  if (p.research?.status === "done" && p.research.candidates.length) return;
  await col.updateOne({ _id: id }, { $set: { research: { status: "running", startedAt: new Date(), pagesChecked: 0, candidates: p.research?.candidates ?? [] } } });
  try {
    const { candidates, pagesChecked, intro } = await findCandidates(p);
    // keep any links the person added meanwhile
    const latest = await col.findOne({ _id: id }, { projection: { research: 1 } });
    const userAdded = latest?.research?.candidates.filter((c) => c.addedByUser) ?? [];
    await col.updateOne(
      { _id: id },
      { $set: { research: { status: "done", startedAt: p.research?.startedAt ?? new Date(), finishedAt: new Date(), pagesChecked, candidates: [...candidates, ...userAdded], intro }, updatedAt: new Date() } },
    );
  } catch (e) {
    console.error("[research]", e);
    await col.updateOne({ _id: id }, { $set: { "research.status": "failed", "research.error": e instanceof Error ? e.message : String(e), "research.finishedAt": new Date() } });
  }
}
