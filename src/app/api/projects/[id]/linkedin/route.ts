import { withAuth, json, bad, loadProject, saveProject, uid } from "@/lib/api";
import { extractResumeText } from "@/lib/parse";
import { serializeProject, type Candidate } from "@/lib/types";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

/**
 * Fallback when the public profile can't be read: LinkedIn's own "Save to PDF" export (multipart `file`)
 * or pasted profile text (JSON `text`). Becomes the chosen LinkedIn source, read in stage 3b.
 */
export const POST = withAuth(async (session, req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await loadProject(session, id);
  let text = "";
  let fileName: string | undefined;
  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return bad("No file received");
    fileName = file.name;
    text = (await extractResumeText(Buffer.from(await file.arrayBuffer()), file.type, file.name)).text;
  } else {
    text = ((await req.json().catch(() => ({}))) as { text?: string }).text ?? "";
  }
  text = text.trim();
  if (text.replace(/\s/g, "").length < 80) return bad("I couldn't read enough text from that. Try LinkedIn's PDF export (Profile → More → Save to PDF) or paste the profile text.");

  const research = p.research ?? { status: "done" as const, pagesChecked: 0, candidates: [] };
  const existing = research.candidates.find((c) => c.url === "about:linkedin-export");
  const candidate: Candidate = existing ?? {
    id: uid("c"),
    group: "linkedin",
    kind: "Export",
    source: "LinkedIn",
    title: fileName ? `Your LinkedIn export (${fileName})` : "Your LinkedIn profile (pasted)",
    subtitle: "Read exactly as you exported it",
    url: "about:linkedin-export",
    strength: "strong",
    why: "Why: you supplied this yourself — dates and roles are taken as written.",
    addedByUser: true,
    selected: true,
  };
  const candidates = existing ? research.candidates : [...research.candidates, candidate];
  await saveProject(p._id, {
    linkedinExport: { text, fileName, addedAt: new Date() },
    research: { ...research, candidates },
    linkedinChoice: candidate.id,
    // force a fresh read of this source
    extractions: p.extractions.filter((e) => e.candidateId !== candidate.id),
  });
  const fresh = await loadProject(session, id);
  return json({ project: serializeProject(fresh), candidate });
});
