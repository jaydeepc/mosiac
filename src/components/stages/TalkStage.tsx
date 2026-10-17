"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/components/nav/NavProgress";
import { StageShell } from "@/components/stage/StageShell";
import { PaperPreview } from "@/components/preview/PaperPreview";
import { FunFacts } from "@/components/FunFacts";
import { MicButton, Waveform } from "@/components/voice/MicButton";
import { ArrowRight, CheckDot, Pencil, Spinner, Plus } from "@/components/Icons";
import { api, formatDuration, useProject } from "@/lib/client";
import { useRecorder } from "@/lib/recorder";
import { languageLabel } from "@/lib/config";
import type { ProjectJSON, Question } from "@/lib/types";

interface Segment {
  text: string;
  language: string;
  languageName: string;
  translation?: string;
}

export function TalkStage({ initial }: { initial: ProjectJSON }) {
  const { go, pending: navPending } = useNavigate();
  const { project, setProject, refresh } = useProject(initial.id, initial);
  const p = project ?? initial;
  const [loadingQ, setLoadingQ] = useState(!initial.questions.length);
  const [error, setError] = useState<string | null>(null);
  const [localized, setLocalized] = useState(p.language !== "en");
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [pendingChunks, setPendingChunks] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [lastChange, setLastChange] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const segmentsRef = useRef<Segment[]>([]);
  const liveTimer = useRef<number | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const open = useMemo(() => p.questions.filter((q) => q.status === "open"), [p.questions]);
  const answered = useMemo(() => p.questions.filter((q) => q.status !== "open"), [p.questions]);
  const current: Question | undefined = (activeId ? p.questions.find((q) => q.id === activeId) : undefined) ?? open[0];
  const totalPlanned = Math.max(p.understanding?.questionBudget ?? 4, p.questions.length);
  const qIndex = current ? p.questions.findIndex((q) => q.id === current.id) + 1 : p.questions.length;

  // load the interview plan
  useEffect(() => {
    if (p.questions.length) {
      setLoadingQ(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/questions`, { method: "POST", json: {} });
        if (alive) setProject(project);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoadingQ(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transcript = segments.map((s) => s.text).join(" ");
  const detected = segments.length ? segments[segments.length - 1] : null;

  const scheduleLive = useCallback(
    (text: string) => {
      if (!current) return;
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
      liveTimer.current = window.setTimeout(async () => {
        try {
          const { liveDraft } = await api<{ liveDraft: string }>(`/api/projects/${p.id}/answer`, { method: "POST", json: { questionId: current.id, partial: true, text } });
          setProject((prev) => (prev ? { ...prev, liveDraft } : prev));
        } catch {
          /* cosmetic */
        }
      }, 900);
    },
    [current, p.id, setProject],
  );

  const onChunk = useCallback(
    (wav: string, seconds: number) => {
      void seconds;
      setPendingChunks((n) => n + 1);
      queueRef.current = queueRef.current.then(async () => {
        try {
          const t = await api<Segment & { empty: boolean }>(`/api/transcribe`, { method: "POST", json: { audio: wav, hintLanguage: p.language, targetLanguage: "en", context: current?.text } });
          if (!t.empty && t.text) {
            segmentsRef.current = [...segmentsRef.current, { text: t.text, language: t.language, languageName: t.languageName, translation: t.translation }];
            setSegments(segmentsRef.current);
            scheduleLive(segmentsRef.current.map((s) => s.translation || s.text).join(" "));
          }
        } catch (e) {
          setError(`Transcription hiccup: ${(e as Error).message}`);
        } finally {
          setPendingChunks((n) => Math.max(0, n - 1));
        }
      });
    },
    [current?.text, p.language, scheduleLive],
  );

  const rec = useRecorder({ onChunk, chunkSeconds: 12, minChunkSeconds: 4, language: p.language === "en" ? "en-IN" : p.language });

  function startAnswer() {
    setError(null);
    segmentsRef.current = [];
    setSegments([]);
    setLastChange(null);
    void rec.start();
  }

  async function finishAnswer(skip = false) {
    if (!current) return;
    if (rec.recording) rec.stop();
    setSubmitting(true);
    setError(null);
    try {
      // wait for in-flight transcription
      await queueRef.current;
      const segs = segmentsRef.current;
      const text = typing ? typed.trim() : segs.map((s) => s.text).join(" ").trim();
      const translation = segs.map((s) => s.translation || s.text).join(" ").trim();
      const language = typing ? undefined : segs[segs.length - 1]?.languageName;
      const { project, summaryOfChange } = await api<{ project: ProjectJSON; summaryOfChange: string }>(`/api/projects/${p.id}/answer`, {
        method: "POST",
        json: { questionId: current.id, text, translation: translation !== text ? translation : undefined, language, durationSec: rec.seconds, skip },
      });
      setProject(project);
      setLastChange(skip ? null : summaryOfChange);
      setTyped("");
      setTyping(false);
      segmentsRef.current = [];
      setSegments([]);
      setActiveId(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function addMore() {
    setLoadingQ(true);
    try {
      const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/questions`, { method: "POST", json: { more: true } });
      setProject(project);
    } finally {
      setLoadingQ(false);
    }
  }

  async function freeform() {
    const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}`, { method: "PATCH", json: { questions: [...p.questions, { id: `q${Date.now().toString(36)}`, text: "Anything else you want in your Mosaic? A role, a win, a number I haven't asked about.", status: "open" }] } });
    setProject(project);
    setActiveId(project.questions[project.questions.length - 1].id);
  }

  const gap = p.understanding?.lastUpdatedLabel ? `only about ${p.understanding.lastUpdatedLabel} onwards` : "about your work, most recent first";
  const questionText = current ? (localized && current.textLocalized ? current.textLocalized : current.text) : "";

  return (
    <StageShell
      project={p}
      stage={4}
      title="Tell me about the years in between"
      intro={`Just talk. Any language, any order, as rough as you like — I'll tidy it. About ${p.understanding?.questionBudget ?? 4} questions, ${gap}.`}
      aside={<PaperPreview project={p} stage={4} />}
      asideStatus={
        rec.recording || pendingChunks > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal anim-pulse-ring" style={{ animationDuration: "1.2s" }} />
            Writing as you speak
          </span>
        ) : lastChange ? (
          lastChange
        ) : undefined
      }
      asideAccent
      footer={
        <>
          <button type="button" className="btn-primary" disabled={rec.recording || submitting || navPending} onClick={async () => {
            await api(`/api/projects/${p.id}`, { method: "PATCH", json: { stage: 5 } });
            go(`/m/${p.id}/aim`);
          }}>
            {navPending ? <Spinner light /> : null} Done answering <ArrowRight size={16} />
          </button>
          <span className="text-sm text-muted">You can always come back and add more.</span>
        </>
      }
    >
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>
          {error}
        </p>
      )}

      {/* answered so far */}
      {answered.map((q) => (
        <div key={q.id} className="flex gap-2.5 items-center card anim-fade-up" style={{ padding: "12px 16px", borderRadius: 14, opacity: 0.85 }}>
          {q.status === "answered" ? <CheckDot /> : <span className="inline-flex items-center justify-center rounded-full text-[11px] font-extrabold" style={{ width: 22, height: 22, background: "#F0EDE6", color: "#5B6472" }}>–</span>}
          <span className="text-sm flex-1 min-w-0 truncate">
            <strong>{p.questions.indexOf(q) + 1} ·</strong> {q.text} — {q.status === "answered" ? `answered${q.durationSec ? `, ${formatDuration(q.durationSec)}` : ""}${q.answerLanguage ? ` in ${q.answerLanguage}` : ""}` : "skipped"}
          </span>
          <button
            type="button"
            className="btn-ghost text-teal text-[13px] inline-flex items-center gap-1"
            onClick={async () => {
              const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}`, { method: "PATCH", json: { questions: p.questions.map((x) => (x.id === q.id ? { ...x, status: "open" } : x)) } });
              setProject(project);
              setActiveId(q.id);
              if (q.answerText) {
                setTyped(q.answerText);
                setTyping(true);
              }
            }}
          >
            <Pencil size={13} /> {q.status === "answered" ? "Edit" : "Answer"}
          </button>
        </div>
      ))}

      {loadingQ && !current && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 card" style={{ padding: "12px 16px", borderRadius: 14 }}>
            <Spinner />
            <span className="text-sm">Planning what to ask — only about what has changed since your last resume…</span>
          </div>
          <FunFacts topic="listening" />
        </div>
      )}

      {current && (
        <div className="card flex flex-col gap-[18px] anim-fade-up" style={{ padding: 24, borderRadius: 20 }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="eyebrow" style={{ fontSize: 12, letterSpacing: "0.08em" }}>
              Question {qIndex} of about {totalPlanned}
            </span>
            {current.textLocalized && current.textLocalized !== current.text && (
              <button type="button" className="pill" style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer" }} onClick={() => setLocalized((v) => !v)}>
                Ask me in {localized ? "English" : languageLabel(p.language)} instead
              </button>
            )}
          </div>
          <p className="m-0 font-display text-[26px] leading-[1.3]" style={{ textWrap: "pretty" }} lang={localized ? p.language : "en"}>
            {questionText}
          </p>
          {current.why && <p className="m-0 -mt-2 text-[13px] text-muted">Why I&apos;m asking: {current.why}</p>}

          {!typing && (
            <div className="flex items-center gap-6 py-2">
              <MicButton recording={rec.recording} onClick={() => (rec.recording ? finishAnswer(false) : startAnswer())} />
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {rec.recording ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-terracotta" />
                      <strong className="text-sm">Listening…{detected ? ` detected ${detected.languageName}` : ""}</strong>
                      <span className="text-[13px] text-muted">{formatDuration(rec.seconds)}</span>
                    </>
                  ) : submitting || pendingChunks > 0 ? (
                    <>
                      <Spinner size={14} />
                      <strong className="text-sm">{submitting ? "Placing it in your Mosaic…" : "Catching up on the last few seconds…"}</strong>
                    </>
                  ) : (
                    <strong className="text-sm text-muted">Tap the mic and talk. Tap again when you&apos;re done.</strong>
                  )}
                </div>
                <Waveform level={rec.level} active={rec.recording} />
              </div>
            </div>
          )}

          {rec.error && <p className="m-0 text-[13px] font-semibold" style={{ color: "#9A4A26" }}>{rec.error}</p>}

          {(segments.length > 0 || rec.interim) && !typing && (
            <div className="rounded-[14px] flex flex-col gap-1.5" style={{ padding: "14px 16px", background: "#F7F5EF" }}>
              <p className="m-0 text-[15px] leading-[1.6]" lang={detected?.language}>
                {transcript}
                {rec.recording && rec.interim && <span className="text-muted"> {rec.interim.slice(-120)}…</span>}
              </p>
              {segments.some((s) => s.translation) && (
                <p className="m-0 text-[13px] text-muted leading-[1.5]">
                  <em>{segments.map((s) => s.translation || s.text).join(" ")}</em>
                </p>
              )}
            </div>
          )}

          {typing && (
            <div className="flex flex-col gap-2">
              <label htmlFor="typed" className="sr-only">
                Your answer
              </label>
              <textarea id="typed" className="textarea" rows={5} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type in any language. Rough notes are fine." autoFocus />
            </div>
          )}

          <div className="flex gap-2.5 flex-wrap items-center">
            {typing ? (
              <>
                <button type="button" className="btn-primary" style={{ padding: "10px 16px", fontSize: 13 }} disabled={submitting || typed.trim().length < 3} onClick={() => finishAnswer(false)}>
                  {submitting ? <Spinner light size={14} /> : null} Save answer
                </button>
                <button type="button" className="btn-secondary" style={{ padding: "10px 16px", fontSize: 13 }} onClick={() => setTyping(false)}>
                  Speak instead
                </button>
              </>
            ) : (
              <button type="button" className="btn-secondary" style={{ padding: "10px 16px", fontSize: 13 }} disabled={rec.recording} onClick={() => setTyping(true)}>
                Type instead
              </button>
            )}
            <button type="button" className="btn-secondary" style={{ padding: "10px 16px", fontSize: 13 }} disabled={submitting} onClick={() => finishAnswer(true)}>
              Skip this question
            </button>
            <span className="ml-auto text-[13px] text-muted">Numbers help: team size, volume, what went up or down.</span>
          </div>
        </div>
      )}

      {!current && !loadingQ && (
        <div className="card flex flex-col gap-3 anim-fade-up" style={{ padding: 22 }}>
          <strong className="text-[15px]">That covers what I needed to ask.</strong>
          <p className="m-0 text-sm text-muted leading-[1.5]">{lastChange ?? "Everything you said has been placed in your Mosaic on the right."} Add anything I missed, or move on to aim it at a role.</p>
          <div className="flex gap-2.5 flex-wrap">
            <button type="button" className="btn-secondary" style={{ padding: "10px 16px", fontSize: 13 }} onClick={freeform}>
              <Plus size={14} /> Add something I missed
            </button>
            <button type="button" className="btn-secondary" style={{ padding: "10px 16px", fontSize: 13 }} disabled={loadingQ} onClick={addMore}>
              {loadingQ ? <Spinner size={14} /> : null} Ask me a couple more
            </button>
          </div>
        </div>
      )}

      {rec.recording && <FunFacts topic="listening" intervalMs={9000} />}
      {!rec.recording && current && <p className="m-0 text-[13px] text-muted">Talk for as long as you like — an hour is fine. I transcribe as you go and keep placing pieces on the right.</p>}
      <button type="button" className="sr-only" onClick={() => refresh()}>
        refresh
      </button>
    </StageShell>
  );
}
