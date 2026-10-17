import { notFound } from "next/navigation";
import { ensureSetup, projects, oid } from "@/lib/db";
import { verifyPrintToken } from "@/lib/print-token";
import { ResumeDocument, SHEET_W, SHEET_H } from "@/components/resume/ResumeDocument";

export const dynamic = "force-dynamic";

/**
 * Print-ready rendering of a resume for the PDF exporter (headless Chrome opens this with a signed token).
 * Same component as the screen, so the PDF matches the preview exactly.
 */
export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string; scale?: string }> }) {
  const { id } = await params;
  const { token, scale } = await searchParams;
  const claims = token ? await verifyPrintToken(token) : null;
  if (!claims || claims.pid !== id) notFound();
  await ensureSetup();
  const _id = oid(id);
  if (!_id) notFound();
  const p = await (await projects()).findOne({ _id }, { projection: { resume: 1, resumeSecond: 1, photoFileId: 1, infographicArtId: 1 } });
  const doc = claims.which === "second" ? p?.resumeSecond : p?.resume;
  if (!doc) notFound();
  const fontScale = Math.min(1, Math.max(0.7, Number(scale) || 1));
  const photoUrl = p?.photoFileId && doc.look === "visual" ? `/api/files/${p.photoFileId.toString()}?print=${token}` : undefined;
  const backdropUrl = p?.infographicArtId && doc.look === "visual" ? `/api/art/${p.infographicArtId.toString()}` : undefined;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;500;600;700&family=Noto+Sans+Kannada:wght@400;500;600;700&family=Noto+Sans+Malayalam:wght@400;500;600;700&family=Noto+Sans+Gujarati:wght@400;500;600;700&family=Noto+Sans+Gurmukhi:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        body { width: ${SHEET_W}px; min-height: 0 !important; display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        :root { --font-manrope: var(--font-manrope), "Noto Sans", "Noto Sans Devanagari", "Noto Sans Tamil", "Noto Sans Bengali", "Noto Sans Telugu", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Gujarati", "Noto Sans Gurmukhi", "Noto Naskh Arabic", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", system-ui, sans-serif; }
        .resume-root { min-height: ${SHEET_H}px; }
        .resume-visual .resume-band { position: fixed; top: 0; bottom: 0; left: 0; height: 100vh; }
        li, [data-section] { break-inside: avoid; }
        h3, h4 { break-after: avoid; }
      `}</style>
      <div id="print-root" lang={doc.language || "en"} style={{ width: SHEET_W }}>
        <ResumeDocument doc={doc} opts={{ photoUrl, backdropUrl, fontScale }} />
      </div>
    </>
  );
}
