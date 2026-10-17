import { notFound } from "next/navigation";
import Link from "next/link";
import { ensureSetup, projects } from "@/lib/db";
import { Wordmark } from "@/components/Mark";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { ScaledSheet } from "@/components/resume/ScaledSheet";
import { languageLabel } from "@/lib/config";
import { SharePdfButton } from "./SharePdfButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  await ensureSetup();
  const p = await (await projects()).findOne({ shareSlug: slug.join("/") }, { projection: { resume: 1, targetRole: 1 } });
  if (!p?.resume) return { title: "Mosaic" };
  return { title: `${p.resume.name} — ${p.resume.headline} · Mosaic`, description: p.resume.summary.slice(0, 160) };
}

export default async function SharedResume({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<{ lang?: string }> }) {
  const { slug } = await params;
  const { lang } = await searchParams;
  await ensureSetup();
  const p = await (await projects()).findOne({ shareSlug: slug.join("/") }, { projection: { resume: 1, resumeSecond: 1, photoFileId: 1, infographicArtId: 1, targetRole: 1, outputLanguage: 1, secondLanguage: 1, shareSlug: 1 } });
  if (!p?.resume) notFound();
  const doc = lang === "second" && p.resumeSecond ? p.resumeSecond : p.resume;
  const photoUrl = p.photoFileId ? `/api/files/${p.photoFileId.toString()}` : undefined;
  const backdropUrl = p.infographicArtId ? `/api/art/${p.infographicArtId.toString()}` : undefined;

  return (
    <div className="min-h-screen bg-paper-2 text-ink flex flex-col">
      <header className="flex items-center justify-between gap-4 flex-wrap bg-white border-b border-line" style={{ padding: "14px 24px" }}>
        <Wordmark />
        <div className="flex items-center gap-2.5 flex-wrap">
          {p.secondLanguage && p.resumeSecond && (
            <div className="inline-flex border border-line rounded-full overflow-hidden">
              <Link href={`/r/${p.shareSlug}`} className="text-[13px] no-underline" style={{ padding: "8px 14px", background: lang !== "second" ? "#2F6F73" : "#FFF", color: lang !== "second" ? "#FFF" : "#1E2430", fontWeight: 600 }}>
                {languageLabel(p.outputLanguage)}
              </Link>
              <Link href={`/r/${p.shareSlug}?lang=second`} className="text-[13px] no-underline" style={{ padding: "8px 14px", background: lang === "second" ? "#2F6F73" : "#FFF", color: lang === "second" ? "#FFF" : "#1E2430", fontWeight: 600 }}>
                {languageLabel(p.secondLanguage)}
              </Link>
            </div>
          )}
          <SharePdfButton slug={p.shareSlug!} which={lang === "second" ? "second" : "main"} />
        </div>
      </header>
      <main className="flex-1 w-full mx-auto flex flex-col items-center gap-6" style={{ maxWidth: 820, padding: "32px 16px 64px" }}>
        <p className="m-0 text-[13px] text-muted">
          {doc.name}
          {p.targetRole ? ` · aimed at ${p.targetRole}` : ""} · shared from Mosaic
        </p>
        <ScaledSheet page={1} maxWidth={794}>
          <ResumeDocument doc={doc} opts={{ photoUrl, backdropUrl }} />
        </ScaledSheet>
        <ScaledSheet page={2} maxWidth={794}>
          <ResumeDocument doc={doc} opts={{ photoUrl, backdropUrl }} />
        </ScaledSheet>
        <p className="m-0 text-xs text-muted text-center">
          Made with <Link href="/">Mosaic</Link> — your story, pieced together.
        </p>
      </main>
    </div>
  );
}
