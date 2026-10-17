"use client";

import Link from "next/link";
import { useNavigate } from "@/components/nav/NavProgress";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wordmark, MosaicMark } from "@/components/Mark";
import { ProgressBars } from "@/components/stage/StageShell";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { ScaledSheet } from "@/components/resume/ScaledSheet";
import { FunFacts } from "@/components/FunFacts";
import { MicButton } from "@/components/voice/MicButton";
import { ArrowLeft, ArrowRight, CheckDot, CommentIcon, Spinner, X } from "@/components/Icons";
import { api, formatDuration, sseStream, useIsMobile, useProject } from "@/lib/client";
import { useRecorder } from "@/lib/recorder";
import { languageLabel } from "@/lib/config";
import type { Comment, ProjectJSON, ResumeDoc } from "@/lib/types";

export function CraftStage({ initial }: { initial: ProjectJSON }) {
  const { go, pending: navPending } = useNavigate();
  const mobile = useIsMobile();
  const { project, setProject, refresh } = useProject(initial.id, initial);
  const p = project ?? initial;
  const [look, setLook] = useState<"visual" | "classic">(p.look);
  const [lang, setLang] = useState<"main" | "second">("main");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(2);
  const [crafting, setCrafting] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"typed" | "spoken">("typed");
  const [mobilePanel, setMobilePanel] = useState<"paper" | "comments">("paper");
  const startedRef = useRef(false);

  const doc: ResumeDoc | undefined = lang === "second" ? p.resumeSecond : p.resume;

  const runCraft = useCallback(
    (opts: { force?: boolean; look?: "visual" | "classic" }) => {
      setCrafting(true);
      setLines([]);
      setError(null);
      return sseStream(`/api/projects/${p.id}/craft`, { force: opts.force, look: opts.look ?? look }, (ev, data) => {
        const d = data as Record<string, unknown>;
        if (ev === "status") setLines((l) => [...l, d.line as string]);
        if (ev === "resume") setProject((prev) => (prev ? { ...prev, resume: d.resume as ResumeDoc, look: (d.resume as ResumeDoc).look } : prev));
        if (ev === "resumeSecond") setProject((prev) => (prev ? { ...prev, resumeSecond: d.resumeSecond as ResumeDoc } : prev));
        if (ev === "art") setProject((prev) => (prev ? { ...prev, infographicArtId: d.artId as string } : prev));
        if (ev === "error") setError((d as { message: string }).message);
        if (ev === "done") {
          setCrafting(false);
          void refresh();
        }
      });
    },
    [p.id, look, refresh, setProject],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const need = !p.resume || p.craftStatus !== "done" || p.resume.look !== p.look || p.resume.language !== p.outputLanguage || (p.secondLanguage && (!p.resumeSecond || p.resumeSecond.language !== p.secondLanguage));
    if (need) {
      const abort = runCraft({});
      return () => abort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchLook(next: "visual" | "classic") {
    if (next === look || crafting) return;
    setLook(next);
    setPage(1);
    runCraft({ look: next, force: true });
  }

  // voice comment
  const segs = useRef<string[]>([]);
  const rec = useRecorder({
    onChunk: async (wav) => {
      try {
        const t = await api<{ text: string; translation?: string; empty: boolean }>(`/api/transcribe`, { method: "POST", json: { audio: wav, hintLanguage: p.language, context: `A comment about the "${target?.label}" section of a resume` } });
        if (!t.empty) {
          segs.current.push(t.translation || t.text);
          setComment(segs.current.join(" "));
        }
      } catch {
        /* ignore */
      }
    },
    language: p.language,
  });

  async function send() {
    if (!target) return;
    if (rec.recording) rec.stop();
    setSending(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, rec.recording ? 1200 : 0));
      const text = comment.trim() || segs.current.join(" ").trim();
      if (text.length < 3) throw new Error("Say or type what you'd change.");
      const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/comments`, { method: "POST", json: { sectionId: target.id, sectionLabel: target.label, text, mode, target: lang } });
      setProject(project);
      setComment("");
      segs.current = [];
      setTarget(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function undo(c: Comment) {
    const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/comments`, { method: "DELETE", json: { commentId: c.id } });
    setProject(project);
  }

  const confirmCount = useMemo(() => {
    if (!doc) return 0;
    let n = doc.confirmations.filter((c) => !c.resolved).length;
    for (const e of doc.experience) for (const b of e.bullets) if (b.confirm) n++;
    for (const c of doc.charts) for (const s of c.series) if (s.confirm) n++;
    return n;
  }, [doc]);

  const pins = useMemo(() => {
    const map: Record<string, React.ReactNode> = {};
    p.comments.forEach((c, i) => {
      if (map[c.sectionId]) return;
      map[c.sectionId] = (
        <span key={c.id} className="absolute inline-flex items-center justify-center rounded-full text-white text-[10px] font-extrabold" style={{ top: -10, left: 12, width: 20, height: 20, background: "#C9693F" }}>
          {p.comments.length - i}
        </span>
      );
    });
    return map;
  }, [p.comments]);

  const photoUrl = p.photoFileId ? `/api/files/${p.photoFileId}` : undefined;
  const backdropUrl = p.infographicArtId ? `/api/art/${p.infographicArtId}` : undefined;

  const paper = doc ? (
    <ScaledSheet page={page} maxWidth={mobile ? 1000 : 640} onMeasure={setPages}>
      <ResumeDocument doc={doc} opts={{ photoUrl, backdropUrl, pins, highlight: target?.id ?? null, interactive: !crafting, onSection: (id, label) => setTarget({ id, label }) }} />
    </ScaledSheet>
  ) : (
    <div className="paper-sheet w-full flex flex-col items-center justify-center gap-4 text-center" style={{ maxWidth: 640, aspectRatio: "794 / 1123", padding: 40 }}>
      <Spinner size={28} />
      <p className="m-0 font-display text-2xl">Crafting your Mosaic…</p>
      <p className="m-0 text-sm text-muted max-w-[360px]">{lines[lines.length - 1] ?? "Reading everything you told me and confirmed…"}</p>
    </div>
  );

  const composer = target && (
    <article className="card flex flex-col gap-2.5 anim-fade-up" style={{ padding: "14px 16px", borderRadius: 16, border: "2px solid #C9693F" }}>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center justify-center rounded-full text-white text-[10px] font-extrabold" style={{ width: 18, height: 18, background: "#C9693F" }}>
          {p.comments.length + 1}
        </span>
        {target.label}
        <button type="button" aria-label="Cancel" className="btn-ghost ml-auto" onClick={() => { if (rec.recording) rec.stop(); setTarget(null); setComment(""); }}>
          <X size={16} />
        </button>
      </div>
      <label htmlFor="cmt" className="sr-only">
        Your comment
      </label>
      <textarea id="cmt" className="textarea" rows={2} value={comment} onChange={(e) => { setComment(e.target.value); setMode("typed"); }} placeholder="What would you change here?" autoFocus={!mobile} />
      <div className="flex gap-2 items-center">
        <MicButton size={44} recording={rec.recording} onClick={() => { if (rec.recording) rec.stop(); else { segs.current = []; setMode("spoken"); void rec.start(); } }} label="Speak your comment" />
        <span className="text-xs text-muted">{rec.recording ? `Listening… ${formatDuration(rec.seconds)}` : "Tap to speak, in any language"}</span>
        <button type="button" className="ml-auto rounded-full border-0 text-white text-[13px] font-bold" style={{ padding: "10px 16px", background: "#1E2430", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sending ? 0.6 : 1 }} disabled={sending} onClick={send}>
          {sending ? "Rewriting…" : "Send"}
        </button>
      </div>
    </article>
  );

  const commentsList = (
    <div className="flex flex-col gap-3">
      <h2 className="m-0 text-[13px] font-bold tracking-[0.08em] uppercase text-muted">Comments</h2>
      {composer}
      {p.comments.length === 0 && !target && <p className="m-0 text-[13px] text-muted">{mobile ? "Tap any section of the page to comment." : "Click any section on the right and say what you'd change."}</p>}
      {p.comments.map((c, i) => (
        <article key={c.id} className="card flex flex-col gap-2.5 anim-fade-up" style={{ padding: "14px 16px", borderRadius: 16 }}>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center justify-center rounded-full text-white text-[10px] font-extrabold" style={{ width: 18, height: 18, background: "#C9693F" }}>
              {p.comments.length - i}
            </span>
            {c.sectionLabel} · {timeAgo(c.createdAt)} · {c.mode}
          </div>
          <p className="m-0 text-sm leading-[1.5]">&ldquo;{c.text}&rdquo;</p>
          {c.resolution && (
            <div className="flex gap-2.5 items-start rounded-xl" style={{ padding: "10px 12px", background: "#EEF3F1" }}>
              <MosaicMark size={16} className="shrink-0 mt-0.5" />
              <p className="m-0 text-[13px] leading-[1.5]">
                {c.resolution}{" "}
                <button type="button" className="link-btn" onClick={() => undo(c)}>
                  Undo
                </button>
              </p>
            </div>
          )}
        </article>
      ))}
    </div>
  );

  const checks = (
    <ul className="m-0 p-0 list-none flex flex-col gap-2">
      <li className="flex items-center gap-2.5 text-[13px]">
        <CheckDot size={20} /> Fits on two pages{pages > 2 ? " — tightening on export" : ""}
      </li>
      <li className="flex items-center gap-2.5 text-[13px]">
        <CheckDot size={20} /> No clichés, no selling — plain and specific
      </li>
      <li className="flex items-center gap-2.5 text-[13px]">
        {confirmCount ? (
          <span className="inline-flex items-center justify-center rounded-full text-[11px] font-extrabold shrink-0" style={{ width: 20, height: 20, background: "#FBF1EA", color: "#9A4A26" }}>
            {confirmCount}
          </span>
        ) : (
          <CheckDot size={20} />
        )}
        {confirmCount ? `${confirmCount} number${confirmCount === 1 ? "" : "s"} to confirm — marked on the page` : "Every number confirmed"}
      </li>
    </ul>
  );

  const toggles = (
    <>
      <div className="inline-flex border border-line rounded-full overflow-hidden">
        {(["visual", "classic"] as const).map((l) => (
          <button key={l} type="button" onClick={() => switchLook(l)} disabled={crafting} className="border-0 text-[13px]" style={{ padding: "8px 14px", background: look === l ? "#2F6F73" : "#FFF", color: look === l ? "#FFF" : "#1E2430", font: "inherit", fontSize: 13, fontWeight: look === l ? 700 : 600, cursor: "pointer" }}>
            {l === "visual" ? "Visual" : "Classic"}
          </button>
        ))}
      </div>
      {p.secondLanguage && (
        <div className="inline-flex border border-line rounded-full overflow-hidden">
          {(["main", "second"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} className="border-0 text-[13px]" style={{ padding: "8px 14px", background: lang === l ? "#2F6F73" : "#FFF", color: lang === l ? "#FFF" : "#1E2430", font: "inherit", fontSize: 13, fontWeight: lang === l ? 700 : 600, cursor: "pointer" }}>
              {languageLabel(l === "main" ? p.outputLanguage : p.secondLanguage)}
            </button>
          ))}
        </div>
      )}
    </>
  );

  const pageToggle = (
    <div className="inline-flex border border-line rounded-full overflow-hidden bg-white">
      {[1, 2].map((n) => (
        <button key={n} type="button" onClick={() => setPage(n)} className="border-0 text-xs" style={{ padding: "7px 14px", background: page === n ? "#1E2430" : "transparent", color: page === n ? "#FFF" : "#1E2430", font: "inherit", fontSize: 12, fontWeight: page === n ? 700 : 600, cursor: "pointer" }}>
          Page {n}
        </button>
      ))}
    </div>
  );

  const finish = async () => {
    await api(`/api/projects/${p.id}`, { method: "PATCH", json: { stage: 8 } });
    go(`/m/${p.id}/ready`);
  };

  if (mobile) {
    return (
      <div className="min-h-screen bg-paper-2 text-ink flex flex-col">
        <header className="sticky top-0 z-20 flex flex-col gap-3 bg-white border-b border-line" style={{ padding: "14px 20px 12px" }}>
          <div className="flex items-center justify-between gap-2.5">
            <Link href={`/m/${p.id}/look`} aria-label="Back" className="inline-flex items-center justify-center rounded-full text-ink" style={{ width: 44, height: 44 }}>
              <ArrowLeft size={20} />
            </Link>
            <span className="text-sm font-bold">7 of 8 · Craft</span>
            <button type="button" disabled={crafting || !doc || navPending} onClick={finish} className="rounded-full border-0 text-white text-[13px] font-bold" style={{ padding: "8px 14px", background: "#2F6F73", font: "inherit", fontSize: 13, fontWeight: 700 }}>
              Finish
            </button>
          </div>
          <ProgressBars stage={7} flex />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {toggles}
            <span className="text-xs text-muted">Tap a section to comment</span>
            {pageToggle}
          </div>
        </header>
        <main className="flex-1 flex flex-col gap-3" style={{ padding: "16px 16px 0" }}>
          {error && <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>{error}</p>}
          {crafting && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[13px] card" style={{ padding: "10px 12px" }}>
                <Spinner size={16} /> {lines[lines.length - 1] ?? "Crafting…"}
              </div>
              <FunFacts topic="crafting" />
            </div>
          )}
          {mobilePanel === "paper" ? paper : <div className="flex flex-col gap-4">{checks}{commentsList}</div>}
        </main>
        <div className="sticky bottom-0 z-10 bg-white rounded-t-[20px] flex flex-col gap-2.5" style={{ padding: "10px 20px 28px", boxShadow: "0 -12px 32px rgba(30,36,48,0.12)" }}>
          <div aria-hidden="true" className="mx-auto rounded-sm" style={{ width: 40, height: 4, background: "#D9D5CC" }} />
          {target ? (
            composer
          ) : (
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" style={{ fontSize: 13 }} onClick={() => setMobilePanel(mobilePanel === "paper" ? "comments" : "paper")}>
                <CommentIcon size={14} /> {mobilePanel === "paper" ? `Comments${p.comments.length ? ` (${p.comments.length})` : ""}` : "Back to the page"}
              </button>
              <button type="button" className="btn-primary flex-1" style={{ fontSize: 13 }} disabled={crafting || !doc || navPending} onClick={finish}>
                Finish <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="flex items-center justify-between gap-4 flex-wrap bg-white border-b border-line" style={{ padding: "16px 32px" }}>
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-muted">Stage 7 of 8</span>
          <ProgressBars stage={7} />
          <span className="text-[13px] text-muted">Nearly there</span>
        </div>
        <div className="flex items-center gap-2.5">
          {toggles}
          <button type="button" disabled={crafting || !doc || navPending} onClick={finish} className="inline-flex items-center gap-2 rounded-full border-0 text-white text-[13px] font-bold" style={{ padding: "9px 16px", background: "#2F6F73", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: crafting ? 0.6 : 1 }}>
            {navPending ? <Spinner light size={14} /> : null} Finish <ArrowRight size={14} strokeWidth={2.4} />
          </button>
        </div>
      </header>

      <div className="flex flex-wrap flex-1">
        <section aria-labelledby="h-stage" className="min-w-0 flex flex-col gap-[18px] border-r border-line anim-fade-up" style={{ flex: "1 1 360px", maxWidth: 460, padding: 32 }}>
          <div className="flex flex-col gap-1.5">
            <h1 id="h-stage" className="m-0 font-display font-normal text-[34px] tracking-[-0.01em]">
              Make it yours
            </h1>
            <p className="m-0 text-[15px] text-muted leading-[1.5]">Tap any section on the right and say what you&apos;d change. Speak or type — I&apos;ll rewrite just that part.</p>
          </div>
          {error && <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>{error}</p>}
          {crafting ? (
            <div className="flex flex-col gap-2.5">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[13px] anim-fade-up">
                  {i === lines.length - 1 ? <Spinner size={16} /> : <CheckDot size={18} />} {l}
                </div>
              ))}
              {!lines.length && (
                <div className="flex items-center gap-2.5 text-[13px]">
                  <Spinner size={16} /> Starting…
                </div>
              )}
              <FunFacts topic="crafting" />
            </div>
          ) : (
            doc && checks
          )}
          <div style={{ height: 1, background: "#E6E2DA" }} />
          {commentsList}
          <p className="m-0 text-xs text-muted mt-auto">
            Want a different look or a fresh draft?{" "}
            <button type="button" className="link-btn" disabled={crafting} onClick={() => runCraft({ force: true })}>
              Re-craft from scratch
            </button>
          </p>
        </section>

        <section aria-label="Your Mosaic" className="min-w-0 flex flex-col gap-3.5 items-center" style={{ flex: "1 1 560px", padding: "32px 40px", background: "linear-gradient(180deg, #F3F1EA 0%, #FBFAF6 100%)" }}>
          <div className="w-full flex items-center justify-between gap-3" style={{ maxWidth: 640 }}>
            {pageToggle}
            <span className="text-xs text-muted">{pages > 2 ? `Overflowing by ${pages - 2} page — export will tighten the type` : "Hover a section to comment"}</span>
          </div>
          <div className="w-full relative" style={{ maxWidth: 640 }}>
            {paper}
            <div aria-hidden="true" className="absolute anim-float" style={{ "--r": "12deg", right: -16, top: 200, width: 32, height: 32, borderRadius: 8, background: "#9CC3C5" } as React.CSSProperties} />
          </div>
        </section>
      </div>
      <style>{`.resume-section:hover{outline:2px dashed #9CC3C5;outline-offset:-2px;border-radius:10px}`}</style>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}
