import { withAuth, loadProject, sse } from "@/lib/api";
import { projects } from "@/lib/db";
import { craftResume, craftInLanguage, sharpenResume } from "@/lib/ai/stages";
import { generateStoredArt } from "@/lib/art";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** Stage 7: writes the resume (and the second-language version), streaming progress lines. */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const start = await loadProject(session, id);
  const body = (await req.json().catch(() => ({}))) as { force?: boolean; look?: "visual" | "classic"; secondLanguage?: string | null };

  return sse(async (send) => {
    const col = await projects();
    const look = body.look ?? start.look;
    const second = body.secondLanguage === undefined ? start.secondLanguage : body.secondLanguage || undefined;
    await col.updateOne({ _id: start._id }, { $set: { look, secondLanguage: second, craftStatus: "running", updatedAt: new Date() } });

    const needMain = body.force || !start.resume || start.resume.look !== look || start.resume.language !== start.outputLanguage || start.craftStatus !== "done";
    let resume = start.resume;
    if (needMain) {
      send("status", { line: "Reading everything you told me and confirmed…" });
      const p = (await col.findOne({ _id: start._id }))!;
      send("status", { line: `Aiming the story at ${p.targetRole ?? "your next role"}…` });
      resume = await craftResume(p, p.outputLanguage, look);
      send("resume", { resume });
      send("status", { line: "Sharpening every line — outcome first, no filler…" });
      try {
        resume = await sharpenResume(p, resume);
      } catch (e) {
        console.warn("[craft] sharpen failed:", (e as Error).message);
      }
      await col.updateOne({ _id: start._id }, { $set: { resume, comments: [], updatedAt: new Date() } });
      send("resume", { resume });
    } else if (resume) {
      send("resume", { resume });
    }

    // painterly backdrop for charts (visual look only; fails gracefully)
    if (look === "visual" && resume && resume.charts.length && !start.infographicArtId) {
      send("status", { line: "Painting a soft backdrop for your chart…" });
      try {
        const artId = await generateStoredArt(`infographic-${start._id.toString()}`, "A very light, barely-there watercolour backdrop to sit behind a small bar chart: faint washes only in the corners, the centre almost pure paper white.");
        await col.updateOne({ _id: start._id }, { $set: { infographicArtId: artId } });
        send("art", { artId: artId.toString() });
      } catch (e) {
        console.warn("[craft] art failed:", (e as Error).message);
      }
    }

    if (second && resume && (body.force || !start.resumeSecond || start.resumeSecond.language !== second || start.resumeSecond.look !== look || needMain)) {
      send("status", { line: `Writing it natively in ${second}…` });
      try {
        const p = (await col.findOne({ _id: start._id }))!;
        const resumeSecond = await craftInLanguage(p, resume, second);
        await col.updateOne({ _id: start._id }, { $set: { resumeSecond, updatedAt: new Date() } });
        send("resumeSecond", { resumeSecond });
      } catch (e) {
        send("status", { line: `The ${second} version didn't come through — you can retry from the Ready page.` });
        console.warn("[craft] second language failed:", (e as Error).message);
      }
    } else if (!second) {
      await col.updateOne({ _id: start._id }, { $unset: { resumeSecond: "" } });
    }

    await col.updateOne({ _id: start._id }, { $set: { craftStatus: "done", stage: Math.max(start.stage, 7), updatedAt: new Date() } });
    send("status", { line: "Done." });
  });
});
