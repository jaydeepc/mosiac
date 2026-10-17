import { withAuth, loadProject, sse, bad } from "@/lib/api";
import { projects } from "@/lib/db";
import { readSource } from "@/lib/ai/stages";
import type { Extraction } from "@/lib/types";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/**
 * Stage 3b: opens every ticked page, streams progress, and shows what was taken and left out.
 * Already-read pages are skipped unless `force` is set.
 */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const start = await loadProject(session, id);
  const body = (await req.json().catch(() => ({}))) as { force?: boolean; candidateIds?: string[] };
  if (!start.research) return bad("Nothing to read yet");

  const chosenLi = start.linkedinChoice && start.linkedinChoice !== "none" ? start.linkedinChoice : null;
  const toRead = start.research.candidates.filter((c) => (c.group === "linkedin" ? c.id === chosenLi : c.selected) && (!body.candidateIds || body.candidateIds.includes(c.id)));

  return sse(async (send) => {
    const col = await projects();
    let p = (await col.findOne({ _id: start._id }))!;
    const extractions: Extraction[] = p.extractions.filter((e) => toRead.some((c) => c.id === e.candidateId) && e.status === "done" && !body.force);
    // mark queue
    for (const c of toRead) if (!extractions.some((e) => e.candidateId === c.id)) extractions.push({ candidateId: c.id, title: `${c.source} · ${c.title}`, status: "pending", took: [], leftOut: [], willAsk: [] });
    await col.updateOne({ _id: p._id }, { $set: { extractions, readingStatus: "running", updatedAt: new Date() } });
    send("queue", { extractions, total: toRead.length });

    let done = extractions.filter((e) => e.status === "done").length;
    for (const c of toRead) {
      const idx = extractions.findIndex((e) => e.candidateId === c.id);
      if (extractions[idx].status === "done") continue;
      extractions[idx] = { ...extractions[idx], status: "reading" };
      await col.updateOne({ _id: p._id }, { $set: { extractions } });
      send("reading", { candidateId: c.id, title: extractions[idx].title, done, total: toRead.length });
      try {
        p = (await col.findOne({ _id: p._id }))!;
        const { extraction, profile } = await readSource(p, c, (line) => send("reading", { candidateId: c.id, title: extractions[idx].title, done, total: toRead.length, line }));
        extractions[idx] = extraction;
        done++;
        await col.updateOne({ _id: p._id }, { $set: { extractions, profile, updatedAt: new Date() } });
        send("read", { extraction, profile, done, total: toRead.length });
      } catch (e) {
        extractions[idx] = { ...extractions[idx], status: "failed", note: `I couldn't open this page (${e instanceof Error ? e.message : "error"}). Nothing was taken from it.` };
        done++;
        await col.updateOne({ _id: p._id }, { $set: { extractions } });
        send("read", { extraction: extractions[idx], done, total: toRead.length });
      }
    }
    await col.updateOne({ _id: p._id }, { $set: { readingStatus: "done", stage: Math.max(p.stage, 3), updatedAt: new Date() } });
    const placed = extractions.reduce((n, e) => n + e.took.length, 0);
    send("finished", { placed });
  });
});
