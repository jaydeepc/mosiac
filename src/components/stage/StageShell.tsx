"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Wordmark, TileTrio } from "@/components/Mark";
import { ArrowLeft, Check, ChevronUp, X } from "@/components/Icons";
import { STAGES, type ProjectJSON } from "@/lib/types";
import { languageLabel } from "@/lib/config";
import { useIsMobile } from "@/lib/client";

const MINUTES: Record<number, string> = { 2: "About 10 minutes left", 3: "About 9 minutes left", 4: "About 7 minutes left", 5: "About 4 minutes left", 6: "About 3 minutes left", 7: "Nearly there", 8: "" };

export function ProgressBars({ stage, flex = false }: { stage: number; flex?: boolean }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {STAGES.map((s) => (
        <span key={s.n} style={{ width: flex ? undefined : 28, flex: flex ? 1 : undefined, height: flex ? 5 : 6, borderRadius: 3, background: s.n <= stage ? "#2F6F73" : "#E6E2DA", transition: "background 0.4s ease" }} />
      ))}
    </div>
  );
}

export function StageNav({ project, current }: { project: ProjectJSON; current: number }) {
  return (
    <nav aria-label="Stages" className="flex flex-col gap-1" style={{ flex: "0 0 220px", padding: "28px 20px", borderRight: "1px solid #E6E2DA" }}>
      {STAGES.map((s) => {
        const done = s.n < current || (s.n === 1);
        const isCurrent = s.n === current;
        const reachable = s.n <= Math.max(project.stage, current) || s.n === 1;
        const href = s.n === 1 ? "/" : `/m/${project.id}/${s.slug}`;
        const inner = (
          <>
            {done && !isCurrent ? (
              <span className="inline-flex items-center justify-center rounded-full" style={{ width: 24, height: 24, background: "#2F6F73", color: "#fff" }}>
                <Check size={12} strokeWidth={3} />
              </span>
            ) : (
              <span className="inline-flex items-center justify-center rounded-full" style={{ width: 24, height: 24, border: isCurrent ? "2px solid #2F6F73" : "1.5px solid #D9D5CC", color: isCurrent ? "#2F6F73" : undefined, fontSize: 12 }}>
                {s.n}
              </span>
            )}
            {s.label}
          </>
        );
        const style: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, fontSize: 14, fontWeight: isCurrent ? 700 : 600, color: isCurrent ? "#1E2430" : "#5B6472", background: isCurrent ? "#EEF3F1" : undefined, textDecoration: "none" };
        return reachable ? (
          <Link key={s.n} href={href} aria-current={isCurrent ? "step" : undefined} style={style} className="hover:bg-soft">
            {inner}
          </Link>
        ) : (
          <span key={s.n} style={{ ...style, opacity: 0.6, cursor: "default" }}>
            {inner}
          </span>
        );
      })}
    </nav>
  );
}

export interface StageShellProps {
  project: ProjectJSON;
  stage: number;
  title: ReactNode;
  intro: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  aside: ReactNode;
  asideTitle?: ReactNode;
  asideStatus?: ReactNode;
  asideAccent?: boolean;
  statusOverride?: string; // e.g. "Stage 3 of 8 · reading"
  mobileLabel?: string;
  backHref?: string;
  peekLabel?: string;
  sectionFlex?: string;
  asideFlex?: string;
  sectionGap?: number;
}

