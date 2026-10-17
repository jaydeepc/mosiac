"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@/components/nav/NavProgress";
import { StageShell } from "@/components/stage/StageShell";
import { PaperPreview } from "@/components/preview/PaperPreview";
import { FunFacts } from "@/components/FunFacts";
import { ArrowRight, CheckDot, Spinner } from "@/components/Icons";
import { api, sseStream, useProject } from "@/lib/client";
import type { Extraction, Profile, ProjectJSON } from "@/lib/types";

export function ReadingStage({ initial }: { initial: ProjectJSON }) {
  const { go, pending: navPending } = useNavigate();
  const { project, setProject, refresh } = useProject(initial.id, initial);
  const p = project ?? initial;
  const [status, setStatus] = useState<{ done: number; total: number; current?: string; line?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (p.readingStatus === "done" && p.extractions.every((e) => e.status === "done" || e.status === "failed") && p.extractions.length) {
      setPlaced(p.extractions.reduce((n, e) => n + e.took.length, 0));
      return;
    }
    setRunning(true);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    const abort = sseStream(`/api/projects/${p.id}/read`, {}, (ev, data) => {
      const d = data as Record<string, unknown>;
      if (ev === "queue") {
        setProject((prev) => (prev ? { ...prev, extractions: d.extractions as Extraction[], readingStatus: "running" } : prev));
        setStatus({ done: 0, total: d.total as number });
      } else if (ev === "reading") {
        setStatus({ done: d.done as number, total: d.total as number, current: d.title as string, line: d.line as string | undefined });
        setProject((prev) => (prev ? { ...prev, extractions: prev.extractions.map((e) => (e.candidateId === d.candidateId ? { ...e, status: "reading" } : e)) } : prev));
      } else if (ev === "read") {
        const ex = d.extraction as Extraction;
        setProject((prev) => (prev ? { ...prev, extractions: prev.extractions.map((e) => (e.candidateId === ex.candidateId ? ex : e)), profile: (d.profile as Profile) ?? prev.profile } : prev));
        setStatus({ done: d.done as number, total: d.total as number });
      } else if (ev === "finished") {
        setPlaced(d.placed as number);
      } else if (ev === "error") {
        setError((d as { message: string }).message);
      } else if (ev === "done") {
        setRunning(false);
        clearInterval(timer);
        void refresh();
      }
    });
    return () => {
      abort();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function includeAnyway(ex: Extraction) {
    const extractions = p.extractions.map((e) => (e.candidateId === ex.candidateId ? { ...e, useAnyway: true } : e));
    const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}`, { method: "PATCH", json: { extractions } });
    setProject(project);
    // fold the page back in as freeform evidence
    await api(`/api/projects/${p.id}/answer`, { method: "POST", json: { freeform: true, text: `Please include this source even though you left it out: ${ex.title}. ${ex.note ?? ""} ${ex.leftOut.map((l) => l.text).join("; ")}` } });
    void refresh();
  }

  const seniority = p.understanding?.seniority ? `a ${p.understanding.seniority}'s resume` : "your resume";
  const current = p.extractions.find((e) => e.status === "reading");

  return (
    <StageShell
      project={p}
      stage={3}
      statusOverride="Stage 3 of 8 · reading"
      mobileLabel="Reading"
      title="Reading what you ticked"
      intro={`I open each page you confirmed and keep only what belongs in ${seniority}. Everything I take or leave is listed here — nothing is force‑fitted.`}
      aside={<PaperPreview project={p} stage={3} />}
      asideStatus={placed !== null ? `${placed} piece${placed === 1 ? "" : "s"} placed from the web` : running ? "Placing pieces as I read…" : undefined}
      asideAccent
      sectionFlex="1 1 560px"
      asideFlex="1 1 440px"
      sectionGap={18}
      backHref={`/m/${p.id}/identity`}
      footer={
        <>
          <button type="button" className="btn-primary" disabled={running || navPending} onClick={() => go(`/m/${p.id}/talk`)}>
            {navPending ? <Spinner light /> : null} Looks right, let&apos;s talk <ArrowRight size={16} />
          </button>
          <button type="button" className="btn-secondary" onClick={() => go(`/m/${p.id}/identity`)}>
            Change my ticks
          </button>
        </>
      }
    >
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>
          {error}
        </p>
      )}

      {running && (
        <div className="flex items-center gap-3 card" style={{ padding: "12px 16px", borderRadius: 14 }}>
          <Spinner />
          <span className="text-sm">
            <strong>
              {status?.done ?? 0} of {status?.total ?? p.extractions.length} pages read
            </strong>
            {current ? ` · ${status?.line ?? `now reading ${current.title.toLowerCase()}…`}` : " · opening the first page…"}
          </span>
          <span className="ml-auto text-xs text-muted">{elapsed} s</span>
        </div>
      )}
      {!running && p.extractions.length === 0 && <div className="card text-sm text-muted" style={{ padding: 16 }}>Nothing was ticked. Go back and tick a page, or carry on to talk.</div>}

      <ol className="list-none m-0 p-0 flex flex-col gap-3">
        {p.extractions.map((ex) => (
          <li key={ex.candidateId} className="card flex flex-col gap-2.5 anim-fade-up" style={{ padding: "16px 18px", borderRadius: 16, opacity: ex.status === "pending" ? 0.7 : 1 }}>
            <div className="flex items-center gap-2.5">
              {ex.status === "done" ? <CheckDot /> : ex.status === "failed" ? <span className="inline-flex items-center justify-center rounded-full text-white text-xs font-extrabold" style={{ width: 22, height: 22, background: "#C9693F" }}>!</span> : ex.status === "reading" ? <Spinner size={22} /> : <span className="rounded-full" style={{ width: 22, height: 22, border: "2px dashed #D9D5CC" }} />}
              <strong className="text-sm">{ex.title}</strong>
              <span className="ml-auto text-xs text-muted">
                {ex.status === "done" ? `${ex.readMs ? `read in ${Math.max(1, Math.round(ex.readMs / 1000))} s · ` : ""}${ex.took.length ? `${ex.took.length} piece${ex.took.length === 1 ? "" : "s"} taken` : "nothing taken"}${ex.leftOut.length ? ` · ${ex.leftOut.length} left out` : ""}${ex.willAsk.length ? ` · ${ex.willAsk.length} to confirm` : ""}` : ex.status === "reading" ? "reading…" : ex.status === "failed" ? "couldn't open" : "queued"}
              </span>
            </div>

            {ex.status === "done" && (ex.took.length > 0 || ex.leftOut.length > 0 || ex.willAsk.length > 0) && (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}>
                {ex.took.length > 0 && (
                  <div className="rounded-xl flex flex-col gap-1.5" style={{ padding: "10px 12px", background: "#EEF3F1" }}>
                    <span className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.08em" }}>
                      Took
                    </span>
                    <ul className="m-0 pl-4 text-[13px] leading-[1.5] flex flex-col gap-0.5">
                      {ex.took.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {ex.leftOut.length > 0 && (
                  <div className="rounded-xl flex flex-col gap-1.5" style={{ padding: "10px 12px", background: "#F7F5EF" }}>
                    <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Left out</span>
                    <ul className="m-0 pl-4 text-[13px] leading-[1.5] text-muted flex flex-col gap-0.5">
                      {ex.leftOut.map((l, i) => (
                        <li key={i}>
                          {l.text} — {l.why.replace(/^(not|no)\b/i, (m) => m.toLowerCase())}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ex.willAsk.length > 0 && (
                  <div className="rounded-xl flex flex-col gap-1.5" style={{ padding: "10px 12px", background: "#FBF1EA" }}>
                    <span className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: "#9A4A26" }}>
                      Will ask you first
                    </span>
                    <ul className="m-0 pl-4 text-[13px] leading-[1.5] flex flex-col gap-0.5">
                      {ex.willAsk.map((w, i) => (
                        <li key={i}>{w} — I&apos;ll check this with you in stage 4 before using it</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {(ex.status === "done" && ex.took.length === 0 && ex.note) || ex.status === "failed" ? (
              <div className="rounded-xl flex flex-col gap-1.5" style={{ padding: "10px 12px", background: "#F7F5EF" }}>
                <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">{ex.status === "failed" ? "Couldn't read" : "Left out — and why"}</span>
                <p className="m-0 text-[13px] leading-[1.5] text-muted">
                  {ex.note}{" "}
                  {ex.status === "done" && !ex.useAnyway && (
                    <button type="button" className="link-btn" onClick={() => includeAnyway(ex)}>
                      Use anyway
                    </button>
                  )}
                  {ex.useAnyway && <em>— included at your request</em>}
                </p>
              </div>
            ) : null}

            {ex.followed && ex.followed.length > 0 && (
              <div className="text-xs text-muted">
                Also opened {ex.followed.length} linked page{ex.followed.length === 1 ? "" : "s"}:{" "}
                {ex.followed.map((f, i) => (
                  <span key={f.url}>
                    <a href={f.url} target="_blank" rel="noreferrer">{f.title || f.url}</a>
                    {i < ex.followed!.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            )}
            {ex.status === "reading" && <div className="rounded-xl text-[13px] leading-[1.5] text-muted" style={{ padding: "10px 12px", background: "#F7F5EF" }}>Opening the page and deciding what fits. If nothing here belongs in {seniority}, I&apos;ll leave it all out and say so — even though you ticked it.</div>}
          </li>
        ))}
      </ol>

      {running && <FunFacts topic="research" />}
    </StageShell>
  );
}
