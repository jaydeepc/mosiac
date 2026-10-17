"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StageShell } from "@/components/stage/StageShell";
import { PaperPreview } from "@/components/preview/PaperPreview";
import { FunFacts } from "@/components/FunFacts";
import { ArrowRight, Plus, Spinner } from "@/components/Icons";
import { api, useProject } from "@/lib/client";
import type { Candidate, ProjectJSON } from "@/lib/types";

const STRENGTH_PILL: Record<Candidate["strength"], { label: string; bg: string; color: string }> = {
  strong: { label: "Strong match", bg: "#2F6F73", color: "#FFF" },
  possible: { label: "Possible", bg: "#FBF1EA", color: "#9A4A26" },
  unlikely: { label: "Unlikely", bg: "#F0EDE6", color: "#5B6472" },
};
const STRENGTH_TEXT: Record<Candidate["strength"], { label: string; color: string }> = {
  strong: { label: "Strong", color: "#2F6F73" },
  possible: { label: "Possible", color: "#9A4A26" },
  unlikely: { label: "Unlikely", color: "#5B6472" },
};
const AVATARS = ["linear-gradient(135deg, #DCE3F5, #9CC3C5)", "linear-gradient(135deg, #F6E3D3, #E7B99E)", "linear-gradient(135deg, #EEEBE3, #D9D5CC)"];