export function StageShell(p: StageShellProps) {
  const mobile = useIsMobile();
  const router = useRouter();
  const [peek, setPeek] = useState(false);
  const stageDef = STAGES.find((s) => s.n === p.stage) ?? STAGES[1];
  const prev = STAGES.find((s) => s.n === p.stage - 1);
  const backHref = p.backHref ?? (prev && prev.n > 1 ? `/m/${p.project.id}/${prev.slug}` : "/projects");

  useEffect(() => {
    if (!peek) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPeek(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek]);

  if (mobile) {
    return (
      <div className="relative min-h-screen bg-paper text-ink flex flex-col">
        <header className="sticky top-0 z-20 flex flex-col gap-3 bg-white border-b border-line" style={{ padding: "14px 20px 12px" }}>
          <div className="flex items-center justify-between gap-2.5">
            <Link href={backHref} aria-label="Back" className="inline-flex items-center justify-center rounded-full text-ink" style={{ width: 44, height: 44 }}>
              <ArrowLeft size={20} />
            </Link>
            <span className="text-sm font-bold">
              {p.stage} of 8 · {p.mobileLabel ?? stageDef.label}
            </span>
            <span className="pill" style={{ padding: "6px 10px", fontSize: 12 }}>
              {languageLabel(p.project.outputLanguage)}
            </span>
          </div>
          <ProgressBars stage={p.stage} flex />
        </header>

        <main className="flex-1 flex flex-col gap-4 anim-fade-up" style={{ padding: "20px 20px 0" }}>
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 font-display font-normal text-[30px] leading-[1.1]">{p.title}</h1>
            <p className="m-0 text-sm text-muted leading-[1.5]">{p.intro}</p>
          </div>
          {p.children}
        </main>

        <div className="sticky bottom-0 z-10 flex flex-col gap-2.5 bg-paper" style={{ padding: "12px 20px 28px", boxShadow: "0 -12px 24px rgba(251,250,246,0.9)" }}>
          <button type="button" onClick={() => setPeek(true)} className="flex items-center justify-between gap-2.5 bg-white border border-line rounded-[14px] text-[13px] font-semibold text-ink text-left" style={{ padding: "12px 16px", font: "inherit", fontSize: 13, fontWeight: 600 }}>
            <span className="flex items-center gap-2.5">
              <TileTrio />
              {p.peekLabel ?? "Peek at your Mosaic so far"}
            </span>
            <ChevronUp size={16} stroke="#5B6472" />
          </button>
          {p.footer}
        </div>

        {peek && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-label="Your Mosaic so far">
            <button type="button" aria-label="Close preview" className="absolute inset-0 border-0" style={{ background: "rgba(30,36,48,0.35)" }} onClick={() => setPeek(false)} />
            <div className="relative bg-paper-2 rounded-t-[20px] flex flex-col gap-3 anim-fade-up" style={{ maxHeight: "88vh", padding: "10px 16px 24px", boxShadow: "0 -12px 32px rgba(30,36,48,0.18)" }}>
              <div aria-hidden="true" className="mx-auto rounded-sm" style={{ width: 40, height: 4, background: "#D9D5CC" }} />
              <div className="flex items-center justify-between gap-3">
                <h2 className="m-0 text-xs font-bold tracking-[0.08em] uppercase text-muted">{p.asideTitle ?? "Your Mosaic so far"}</h2>
                <button type="button" aria-label="Close" className="btn-ghost" onClick={() => setPeek(false)}>
                  <X size={18} />
                </button>
              </div>
              {p.asideStatus && <div className="text-[13px] text-muted">{p.asideStatus}</div>}
              <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: "72vh" }}>
                {p.aside}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="flex items-center justify-between gap-4 flex-wrap bg-white border-b border-line" style={{ padding: "16px 32px" }}>
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-muted">{p.statusOverride ?? `Stage ${p.stage} of 8`}</span>
          <ProgressBars stage={p.stage} />
          {MINUTES[p.stage] && <span className="text-[13px] text-muted">{MINUTES[p.stage]}</span>}
        </div>
        <div className="flex items-center gap-2.5">
          <span className="pill">Output · {languageLabel(p.project.outputLanguage)}</span>
          <button
            type="button"
            className="btn-ghost text-[13px]"
            style={{ padding: "8px 12px" }}
            onClick={() => {
              router.push("/projects");
            }}
          >
            Save &amp; exit
          </button>
        </div>
      </header>

      <div className="flex flex-wrap flex-1">
        <StageNav project={p.project} current={p.stage} />

        <section aria-labelledby="h-stage" className="min-w-0 flex flex-col anim-fade-up" style={{ flex: p.sectionFlex ?? "1 1 480px", padding: "36px 40px", gap: p.sectionGap ?? 20 }}>
          <div className="flex flex-col gap-2">
            <h1 id="h-stage" className="m-0 font-display font-normal text-[40px] tracking-[-0.01em]">
              {p.title}
            </h1>
            <p className="m-0 text-base text-muted leading-[1.5]">{p.intro}</p>
          </div>
          {p.children}
          {p.footer && <div className="flex gap-3 flex-wrap items-center mt-auto pt-2">{p.footer}</div>}
        </section>

        <aside aria-label="Your Mosaic so far" className="min-w-0 flex flex-col gap-4 border-l border-line" style={{ flex: p.asideFlex ?? "1 1 520px", padding: "36px 40px", background: "linear-gradient(180deg, #F3F1EA 0%, #FBFAF6 100%)" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-sm font-bold tracking-[0.08em] uppercase text-muted">{p.asideTitle ?? "Your Mosaic so far"}</h2>
            {p.asideStatus && <span className="text-[13px]" style={{ color: p.asideAccent ? "#2F6F73" : "#5B6472", fontWeight: p.asideAccent ? 600 : 400 }}>{p.asideStatus}</span>}
          </div>
          <div className="sticky top-6">{p.aside}</div>
        </aside>
      </div>
    </div>
  );
}
