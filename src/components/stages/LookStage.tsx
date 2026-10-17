"use client";

import { useRef, useState } from "react";
import { useNavigate } from "@/components/nav/NavProgress";
import { StageShell } from "@/components/stage/StageShell";
import { ArrowRight, Person, Spinner } from "@/components/Icons";
import { api, useProject } from "@/lib/client";
import { LANGUAGES, languageLabel } from "@/lib/config";
import type { ProjectJSON } from "@/lib/types";
import { LookPreview } from "@/components/preview/LookPreview";

export function LookStage({ initial }: { initial: ProjectJSON }) {
  const { go, pending: navPending } = useNavigate();
  const { project, setProject, patch } = useProject(initial.id, initial);
  const p = project ?? initial;
  const [look, setLook] = useState<"visual" | "classic">(p.look);
  const [second, setSecond] = useState(p.secondLanguage ?? "");
  const [output, setOutput] = useState(p.outputLanguage ?? "en");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(f: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { project } = await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/photo`, { method: "POST", body: fd });
      setProject(project);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <StageShell
      project={p}
      stage={6}
      title="How should it look?"
      intro="Both fit on two pages. Both read well to recruiters and to screening software."
      asideTitle={`Preview · ${look === "visual" ? "Visual" : "Classic"}`}
      asideStatus="Page 1 of 2"
      aside={<LookPreview project={p} look={look} />}
      footer={
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={navPending}
            onClick={async () => {
              await patch({ look, secondLanguage: second || undefined, outputLanguage: output, stage: 7 } as Partial<ProjectJSON>);
              go(`/m/${p.id}/craft`);
            }}
          >
            {navPending ? <Spinner light /> : null} Craft my Mosaic <ArrowRight size={16} />
          </button>
          <span className="text-sm text-muted">Takes about a minute. You can switch looks later without losing anything.</span>
        </>
      }
    >
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold rounded-xl px-3.5 py-2.5" style={{ background: "#FBF1EA", color: "#9A4A26" }}>
          {error}
        </p>
      )}

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
        <label className="flex flex-col gap-3 rounded-[18px] cursor-pointer bg-white" style={{ padding: 16, border: look === "visual" ? "2px solid #2F6F73" : "1px solid #E6E2DA" }}>
          <div aria-hidden="true" className="rounded-xl flex gap-2.5" style={{ height: 150, background: "#F7F5EF", padding: 14, boxSizing: "border-box" }}>
            <div className="flex flex-col gap-2 items-center" style={{ flex: "0 0 34%" }}>
              <div className="rounded-full" style={{ width: 40, height: 40, background: "linear-gradient(135deg, #DCE3F5, #9CC3C5)" }} />
              <div style={{ width: "80%", height: 6, borderRadius: 3, background: "#2F6F73" }} />
              <div style={{ width: "70%", height: 6, borderRadius: 3, background: "#9CC3C5" }} />
              <div style={{ width: "90%", height: 6, borderRadius: 3, background: "#E7B99E" }} />
              <div style={{ width: "60%", height: 6, borderRadius: 3, background: "#9CC3C5" }} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div style={{ width: "60%", height: 8, borderRadius: 4, background: "#1E2430" }} />
              <div style={{ width: "100%", height: 5, borderRadius: 3, background: "#D9D5CC" }} />
              <div style={{ width: "90%", height: 5, borderRadius: 3, background: "#D9D5CC" }} />
              <div className="flex gap-1 items-end" style={{ height: 44, marginTop: 4 }}>
                {["35%", "60%", "100%", "80%", "55%"].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: h, background: ["#DCE3F5", "#9CC3C5", "#2F6F73", "#9CC3C5", "#DCE3F5"][i], borderRadius: "2px 2px 0 0" }} />
                ))}
              </div>
              <div style={{ width: "80%", height: 5, borderRadius: 3, background: "#D9D5CC" }} />
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <input type="radio" name="look" checked={look === "visual"} onChange={() => setLook("visual")} style={{ accentColor: "#2F6F73", width: 20, height: 20, margin: "2px 0 0" }} />
            <span className="flex flex-col gap-1">
              <strong className="text-base">Visual</strong>
              <span className="text-[13px] text-muted leading-[1.5]">Charts of what grew, a timeline of your path, optional photo. Infographics are drawn for your story, not stock.</span>
            </span>
          </div>
        </label>

        <label className="flex flex-col gap-3 rounded-[18px] cursor-pointer bg-white" style={{ padding: 16, border: look === "classic" ? "2px solid #2F6F73" : "1px solid #E6E2DA" }}>
          <div aria-hidden="true" className="rounded-xl flex flex-col gap-[7px]" style={{ height: 150, background: "#F7F5EF", padding: "16px 18px", boxSizing: "border-box" }}>
            <div style={{ width: "50%", height: 10, borderRadius: 4, background: "#1E2430" }} />
            <div style={{ width: "35%", height: 5, borderRadius: 3, background: "#9CC3C5" }} />
            <div style={{ height: 1, background: "#D9D5CC", margin: "4px 0" }} />
            <div style={{ width: "22%", height: 5, borderRadius: 3, background: "#2F6F73" }} />
            <div style={{ width: "100%", height: 5, borderRadius: 3, background: "#D9D5CC" }} />
            <div style={{ width: "95%", height: 5, borderRadius: 3, background: "#D9D5CC" }} />
            <div style={{ width: "22%", height: 5, borderRadius: 3, background: "#2F6F73", marginTop: 4 }} />
            <div style={{ width: "100%", height: 5, borderRadius: 3, background: "#D9D5CC" }} />
            <div style={{ width: "70%", height: 5, borderRadius: 3, background: "#D9D5CC" }} />
          </div>
          <div className="flex items-start gap-2.5">
            <input type="radio" name="look" checked={look === "classic"} onChange={() => setLook("classic")} style={{ accentColor: "#2F6F73", width: 20, height: 20, margin: "2px 0 0" }} />
            <span className="flex flex-col gap-1">
              <strong className="text-base">Classic</strong>
              <span className="text-[13px] text-muted leading-[1.5]">No pictures — but far from plain. Strong typography, clear hierarchy, every line earning its place.</span>
            </span>
          </div>
        </label>
      </div>

      <div className="flex gap-3.5 flex-wrap">
        <div className="flex items-center gap-3.5 card" style={{ flex: "1 1 240px", padding: "14px 16px", borderRadius: 16 }}>
          <div className="rounded-full shrink-0 flex items-center justify-center overflow-hidden" style={{ width: 52, height: 52, background: "linear-gradient(135deg, #DCE3F5, #9CC3C5)" }}>
            {p.photoFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${p.photoFileId}`} alt="Your photo" className="w-full h-full object-cover" />
            ) : (
              <Person size={22} stroke="#2F6F73" />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <strong className="text-sm">Your photo (optional)</strong>
            <span className="text-xs text-muted">{look === "visual" ? "Square works best. Shown in the Visual look only." : "Classic has no photo — switch to Visual to show one."}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          {p.photoFileId ? (
            <div className="flex flex-col gap-1">
              <button type="button" className="btn-secondary" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => fileRef.current?.click()}>
                Replace
              </button>
              <button type="button" className="btn-ghost text-xs" onClick={async () => setProject((await api<{ project: ProjectJSON }>(`/api/projects/${p.id}/photo`, { method: "DELETE" })).project)}>
                Remove
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary" style={{ padding: "10px 14px", fontSize: 13 }} disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Spinner size={14} /> : null} Upload
            </button>
          )}
        </div>

        <div className="flex items-center gap-3.5 card" style={{ flex: "1 1 240px", padding: "14px 16px", borderRadius: 16 }}>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <strong className="text-sm">Also make a version in</strong>
            <span className="text-xs text-muted">Same story, written natively — not translated.</span>
          </div>
          <label htmlFor="second" className="sr-only">
            Second language
          </label>
          <select id="second" className="pill" style={{ padding: "10px 12px", cursor: "pointer" }} value={second} onChange={(e) => setSecond(e.target.value)}>
            <option value="">None</option>
            {LANGUAGES.filter((l) => l.code !== output).map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3.5 card" style={{ padding: "14px 16px", borderRadius: 16 }}>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <strong className="text-sm">Main language of the resume</strong>
          <span className="text-xs text-muted">Currently {languageLabel(output)}. Recruiters in your target market usually expect the local business language.</span>
        </div>
        <label htmlFor="output" className="sr-only">
          Output language
        </label>
        <select id="output" className="pill" style={{ padding: "10px 12px", cursor: "pointer" }} value={output} onChange={(e) => setOutput(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
      </div>
    </StageShell>
  );
}