export function IdentityStage({ initial }: { initial: ProjectJSON }) {
  const router = useRouter();
  const { project, setProject, refresh } = useProject(initial.id, initial);
  const p = project ?? initial;
  const research = p.research;
  const running = !research || research.status === "running" || research.status === "idle";
  const [linkedin, setLinkedin] = useState<string>(p.linkedinChoice ?? "");
  const [selected, setSelected] = useState<Set<string>>(() => new Set((p.research?.candidates ?? []).filter((c) => c.group === "web" && c.selected).map((c) => c.id)));
  const [addOpen, setAddOpen] = useState<null | "linkedin" | "web">(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // poll while research runs
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [running, refresh]);

  // default picks once results arrive
  useEffect(() => {
    if (!research || research.status !== "done") return;
    const li = research.candidates.filter((c) => c.group === "linkedin");
    if (!linkedin && li.length) setLinkedin(li.find((c) => c.strength === "strong")?.id ?? "");
    setSelected((prev) => {
      if (prev.size) return prev;
      return new Set(research.candidates.filter((c) => c.group === "web" && c.selected).map((c) => c.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [research?.status]);

  const liCandidates = useMemo(() => (research?.candidates ?? []).filter((c) => c.group === "linkedin"), [research]);
  const webCandidates = useMemo(() => (research?.candidates ?? []).filter((c) => c.group === "web"), [research]);
  const tickCount = selected.size + (linkedin && linkedin !== "none" ? 1 : 0);

  async function addLink() {
    if (!link.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { project, candidate } = await api<{ project: ProjectJSON; candidate: Candidate }>(`/api/projects/${p.id}/sources`, { method: "POST", json: { url: link.trim() } });
      setProject(project);
      if (candidate.group === "linkedin") setLinkedin(candidate.id);
      else setSelected((s) => new Set([...s, candidate.id]));
      setLink("");
      setAddOpen(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function proceed(skipWeb = false) {
    setBusy(true);
    try {
      if (!skipWeb) {
        await api(`/api/projects/${p.id}/sources`, { method: "PATCH", json: { selectedIds: [...selected], linkedinChoice: linkedin || "none" } });
        router.push(`/m/${p.id}/reading`);
      } else {
        await api(`/api/projects/${p.id}`, { method: "PATCH", json: { stage: 4, linkedinChoice: "none", readingStatus: "done" } });
        router.push(`/m/${p.id}/talk`);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const intro = running
    ? "While you read, I'm searching LinkedIn, conference sites, Medium, GitHub and Scholar for pages that might be you. I only read inside the ones you tick."
    : research?.status === "failed"
      ? "The web search didn't finish. You can try again, paste a link, or skip the web."
      : research?.intro ?? "";

  return (
    <StageShell
      project={p}
      stage={3}
      title="Is this you?"
      intro={
        running ? (
          intro
        ) : (
          <>
            {intro.replace(/\s*—\s*\d+ pages checked.*$/, "")}
            {research && research.pagesChecked > 0 && (
              <>
                {" "}
                —{" "}
                <strong className="text-ink">
                  {research.pagesChecked} pages checked, {research.candidates.length} worth showing
                </strong>
                . Tell me which are yours; I only read inside the ones you tick.
              </>
            )}
          </>
        )
      }
      aside={<PaperPreview project={p} stage={3} />}
      asideStatus={running ? "Searching…" : "Waiting for your ticks"}
      sectionFlex="1 1 560px"
      asideFlex="1 1 440px"
      footer={
        <>
          <button type="button" className="btn-primary" disabled={busy || running || tickCount === 0} onClick={() => proceed(false)}>
            {busy ? <Spinner light /> : null} Read the ticked ones <ArrowRight size={16} />
          </button>
          <span className="text-[13px] text-muted">{tickCount === 0 ? "Tick at least one page, or skip" : `${tickCount} page${tickCount === 1 ? "" : "s"} ticked · I'll show you exactly what I take from each`}</span>
          <button type="button" className="btn-ghost ml-auto" disabled={busy} onClick={() => proceed(true)}>
            Skip the web entirely
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
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 card" style={{ padding: "12px 16px", borderRadius: 14 }}>
            <Spinner />
            <span className="text-sm">
              <strong>Searching the web for {p.profile.name || "you"}…</strong> usually under a minute.
            </span>
          </div>
          <FunFacts topic="research" />
        </div>
      )}

      {research?.status === "failed" && (
        <div className="card flex items-center gap-3 flex-wrap" style={{ padding: "12px 16px", borderColor: "#C9693F" }}>
          <span className="text-sm">Search failed: {research.error ?? "unknown error"}.</span>
          <button type="button" className="btn-secondary" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => api(`/api/projects/${p.id}/research`, { method: "POST", json: { force: true } }).then(() => refresh())}>
            Try again
          </button>
        </div>
      )}

      {!running && (
        <>
          <fieldset className="m-0 card flex flex-col gap-3" style={{ padding: "18px 20px" }}>
            <legend className="px-1.5 text-[13px] font-bold text-muted flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded text-[11px] text-ink" style={{ width: 18, height: 18, background: "#DCE3F5" }}>
                in
              </span>
              {liCandidates.length > 1 ? `LinkedIn — ${liCandidates.length} profiles share your name. Which is you?` : liCandidates.length === 1 ? "LinkedIn — is this your profile?" : "LinkedIn — I couldn't find a profile for you"}
            </legend>
            {liCandidates.length > 0 && (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))" }}>
                {liCandidates.map((c, i) => {
                  const on = linkedin === c.id;
                  const pill = STRENGTH_PILL[c.strength];
                  return (
                    <label key={c.id} className="flex flex-col gap-2 rounded-[14px] cursor-pointer transition-colors" style={{ padding: 14, border: on ? "2px solid #2F6F73" : "1px solid #E6E2DA", background: on ? "#EEF3F1" : "#FFF", opacity: c.strength === "unlikely" && !on ? 0.8 : 1 }}>
                      <span className="flex items-center justify-between gap-2">
                        <input type="radio" name="li" checked={on} onChange={() => setLinkedin(c.id)} style={{ accentColor: "#2F6F73", width: 20, height: 20, margin: 0 }} />
                        <span className="rounded-full text-[11px] font-bold" style={{ padding: "4px 8px", background: pill.bg, color: pill.color }}>
                          {c.addedByUser ? "Added by you" : pill.label}
                        </span>
                      </span>
                      <span className="flex items-center gap-2.5">
                        <span className="rounded-full shrink-0" style={{ width: 36, height: 36, background: AVATARS[i % AVATARS.length] }} />
                        <span className="flex flex-col min-w-0">
                          <strong className="text-sm truncate">{c.title}</strong>
                          <span className="text-xs text-muted truncate">{c.subtitle}</span>
                        </span>
                      </span>
                      <span className="text-xs leading-[1.5]" style={{ color: c.strength === "strong" ? "#1E2430" : "#5B6472" }}>
                        {c.why}
                      </span>
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-xs font-semibold" onClick={(e) => e.stopPropagation()}>
                        Open page ↗
                      </a>
                    </label>
                  );
                })}
              </div>
            )}
            <label className="flex items-center gap-2 text-[13px] text-muted flex-wrap">
              <input type="radio" name="li" checked={linkedin === "none" || (!linkedin && liCandidates.length === 0)} onChange={() => setLinkedin("none")} style={{ accentColor: "#2F6F73", width: 18, height: 18, margin: 0 }} />
              None of these is my LinkedIn —{" "}
              <button type="button" className="link-btn" onClick={() => setAddOpen(addOpen === "linkedin" ? null : "linkedin")}>
                paste my profile link
              </button>
            </label>
            {addOpen === "linkedin" && <AddLink value={link} onChange={setLink} onAdd={addLink} busy={busy} placeholder="https://www.linkedin.com/in/your-name" />}
          </fieldset>

          <fieldset className="m-0 card flex flex-col gap-2.5" style={{ padding: "18px 20px" }}>
            <legend className="px-1.5 text-[13px] font-bold text-muted">Elsewhere on the web — tick all that are yours</legend>
            {webCandidates.length === 0 && <p className="m-0 text-[13px] text-muted">Nothing beyond LinkedIn turned up. Add a link if you have one — a portfolio, a talk, a paper, press.</p>}
            {webCandidates.map((c) => {
              const on = selected.has(c.id);
              const st = STRENGTH_TEXT[c.strength];
              return (
                <label key={c.id} className="flex gap-3 items-start rounded-xl cursor-pointer transition-colors" style={{ padding: "12px 14px", border: on ? "1.5px solid #2F6F73" : "1px solid #E6E2DA", background: "#FFF" }}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      setSelected(next);
                    }}
                    style={{ width: 20, height: 20, margin: "1px 0 0", accentColor: "#2F6F73" }}
                  />
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-muted">
                      {c.kind} · {c.source} ·{" "}
                      <span style={{ color: c.addedByUser ? "#2F6F73" : st.color }}>{c.addedByUser ? "Added by you" : st.label}</span>
                    </span>
                    <strong className="text-sm">{c.title}</strong>
                    <span className="text-xs text-muted">
                      {c.subtitle ? `${c.subtitle} — ` : ""}
                      {c.why.replace(/^Why:\s*/i, "")}
                    </span>
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-xs font-semibold self-start" onClick={(e) => e.stopPropagation()}>
                      Open page ↗
                    </a>
                  </span>
                </label>
              );
            })}
            <button type="button" className="flex items-center gap-2 self-start rounded-full text-[13px] font-semibold text-muted" style={{ padding: "10px 14px", border: "1px dashed #D9D5CC", background: "transparent", font: "inherit", fontSize: 13, fontWeight: 600 }} onClick={() => setAddOpen(addOpen === "web" ? null : "web")}>
              <Plus size={14} /> Add a link I missed — portfolio, paper, press
            </button>
            {addOpen === "web" && <AddLink value={link} onChange={setLink} onAdd={addLink} busy={busy} placeholder="https://…" />}
          </fieldset>
        </>
      )}
    </StageShell>
  );
}

function AddLink({ value, onChange, onAdd, busy, placeholder }: { value: string; onChange: (v: string) => void; onAdd: () => void; busy: boolean; placeholder: string }) {
  return (
    <div className="flex gap-2 items-center flex-wrap anim-fade-up">
      <input
        className="input"
        style={{ height: 44, flex: "1 1 240px" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
      />
      <button type="button" className="btn-primary" style={{ padding: "0 18px", height: 44, fontSize: 14 }} disabled={busy || !value.trim()} onClick={onAdd}>
        {busy ? <Spinner light /> : <Plus size={14} />} Add
      </button>
    </div>
  );
}
