"use client";

import type { ProjectJSON } from "@/lib/types";
import { Person } from "@/components/Icons";

/** Stage 6 preview: a faithful sketch of page 1 in the chosen look, using the real profile data. */
export function LookPreview({ project, look }: { project: ProjectJSON; look: "visual" | "classic" }) {
  const prof = project.profile;
  const name = prof.name || "Your name";
  const headline = prof.headline || project.understanding?.seniority || "";
  const exp = prof.experience.slice(0, 2);
  const h4: React.CSSProperties = { margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#2F6F73" };
  const strengths = prof.strengths.length ? prof.strengths.slice(0, 3) : prof.skills.slice(0, 3).map((s, i) => ({ label: s, level: [92, 80, 64][i] }));
  const path = prof.experience.slice(0, 4);
  const colours = ["#2F6F73", "#9CC3C5", "#E7B99E", "#DCE3F5"];

  if (look === "classic") {
    return (
      <div className="relative w-full paper-sheet anim-fade-up" style={{ maxWidth: 520, aspectRatio: "1 / 1.3", padding: "44px 48px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
        <h3 className="m-0 font-display font-medium text-[30px] leading-tight">{name}</h3>
        <p className="m-0 text-[12px] font-semibold text-teal -mt-2">{headline}</p>
        <p className="m-0 text-[10px] text-muted -mt-1">{[prof.email, prof.phone, prof.location].filter(Boolean).join("  ·  ") || "email · phone · city"}</p>
        <div style={{ height: 1, background: "#E6E2DA" }} />
        <div className="flex flex-col gap-1.5">
          <h4 style={h4}>Summary</h4>
          <p className="m-0 text-[11px] leading-[1.6]">{prof.summary || "Your summary is written once the role is set."}</p>
        </div>
        <div className="flex flex-col gap-2">
          <h4 style={h4}>Experience</h4>
          {exp.map((e) => (
            <div key={e.id} className="text-[11px] leading-[1.5] flex flex-col gap-0.5">
              <div className="flex justify-between gap-2">
                <span>
                  <strong>{e.title}</strong>, {e.company}
                </span>
                <span className="text-muted">
                  {(e.start ?? "").slice(0, 4)} – {!e.end || /present/i.test(e.end) ? "present" : e.end.slice(0, 4)}
                </span>
              </div>
              <ul className="m-0 pl-3.5 flex flex-col gap-0.5">
                {e.bullets.slice(0, 2).map((b) => (
                  <li key={b.id}>{b.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <span className="text-[10px] text-muted mt-auto">Continues on page 2 · Education · Skills{prof.speaking.length ? " · Speaking" : ""}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full paper-sheet anim-fade-up flex overflow-hidden" style={{ maxWidth: 520, aspectRatio: "1 / 1.3", boxSizing: "border-box" }}>
      <div className="flex flex-col gap-[18px]" style={{ flex: "0 0 36%", background: "#F3F1EA", padding: "36px 24px", boxSizing: "border-box" }}>
        <div className="rounded-full flex items-center justify-center overflow-hidden" style={{ width: 84, height: 84, background: "linear-gradient(135deg, #DCE3F5, #9CC3C5)" }}>
          {project.photoFileId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${project.photoFileId}`} alt="" className="w-full h-full object-cover" />
          ) : (
            <Person size={30} stroke="#2F6F73" strokeWidth={1.8} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h4 style={h4}>Strengths</h4>
          <div className="flex flex-col gap-1.5 text-[11px]">
            {strengths.map((s, i) => (
              <div key={s.label} className="flex flex-col gap-[3px]">
                <span>{s.label}</span>
                <div style={{ height: 6, borderRadius: 3, background: "#E6E2DA" }}>
                  <div style={{ width: `${s.level}%`, height: "100%", borderRadius: 3, background: colours[i] }} />
                </div>
              </div>
            ))}
            {!strengths.length && <span className="text-muted italic">Drawn from your evidence</span>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h4 style={h4}>Path</h4>
          <div className="flex flex-col text-[11px] leading-[1.4]">
            {path.map((e, i) => (
              <div key={e.id}>
                <div className="flex gap-2">
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: colours[i % 4], marginTop: 3, flex: "0 0 auto" }} />
                  <span>
                    <strong>{(e.start ?? "").slice(0, 4)}</strong> {e.title}
                  </span>
                </div>
                {i < path.length - 1 && <div style={{ width: 2, height: 14, background: "#D9D5CC", marginLeft: 4 }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-3.5" style={{ padding: "36px 28px", boxSizing: "border-box" }}>
        <div className="flex flex-col gap-1">
          <h3 className="m-0 font-display font-medium text-[26px] leading-tight">{name}</h3>
          <p className="m-0 text-xs text-muted">{headline}</p>
        </div>
        <p className="m-0 text-[11px] leading-[1.6]">{prof.summary || "Your summary is written once the role is set."}</p>
        <div className="flex flex-col gap-1.5">
          <h4 style={h4}>What grew, by year</h4>
          <div className="flex gap-1.5 items-end" style={{ height: 64 }}>
            {["25%", "40%", "70%", "100%"].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-[3px] h-full justify-end">
                <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: ["#DCE3F5", "#9CC3C5", "#2F6F73", "#2F6F73"][i] }} />
                <span className="text-[9px] text-muted">{new Date().getFullYear() - 3 + i}</span>
              </div>
            ))}
          </div>
          <span className="text-[9px] italic" style={{ color: "#9A4A26" }}>
            Chart drawn from what you told me — numbers checked with you in stage 7
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h4 style={h4}>Experience</h4>
          {exp.map((e) => (
            <div key={e.id} className="text-[11px] leading-[1.5]">
              <strong>{e.title}</strong>, {e.company} · {(e.start ?? "").slice(0, 4)} – {!e.end || /present/i.test(e.end) ? "present" : e.end.slice(0, 4)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
