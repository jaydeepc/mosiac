"use client";

import { useRef, useState } from "react";
import { useNavigate } from "@/components/nav/NavProgress";
import { StageShell } from "@/components/stage/StageShell";
import { PaperPreview } from "@/components/preview/PaperPreview";
import { FunFacts } from "@/components/FunFacts";
import { ArrowRight, Clock, FileIcon, Spinner, Upload } from "@/components/Icons";
import { api, useProject } from "@/lib/client";
import { languageLabel } from "@/lib/config";
import type { ProjectJSON } from "@/lib/types";

export function UploadStage({ initial }: { initial: ProjectJSON }) {
  const { go, pending: navPending } = useNavigate();
  const { project, setProject } = useProject(initial.id, initial);
  const [busy, setBusy] = useState<"idle" | "reading" | "fixing" | "skipping">("idle");
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [fixText, setFixText] = useState("");
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipName, setSkipName] = useState(initial.profile.name || "");
  const [skipHeadline, setSkipHeadline] = useState("");
  const [skipLocation, setSkipLocation] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const p = project ?? initial;
  const u = p.understanding;

  async function upload(file: File) {
    setError(null);
    setBusy("reading");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/upload`, { method: "POST", body: fd });
      setProject(project);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("idle");
    }
  }

  async function sendFix() {
    if (!fixText.trim()) return;
    setBusy("fixing");
    try {
      const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/answer`, { method: "POST", json: { freeform: true, text: `Correction to what you understood from my resume: ${fixText.trim()}` } });
      setProject(project);
      setFixOpen(false);
      setFixText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("idle");
    }
  }

  async function skip() {
    if (!skipName.trim()) {
      setSkipOpen(true);
      return;
    }
    setBusy("skipping");
    try {
      await api(`/api/projects/${p.id}/research`, { method: "POST", json: { name: skipName.trim(), headline: skipHeadline.trim(), location: skipLocation.trim(), force: true } });
      await api(`/api/projects/${p.id}`, { method: "PATCH", json: { stage: 3, skippedUpload: true } });
      go(`/m/${p.id}/identity`);
    } catch (e) {
      setError((e as Error).message);
      setBusy("idle");
    }
  }

  const continueHref = `/m/${p.id}/identity`;

  return (
    <StageShell
      project={p}
      stage={2}
      title="Start with what you already have"
      intro="Any old resume, in any language. Mosaic reads it, understands your journey so far and works out what has changed since."
      aside={<PaperPreview project={p} stage={2} />}
      asideStatus="Page 1 of 2 · builds as you go"
      footer={
        u ? (
          <>
            <button type="button" className="btn-primary" disabled={navPending} onClick={() => go(continueHref)}>
              {navPending ? <Spinner light /> : null} Looks right, continue <ArrowRight size={16} />
            </button>
            <button type="button" className="btn-secondary" onClick={() => setFixOpen((v) => !v)}>
              Something is off
            </button>
            <button type="button" className="btn-ghost ml-auto" onClick={() => setSkipOpen(true)}>
              Start over without this resume
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary" disabled={busy !== "idle"} onClick={() => inputRef.current?.click()}>
              {busy === "reading" ? <Spinner light /> : <Upload size={16} />} Choose a file
            </button>
            <button type="button" className="btn-ghost ml-auto" onClick={() => setSkipOpen(true)}>
              I don&apos;t have a resume — skip
            </button>
          </>
        )
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.rtf,.md,image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />

      {error && (
        <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>
          {error}
        </p>
      )}

      {!u && busy !== "reading" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          className="flex flex-col items-center justify-center gap-3 text-center rounded-[18px] transition-colors"
          style={{ padding: "40px 24px", border: `1.5px dashed ${drag ? "#2F6F73" : "#D9D5CC"}`, background: drag ? "#EEF3F1" : "#FFFFFF", font: "inherit", cursor: "pointer" }}
        >
          <span className="inline-flex items-center justify-center rounded-xl" style={{ width: 52, height: 52, background: "#EEF3F1" }}>
            <FileIcon size={24} stroke="#2F6F73" />
          </span>
          <span className="text-[15px] font-bold">Drop your old resume here</span>
          <span className="text-[13px] text-muted">PDF, Word, text or a photo · any language · up to 15 MB</span>
        </button>
      )}

      {busy === "reading" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3.5 card" style={{ padding: "16px 18px", borderRadius: 16 }}>
            <Spinner size={22} />
            <div className="flex flex-col gap-0.5">
              <strong className="text-[15px]">Reading your resume…</strong>
              <span className="text-[13px] text-muted">Understanding your journey, noticing when it was last updated, and starting the web search in the background.</span>
            </div>
          </div>
          <FunFacts topic="reading" />
        </div>
      )}

      {u && busy !== "reading" && (
        <>
          <div className="flex items-center gap-3.5 card anim-fade-up" style={{ padding: "16px 18px", borderRadius: 16 }}>
            <span className="inline-flex items-center justify-center rounded-xl shrink-0" style={{ width: 44, height: 44, background: "#EEF3F1" }}>
              <FileIcon size={22} stroke="#2F6F73" />
            </span>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <strong className="text-[15px] truncate">{u.fileName}</strong>
              <span className="text-[13px] text-muted">
                {u.pages ? `${u.pages} page${u.pages === 1 ? "" : "s"} · ` : ""}read in {Math.max(1, Math.round(u.readMs / 1000))} seconds · {languageLabel(u.detectedLanguage)}
              </span>
            </div>
            <button type="button" className="btn-secondary" style={{ padding: "10px 14px", fontSize: 13 }} onClick={() => inputRef.current?.click()}>
              Replace
            </button>
          </div>

          <div className="card flex flex-col gap-4 anim-fade-up" style={{ padding: 22, animationDelay: "0.1s" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="m-0 text-[17px] font-bold">What I understood</h2>
              {u.lastUpdatedLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full text-xs font-bold" style={{ padding: "6px 10px", background: "#FBF1EA", color: "#9A4A26" }}>
                  Last updated {u.lastUpdatedLabel}
                  {u.gapLabel ? ` · ${u.gapLabel}` : ""}
                </span>
              )}
            </div>
            <ol className="list-none m-0 p-0 flex flex-col">
              {u.timeline.map((t, i) => (
                <li key={i} className="flex gap-3.5 py-2.5" style={{ borderBottom: i < u.timeline.length - 1 ? "1px solid #F0EDE6" : undefined }}>
                  <span className="shrink-0 text-[13px] font-bold text-teal" style={{ flex: "0 0 110px" }}>
                    {t.period}
                  </span>
                  <span className="text-sm leading-[1.5]" dangerouslySetInnerHTML={{ __html: boldFirst(t.text) }} />
                </li>
              ))}
            </ol>
            <div className="flex gap-3 items-start rounded-[14px]" style={{ padding: "14px 16px", background: "#EEF3F1" }}>
              <Clock size={20} stroke="#2F6F73" />
              <p className="m-0 text-sm leading-[1.5]">{u.note}</p>
            </div>
          </div>

          {fixOpen && (
            <div className="card flex flex-col gap-3 anim-fade-up" style={{ padding: 18, borderColor: "#C9693F" }}>
              <label htmlFor="fix" className="text-[13px] font-bold text-muted">
                What&apos;s off? Tell me plainly — a wrong date, a missing role, a title I misread.
              </label>
              <textarea id="fix" className="textarea" rows={3} value={fixText} onChange={(e) => setFixText(e.target.value)} placeholder="e.g. I left Kestrel in June 2023, not March. And the Business Analyst role was at Meridian Partners." />
              <div className="flex gap-2.5 items-center">
                <button type="button" className="btn-primary" style={{ padding: "10px 18px", fontSize: 14 }} disabled={busy === "fixing"} onClick={sendFix}>
                  {busy === "fixing" ? <Spinner light /> : null} Fix it
                </button>
                <button type="button" className="btn-ghost" onClick={() => setFixOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {skipOpen && (
        <div className="card flex flex-col gap-3 anim-fade-up" style={{ padding: 18 }}>
          <strong className="text-[15px]">No resume? No problem — I just need a name to look you up.</strong>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))" }}>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              Your full name
              <input className="input" style={{ height: 46 }} value={skipName} onChange={(e) => setSkipName(e.target.value)} placeholder="Asha Raman" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              What you do (optional)
              <input className="input" style={{ height: 46 }} value={skipHeadline} onChange={(e) => setSkipHeadline(e.target.value)} placeholder="Head of Product, payments" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              City (optional)
              <input className="input" style={{ height: 46 }} value={skipLocation} onChange={(e) => setSkipLocation(e.target.value)} placeholder="Bengaluru" />
            </label>
          </div>
          <div className="flex gap-2.5 items-center">
            <button type="button" className="btn-primary" style={{ padding: "10px 18px", fontSize: 14 }} disabled={busy === "skipping" || !skipName.trim()} onClick={skip}>
              {busy === "skipping" ? <Spinner light /> : null} Look me up <ArrowRight size={14} />
            </button>
            <button type="button" className="btn-ghost" onClick={() => setSkipOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </StageShell>
  );
}

function boldFirst(text: string): string {
  const esc = text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const m = esc.match(/^([^,—–-]{2,60}?)(,| —| –| -)(.*)$/);
  return m ? `<strong>${m[1]}</strong>${m[2]}${m[3]}` : esc;
}
