"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/Mark";
import { ProgressBars } from "@/components/stage/StageShell";
import { Washes } from "@/components/Washes";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { ScaledSheet } from "@/components/resume/ScaledSheet";
import { Check, Download, FileIcon, Globe, LinkIcon, Plus, Spinner } from "@/components/Icons";
import { api, useProject } from "@/lib/client";
import { languageLabel } from "@/lib/config";
import type { ProjectJSON } from "@/lib/types";

export function ReadyStage({ initial }: { initial: ProjectJSON }) {
  const { project, setProject, patch } = useProject(initial.id, initial);
  const p = project ?? initial;
  const [share, setShare] = useState<string | null>(null);
  useEffect(() => {
    if (p.shareSlug) setShare(`${window.location.origin}/r/${p.shareSlug}`);
  }, [p.shareSlug]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstName = (p.resume?.name || p.profile.name || "").split(" ")[0];
  const doc = p.resume;

  async function download(format: "pdf" | "docx", which: "main" | "second" = "main") {
    setBusy(`${format}-${which}`);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${p.id}/export?format=${format}&lang=${which}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Export failed" }))).error);
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = decodeURIComponent(name ?? `mosaic.${format}`);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function makeLink() {
    setBusy("share");
    try {
      const { url } = await api<{ url: string; slug: string }>(`/api/projects/${p.id}/share`, { method: "POST" });
      const local = `${window.location.origin}/r/${url.split("/r/")[1]}`;
      setShare(local);
      setProject((prev) => (prev ? { ...prev, shareSlug: url.split("/r/")[1] } : prev));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const photoUrl = p.photoFileId ? `/api/files/${p.photoFileId}` : undefined;
  const backdropUrl = p.infographicArtId ? `/api/art/${p.infographicArtId}` : undefined;

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink flex flex-col">
      <Washes variant="ready" />
      <header className="relative flex items-center justify-between gap-4 flex-wrap" style={{ padding: "16px 32px" }}>
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-muted">Stage 8 of 8</span>
          <ProgressBars stage={8} />
        </div>
        <Link href={`/m/${p.id}/craft`} className="btn-ghost text-[13px]" style={{ padding: "8px 12px" }}>
          Back to editing
        </Link>
      </header>

      <main className="relative w-full mx-auto flex flex-wrap gap-12 items-center flex-1" style={{ maxWidth: 1200, padding: "32px 24px 56px", boxSizing: "border-box" }}>
        <section className="min-w-0 flex flex-col gap-[26px]" style={{ flex: "1 1 420px" }}>
          <div className="flex gap-2.5 items-end" style={{ height: 48 }} aria-hidden="true">
            {[
              ["-8deg", 34, 8, "#2F6F73", 0],
              ["6deg", 42, 10, "#9CC3C5", 0.12],
              ["-4deg", 28, 7, "#E7B99E", 0.24],
              ["10deg", 36, 9, "#C9693F", 0.36],
              ["-6deg", 24, 6, "#DCE3F5", 0.48],
            ].map(([r, s, br, bg, d], i) => (
              <span key={i} className="anim-settle" style={{ "--r": r, width: s as number, height: s as number, borderRadius: br as number, background: bg as string, animationDelay: `${d}s` } as React.CSSProperties} />
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <h1 className="m-0 font-display font-normal text-[40px] sm:text-[56px] leading-[1.05] tracking-[-0.02em]" style={{ textWrap: "pretty" }}>
              Your Mosaic is ready{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="m-0 text-[17px] text-muted leading-[1.55]">
              Two pages{p.targetRole ? (
                <>
                  , aimed at <strong className="text-ink">{p.targetRole}</strong>
                </>
              ) : null}
              . Nothing in it that you didn&apos;t tell me or confirm.
            </p>
          </div>

          {error && <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>{error}</p>}

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))" }}>
            <button type="button" disabled={!doc || busy !== null} onClick={() => download("pdf")} className="flex flex-col gap-2.5 rounded-[18px] border-0 text-white text-left" style={{ padding: 18, background: "#2F6F73", boxShadow: "0 12px 28px rgba(47,111,115,0.25)", font: "inherit", cursor: "pointer" }}>
              {busy === "pdf-main" ? <Spinner size={26} light /> : <Download size={26} />}
              <span className="flex flex-col gap-0.5">
                <strong className="text-base">PDF</strong>
                <span className="text-xs" style={{ opacity: 0.85 }}>
                  {doc?.look === "visual" ? "Visual" : "Classic"} · {languageLabel(p.outputLanguage)} · 2 pages
                </span>
              </span>
            </button>
            <button type="button" disabled={!doc || busy !== null} onClick={() => download("docx")} className="flex flex-col gap-2.5 rounded-[18px] bg-white border border-line text-ink text-left" style={{ padding: 18, font: "inherit", cursor: "pointer" }}>
              {busy === "docx-main" ? <Spinner size={26} /> : <FileIcon size={26} stroke="#2F6F73" />}
              <span className="flex flex-col gap-0.5">
                <strong className="text-base">Word (DOCX)</strong>
                <span className="text-xs text-muted">Editable, same content</span>
              </span>
            </button>
            {p.secondLanguage && (
              <button type="button" disabled={!p.resumeSecond || busy !== null} onClick={() => download("pdf", "second")} className="flex flex-col gap-2.5 rounded-[18px] bg-white border border-line text-ink text-left" style={{ padding: 18, font: "inherit", cursor: "pointer", opacity: p.resumeSecond ? 1 : 0.6 }}>
                {busy === "pdf-second" ? <Spinner size={26} /> : <Globe size={26} stroke="#2F6F73" />}
                <span className="flex flex-col gap-0.5">
                  <strong className="text-base">{languageLabel(p.secondLanguage)} version</strong>
                  <span className="text-xs text-muted">{p.resumeSecond ? "PDF · written natively" : "Not generated yet — re-craft to add it"}</span>
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 card flex-wrap" style={{ padding: "14px 16px", borderRadius: 16 }}>
            <LinkIcon size={20} stroke="#5B6472" />
            <span className="flex-1 text-sm text-muted truncate" style={{ minWidth: 160 }}>
              {share ?? "Create a private link to share this Mosaic"}
            </span>
            {share ? (
              <button type="button" className="btn-secondary" style={{ padding: "9px 14px", fontSize: 13 }} onClick={async () => { await navigator.clipboard.writeText(share); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <Check size={14} stroke="#2F6F73" /> : null} {copied ? "Copied" : "Copy link"}
              </button>
            ) : (
              <button type="button" className="btn-secondary" style={{ padding: "9px 14px", fontSize: 13 }} disabled={!doc || busy === "share"} onClick={makeLink}>
                {busy === "share" ? <Spinner size={14} /> : null} Create link
              </button>
            )}
          </div>

          <div className="flex gap-[18px] flex-wrap items-center">
            <Link href={`/m/${p.id}/aim`} className="inline-flex items-center gap-2 text-sm font-bold text-teal no-underline">
              <Plus size={16} /> Aim the same story at another role
            </Link>
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={Boolean(p.nudge)} onChange={(e) => patch({ nudge: e.target.checked })} style={{ accentColor: "#2F6F73", width: 18, height: 18, margin: 0 }} />
              Nudge me in six months to keep it current
            </label>
          </div>
        </section>

        <section aria-label="Preview of both pages" className="min-w-0 flex justify-center items-center" style={{ flex: "1 1 460px" }}>
          {doc ? (
            <div className="relative" style={{ width: "min(480px, 100%)", height: 540 }}>
              <div className="absolute" style={{ left: "25%", top: 40, width: "62%", transform: "rotate(4deg)", filter: "drop-shadow(0 24px 48px rgba(30,36,48,0.12))" }}>
                <ScaledSheet page={2} maxWidth={300}>
                  <ResumeDocument doc={doc} opts={{ photoUrl, backdropUrl }} />
                </ScaledSheet>
              </div>
              <div className="absolute" style={{ left: "8%", top: 0, width: "62%", transform: "rotate(-4deg)", filter: "drop-shadow(0 30px 60px rgba(30,36,48,0.14))" }}>
                <ScaledSheet page={1} maxWidth={300}>
                  <ResumeDocument doc={doc} opts={{ photoUrl, backdropUrl }} />
                </ScaledSheet>
              </div>
              <div className="absolute flex gap-2 items-center bg-white border border-line rounded-full text-[13px] font-semibold" style={{ left: "30%", bottom: 10, padding: "10px 14px", boxShadow: "0 10px 24px rgba(30,36,48,0.10)" }}>
                <Check size={14} stroke="#2F6F73" strokeWidth={3} /> Two pages · reads well to screening software
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-muted">
              Nothing crafted yet.{" "}
              <Link href={`/m/${p.id}/craft`} className="font-bold">
                Craft your Mosaic
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
