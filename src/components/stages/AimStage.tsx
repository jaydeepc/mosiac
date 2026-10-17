"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StageShell } from "@/components/stage/StageShell";
import { PaperPreview } from "@/components/preview/PaperPreview";
import { FunFacts } from "@/components/FunFacts";
import { MicButton, Waveform } from "@/components/voice/MicButton";
import { ArrowRight, Sparkle, Spinner } from "@/components/Icons";
import { api, formatDuration, useProject } from "@/lib/client";
import { useRecorder } from "@/lib/recorder";
import type { ProjectJSON } from "@/lib/types";

const SHAPES = [
  { id: "leader", label: "Leader", text: "Scope, teams, outcomes first. Tools last." },
  { id: "builder", label: "Builder", text: "What you shipped, with what, and the stack." },
  { id: "specialist", label: "Specialist", text: "Depth, certifications, methods, precision." },
] as const;

export function AimStage({ initial }: { initial: ProjectJSON }) {
  const router = useRouter();
  const { project, setProject } = useProject(initial.id, initial);
  const p = project ?? initial;
  const [role, setRole] = useState(p.targetRole ?? "");
  const [shape, setShape] = useState<"leader" | "builder" | "specialist">(p.shape ?? p.understanding?.track ?? "leader");
  const [jdOpen, setJdOpen] = useState(Boolean(p.jobDescription));
  const [jd, setJd] = useState(p.jobDescription ?? "");
  const [loading, setLoading] = useState(!p.roleSuggestions?.length);
  const [aiming, setAiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quick, setQuick] = useState<{ prompt: string; text: string; busy: boolean } | null>(null);
  const aimedFor = useRef<string | null>(p.insights?.length ? `${p.targetRole}|${p.jobDescription ?? ""}` : null);

  useEffect(() => {
    if (p.roleSuggestions?.length) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/aim`, { method: "POST", json: {} });
        if (!alive) return;
        setProject(project);
        setRole((r) => r || project.targetRole || "");
        setShape(project.shape ?? "leader");
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aim = useCallback(
    async (targetRole: string, jobDescription?: string) => {
      if (!targetRole.trim()) return;
      const key = `${targetRole.trim()}|${jobDescription ?? ""}`;
      if (aimedFor.current === key && p.insights?.length) return;
      setAiming(true);
      setError(null);
      try {
        const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/aim`, { method: "POST", json: { role: targetRole.trim(), jobDescription: jobDescription?.trim() || undefined, shape } });
        setProject(project);
        aimedFor.current = key;
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setAiming(false);
      }
    },
    [p.id, p.insights?.length, setProject, shape],
  );

  // auto-aim once a default role exists and no insights yet
  useEffect(() => {
    if (!loading && role && !p.insights?.length && !aiming) void aim(role, jd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // quick 30-second answer (voice or text) for the "warn" insight
  const segs = useRef<string[]>([]);
  const rec = useRecorder({
    onChunk: async (wav) => {
      try {
        const t = await api<{ text: string; translation?: string; empty: boolean }>(`/api/transcribe`, { method: "POST", json: { audio: wav, hintLanguage: p.language, context: quick?.prompt } });
        if (!t.empty) {
          segs.current.push(t.translation || t.text);
          setQuick((q) => (q ? { ...q, text: segs.current.join(" ") } : q));
        }
      } catch {
        /* ignore */
      }
    },
    language: p.language,
  });

  async function sendQuick() {
    if (!quick) return;
    if (rec.recording) rec.stop();
    setQuick({ ...quick, busy: true });
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const text = quick.text.trim() || segs.current.join(" ").trim();
      if (text.length < 3) throw new Error("I didn't catch anything.");
      await api(`/api/projects/${p.id}/answer`, { method: "POST", json: { freeform: true, text: `${quick.prompt}\n\nAnswer: ${text}` } });
      aimedFor.current = null;
      setQuick(null);
      segs.current = [];
      await aim(role, jd);
    } catch (e) {
      setError((e as Error).message);
      setQuick((q) => (q ? { ...q, busy: false } : q));
    }
  }

  const insights = p.insights ?? [];

  return (
    <StageShell
      project={p}
      stage={5}
      title="Which role is this for?"
      intro="Now that I know your story, I can aim it. Pick a suggestion, type your own, or paste a job description."
      aside={<PaperPreview project={p} stage={5} />}
      asideStatus={
        p.targetRole && insights.length ? (
          <span className="inline-flex items-center gap-1.5 rounded-full text-xs font-bold" style={{ padding: "4px 10px", background: "#EEF3F1", color: "#2F6F73" }}>
            Aimed at {p.targetRole}
          </span>
        ) : aiming ? (
          "Writing the summary…"
        ) : undefined
      }
      footer={
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={!role.trim() || aiming}
            onClick={async () => {
              await aim(role, jd);
              await api(`/api/projects/${p.id}`, { method: "PATCH", json: { shape, stage: 6 } });
              router.push(`/m/${p.id}/look`);
            }}
          >
            {aiming ? <Spinner light /> : null} Aim it here <ArrowRight size={16} />
          </button>
          <span className="text-sm text-muted">You can make a second version for another role later.</span>
        </>
      }
    >
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <label htmlFor="role" className="text-[13px] font-bold text-muted">
          Target role
        </label>
        <input
          id="role"
          className="input"
          style={{ borderRadius: 14, height: 52, fontSize: 16, fontWeight: 600, borderWidth: 2, borderColor: role ? "#2F6F73" : "#E6E2DA" }}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onBlur={() => role.trim() && aim(role, jd)}
          onKeyDown={(e) => e.key === "Enter" && aim(role, jd)}
          placeholder={loading ? "Thinking about where your story points…" : "e.g. VP Product — fintech, India"}
        />
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted">From your evidence:</span>
          {loading && <Spinner size={14} />}
          {(p.roleSuggestions ?? []).map((s) => {
            const on = role.trim().toLowerCase() === s.toLowerCase() || role.toLowerCase().startsWith(s.toLowerCase().split(",")[0]);
            return (
              <button key={s} type="button" className="rounded-full text-[13px] font-semibold" style={{ padding: "8px 12px", border: `1px solid ${on ? "#2F6F73" : "#E6E2DA"}`, background: on ? "#EEF3F1" : "#FFF", color: on ? "#2F6F73" : "#1E2430", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => {
                setRole(s);
                void aim(s, jd);
              }}>
                {s}
              </button>
            );
          })}
          <button type="button" className="rounded-full text-[13px] font-semibold text-muted" style={{ padding: "8px 12px", border: "1px dashed #D9D5CC", background: "transparent", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => setJdOpen((v) => !v)}>
            {jdOpen ? "Hide job description" : "Paste a job description"}
          </button>
        </div>
        {jdOpen && (
          <div className="flex flex-col gap-2 anim-fade-up">
            <textarea className="textarea" rows={6} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the posting. I'll use its must-haves and language when aiming — without copying it." />
            <div>
              <button type="button" className="btn-secondary" style={{ padding: "9px 14px", fontSize: 13 }} disabled={aiming || !role.trim()} onClick={() => aim(role, jd)}>
                {aiming ? <Spinner size={14} /> : <Sparkle size={14} stroke="#C9693F" />} Re-aim with this posting
              </button>
            </div>
          </div>
        )}
      </div>

      <fieldset className="m-0 card flex flex-col gap-3" style={{ padding: "18px 20px" }}>
        <legend className="px-1.5 text-[13px] font-bold text-muted">How the story should read</legend>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))" }}>
          {SHAPES.map((s) => {
            const on = shape === s.id;
            return (
              <label key={s.id} className="flex flex-col gap-1 rounded-xl cursor-pointer" style={{ padding: "12px 14px", border: on ? "2px solid #2F6F73" : "1px solid #E6E2DA", background: on ? "#EEF3F1" : "#FFF" }}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="shape" checked={on} onChange={() => setShape(s.id)} style={{ accentColor: "#2F6F73", width: 18, height: 18, margin: 0 }} />
                  <strong className="text-sm">{s.label}</strong>
                </span>
                <span className="text-xs text-muted leading-[1.4]">{s.text}</span>
              </label>
            );
          })}
        </div>
        <p className="m-0 text-[13px] text-muted">
          {p.shapeReason || (
            <>
              I chose <strong>{SHAPES.find((s) => s.id === (p.shape ?? shape))?.label}</strong> from your last resume and the role.
            </>
          )}{" "}
          Change it any time.
        </p>
      </fieldset>

      {(aiming || insights.length > 0) && (
        <div className="card flex flex-col gap-3 anim-fade-up" style={{ padding: 20 }}>
          <h2 className="m-0 text-[15px] font-bold flex items-center gap-2">
            <Sparkle size={18} stroke="#C9693F" />
            {aiming ? "Looking at your story for this role…" : `Three things I noticed for a ${p.targetRole ?? role} role`}
          </h2>
          {aiming && !insights.length && <FunFacts topic="crafting" />}
          {!aiming && (
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              {insights.map((i) => (
                <li key={i.n} className="flex gap-3 text-sm leading-[1.5]">
                  <span className="shrink-0 inline-flex items-center justify-center rounded-full text-xs font-bold" style={{ width: 24, height: 24, background: i.tone === "warn" ? "#FBF1EA" : "#EEF3F1", color: i.tone === "warn" ? "#9A4A26" : "#2F6F73" }}>
                    {i.n}
                  </span>
                  <span>
                    <strong>{i.title}</strong> {i.text}
                    {i.askPrompt && !quick && (
                      <>
                        {" "}
                        —{" "}
                        <button type="button" className="link-btn" onClick={() => setQuick({ prompt: i.askPrompt!, text: "", busy: false })}>
                          tell me in 30 seconds
                        </button>{" "}
                        or leave it out.
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {quick && (
            <div className="rounded-[14px] flex flex-col gap-3 anim-fade-up" style={{ padding: 16, background: "#FBF1EA", border: "1px solid #F0D9C8" }}>
              <p className="m-0 font-display text-[18px] leading-[1.3]">{quick.prompt}</p>
              <div className="flex items-center gap-4">
                <MicButton size={56} recording={rec.recording} onClick={() => (rec.recording ? rec.stop() : (segs.current = [], void rec.start()))} />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold">{rec.recording ? `Listening… ${formatDuration(rec.seconds)}` : "Speak or type below"}</span>
                  <Waveform level={rec.level} active={rec.recording} bars={10} height={22} />
                </div>
              </div>
              <textarea className="textarea" rows={2} value={quick.text} onChange={(e) => setQuick({ ...quick, text: e.target.value })} placeholder="e.g. I owned a ₹40 crore annual budget and set pricing for the SME tier." />
              <div className="flex gap-2 items-center">
                <button type="button" className="btn-primary" style={{ padding: "9px 16px", fontSize: 13 }} disabled={quick.busy} onClick={sendQuick}>
                  {quick.busy ? <Spinner light size={14} /> : null} Add it
                </button>
                <button type="button" className="btn-ghost" onClick={() => { if (rec.recording) rec.stop(); setQuick(null); }}>
                  Leave it out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </StageShell>
  );
}
