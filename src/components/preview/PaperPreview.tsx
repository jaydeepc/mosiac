"use client";

import type { ProjectJSON, Experience } from "@/lib/types";

/**
 * "Your Mosaic so far": the paper that builds up through stages 2–5.
 * Driven by data presence rather than stage number, so skipping a stage still renders sensibly.
 */

function periodLabel(e: Experience) {
  const end = !e.end || /present|now|current/i.test(e.end) ? "present" : e.end.slice(0, 4);
  const start = e.start ? e.start.slice(0, 4) : "";
  return start ? `${start} – ${end}` : end;
}

const h4: React.CSSProperties = { margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#2F6F73" };

export function PaperPreview({ project, stage }: { project: ProjectJSON; stage: number }) {
  const prof = project.profile;
  const u = project.understanding;
  const hasSummary = Boolean(prof.summary);
  const hasWeb = project.extractions.some((e) => e.status === "done" && e.took.length);
  const researchPending = stage === 3 && project.readingStatus !== "done";
  const webExperience = prof.experience.filter((e) => e.source?.some((s) => s !== "resume"));
  const gapOpen = Boolean(u?.lastUpdatedLabel) && stage < 5 && !prof.experience.some((e) => /present/i.test(e.end ?? "") && e.bullets.length > 0 && e.source?.includes("talk"));
  const name = prof.name || "Your name";
  const headline = prof.headline || u?.seniority || (project.skippedUpload ? "Your story, as you tell it" : "");
  const shortened = stage >= 5 && prof.experience.length > 3;

  return (
    <div className="relative w-full paper-sheet anim-fade-up" style={{ maxWidth: 520, aspectRatio: "1 / 1.3", padding: "44px 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18, overflow: "hidden" }}>
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0 font-display font-medium text-[30px] leading-tight">{name}</h3>
        <p className="m-0 text-[13px] text-muted">
          {headline}
          {prof.location ? ` · ${prof.location}` : ""}
          {project.linkedinChoice && project.linkedinChoice !== "none" && hasWeb && (
            <span className="inline-block ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "#EEF3F1", color: "#2F6F73" }}>
              LinkedIn
            </span>
          )}
        </p>
      </div>
      <div style={{ height: 1, background: "#E6E2DA" }} />

      {/* Summary */}
      <div className="flex flex-col gap-1.5">
        <h4 style={h4}>Summary</h4>
        {hasSummary ? (
          <p className="m-0 text-xs leading-[1.6] rounded-[10px]" style={{ background: "#EEF3F1", padding: "10px 12px" }}>
            {prof.summary}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5" aria-hidden="true">
              <div className="shimmer" style={{ height: 8, width: "100%", borderRadius: 4 }} />
              <div className="shimmer" style={{ height: 8, width: "92%", borderRadius: 4 }} />
              <div className="shimmer" style={{ height: 8, width: "60%", borderRadius: 4 }} />
            </div>
            <span className="text-xs italic" style={{ color: "#9A4A26" }}>
              Written after stage 5, once we know the role
            </span>
          </>
        )}
      </div>

      {/* Experience */}
      <div className="flex flex-col gap-2">
        <h4 style={h4}>Experience</h4>
        {researchPending && !hasWeb && (
          <div className="flex items-center gap-2 text-xs rounded-[10px]" style={{ padding: "10px 12px", border: "1.5px dashed #9CC3C5", background: "#F7FAF9", color: "#2F6F73" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#9CC3C5" }} />
            Pieces from the web appear here once you tick and I read them
          </div>
        )}
        {gapOpen && webExperience.length === 0 && stage !== 3 && (
          <div className="text-xs rounded-[10px]" style={{ padding: "10px 12px", border: "1.5px dashed #C9693F", background: "#FBF1EA", color: "#9A4A26" }}>
            <strong>{u?.lastUpdatedLabel} → today</strong> — we&apos;ll fill this in when you talk (stage 4)
          </div>
        )}
        {project.liveDraft && (
          <div className="text-xs rounded-[10px] flex items-center gap-1.5" style={{ padding: "8px 10px", background: "#EEF3F1" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#2F6F73", flex: "0 0 auto" }} />
            <span className="italic" style={{ color: "#2F6F73" }}>
              {project.liveDraft}
            </span>
            <span className="anim-float" style={{ width: 10, height: 10, borderRadius: 3, background: "#9CC3C5", flex: "0 0 auto" }} />
            <span className="anim-float" style={{ width: 10, height: 10, borderRadius: 3, background: "#E7B99E", flex: "0 0 auto", animationDelay: "0.5s" }} />
          </div>
        )}
        {prof.experience.slice(0, 5).map((e, i) => {
          const fromWeb = e.source?.some((s) => s !== "resume" && s !== "talk");
          const fromTalk = e.source?.includes("talk");
          const isLast = i === prof.experience.length - 1 && shortened && !e.bullets.length;
          if (fromWeb && !e.bullets.length && stage <= 4) {
            return (
              <div key={e.id} className="text-xs leading-[1.5] rounded-[10px] flex gap-2 items-start anim-fade-up" style={{ padding: "10px 12px", background: "#EEF3F1" }}>
                <span style={{ marginTop: 4, width: 8, height: 8, borderRadius: 2, background: "#2F6F73", flex: "0 0 auto" }} />
                <span>
                  <strong>{e.title}</strong>, {e.company} · {periodLabel(e)}
                  <br />
                  <span className="text-muted">What you did there: stage 4</span>
                </span>
              </div>
            );
          }
          return (
            <div key={e.id} className="text-xs leading-[1.5] flex flex-col gap-1" style={{ color: isLast ? "#5B6472" : undefined }}>
              <div>
                <strong style={{ fontWeight: isLast ? 500 : 700 }}>{e.title}</strong>, {e.company} · {periodLabel(e)}
                {isLast && (
                  <span className="italic" style={{ color: "#9A4A26" }}>
                    {" "}
                    — shortened
                  </span>
                )}
              </div>
              {(fromTalk || stage >= 4) && e.bullets.length > 0 && (
                <ul className="m-0 pl-4 flex flex-col gap-1">
                  {e.bullets.slice(0, 3).map((b) => (
                    <li key={b.id} className="anim-fade-up">
                      {b.text}
                      {b.confirm && (
                        <span className="ml-1 px-1.5 rounded-full text-[9px] font-extrabold text-white" style={{ background: "#C9693F" }}>
                          confirm?
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        {prof.experience.length === 0 && !gapOpen && !researchPending && (
          <div className="text-xs text-muted italic">Your roles will appear here as Mosaic learns them.</div>
        )}
      </div>

      {/* Speaking / publications */}
      {(prof.speaking.length > 0 || prof.publications.length > 0) && (
        <div className="flex flex-col gap-2">
          <h4 style={h4}>{prof.speaking.length && prof.publications.length ? "Speaking & Writing" : prof.speaking.length ? "Speaking" : "Writing"}</h4>
          {[...prof.speaking, ...prof.publications].slice(0, 3).map((s) => (
            <div key={s.id} className="text-xs leading-[1.5] rounded-[10px] flex gap-2 items-start anim-fade-up" style={{ padding: stage <= 4 ? "10px 12px" : 0, background: stage <= 4 ? "#EEF3F1" : undefined }}>
              {stage <= 4 && <span style={{ marginTop: 4, width: 8, height: 8, borderRadius: 2, background: "#9CC3C5", flex: "0 0 auto" }} />}
              <span>
                {s.text}
                {s.year ? ` (${s.year})` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      <div className="flex flex-col gap-1.5">
        <h4 style={h4}>Education</h4>
        <div className="text-xs leading-[1.5]">
          {prof.education.length ? prof.education.map((ed) => `${ed.degree}, ${ed.school}`).join(" · ") : <span className="text-muted italic">Not yet known</span>}
        </div>
      </div>

      {/* decorative tiles */}
      <div aria-hidden="true" className="absolute anim-float" style={{ "--r": "12deg", right: -14, top: 120, width: 28, height: 28, borderRadius: 7, background: "#9CC3C5" } as React.CSSProperties} />
      <div aria-hidden="true" className="absolute anim-float" style={{ "--r": "-10deg", left: -12, bottom: 90, width: 22, height: 22, borderRadius: 6, background: "#E7B99E", animationDelay: "1.2s" } as React.CSSProperties} />
    </div>
  );
}
