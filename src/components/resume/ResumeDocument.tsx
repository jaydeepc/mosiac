import type { ResumeDoc, Experience, ChartSpec } from "@/lib/types";
import type { ReactNode } from "react";

/**
 * The final resume, rendered identically on screen (preview + craft), on the public share page
 * and inside the PDF exporter. No client-only APIs here: it must render with renderToStaticMarkup.
 *
 * Sizes are in px for a 794px-wide sheet (A4 at 96dpi); ScaledSheet scales it to fit.
 */

export const SHEET_W = 794;
export const SHEET_H = 1123;

const INK = "#1E2430";
const MUTED = "#5B6472";
const TEAL = "#2F6F73";
const TEAL_LIGHT = "#9CC3C5";
const APRICOT = "#E7B99E";
const LAVENDER = "#DCE3F5";
const LINE = "#E6E2DA";
const PAPER2 = "#F3F1EA";

const BAR_COLOURS = [TEAL, TEAL_LIGHT, APRICOT, LAVENDER];

export interface ResumeRenderOptions {
  photoUrl?: string;
  backdropUrl?: string; // painterly backdrop for charts (visual look)
  pins?: Record<string, ReactNode>; // sectionId -> comment pin element (craft stage)
  highlight?: string | null; // sectionId highlighted
  onSection?: (id: string, label: string) => void; // click handler for commenting (client only)
  interactive?: boolean;
  fontScale?: number; // used by the PDF exporter to fit two pages
}

function period(e: Experience) {
  if (!e.start && !e.end) return "";
  const present = !e.end || /present|now|current/i.test(e.end);
  const fmt = (s?: string) => (s ? (s.length >= 7 ? `${monthName(s.slice(5, 7))} ${s.slice(0, 4)}` : s.slice(0, 4)) : "");
  return `${fmt(e.start)}${e.start ? " – " : ""}${present ? "present" : fmt(e.end)}`;
}
function monthName(mm: string) {
  const n = parseInt(mm, 10);
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][n - 1] ?? "";
}

function Confirm({ children }: { children?: ReactNode }) {
  return (
    <span style={{ display: "inline-block", marginLeft: 6, padding: "1px 7px", borderRadius: 999, background: "#C9693F", color: "#fff", fontSize: 9, fontWeight: 800, verticalAlign: "middle" }}>
      {children ?? "confirm?"}
    </span>
  );
}

function H4({ children, size = 10 }: { children: ReactNode; size?: number }) {
  return <h4 style={{ margin: 0, fontSize: size, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEAL }}>{children}</h4>;
}

function Section({ id, label, opts, children, style }: { id: string; label: string; opts: ResumeRenderOptions; children: ReactNode; style?: React.CSSProperties }) {
  const hl = opts.highlight === id;
  const pin = opts.pins?.[id];
  const clickable = Boolean(opts.interactive && opts.onSection);
  return (
    <div
      data-section={id}
      data-label={label}
      className={clickable ? "resume-section" : undefined}
      onClick={clickable ? () => opts.onSection?.(id, label) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " ") && opts.onSection?.(id, label) : undefined}
      style={{
        position: "relative",
        borderRadius: 10,
        padding: hl || pin ? "10px 12px" : undefined,
        margin: hl || pin ? "-10px -12px" : undefined,
        outline: hl ? "2px dashed #C9693F" : undefined,
        outlineOffset: -2,
        background: pin && !hl ? "#FBF1EA" : undefined,
        border: pin && !hl ? "1px solid #F0D9C8" : undefined,
        breakInside: "avoid",
        cursor: clickable ? "pointer" : undefined,
        ...style,
      }}
    >
      {pin}
      {children}
    </div>
  );
}

function BarChart({ chart, scale = 1, backdropUrl }: { chart: ChartSpec; scale?: number; backdropUrl?: string }) {
  const max = Math.max(...chart.series.map((s) => s.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 * scale, position: "relative" }}>
      {backdropUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backdropUrl} alt="" aria-hidden="true" style={{ position: "absolute", inset: -8, width: "calc(100% + 16px)", height: "calc(100% + 16px)", objectFit: "cover", opacity: 0.35, borderRadius: 10, pointerEvents: "none" }} />
      )}
      <H4 size={10 * scale}>{chart.title}</H4>
      <div style={{ display: "flex", gap: 8 * scale, alignItems: "flex-end", height: 70 * scale, position: "relative" }}>
        {chart.series.map((s, i) => {
          const h = Math.max(6, Math.round((s.value / max) * 100));
          const colour = i === chart.series.length - 1 ? TEAL : BAR_COLOURS[(chart.series.length - 1 - i) % BAR_COLOURS.length];
          return (
            <div key={s.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 * scale, height: "100%", justifyContent: "flex-end", position: "relative" }}>
              <span style={{ fontSize: 9 * scale, color: MUTED, fontWeight: 700 }}>
                {formatValue(s.value, chart.unit)}
              </span>
              <div title={`${s.label}: ${formatValue(s.value, chart.unit)}`} style={{ width: "100%", height: `${h}%`, borderRadius: "3px 3px 0 0", background: colour, minHeight: 4 }} />
              <span style={{ fontSize: 9 * scale, color: MUTED }}>{s.label}</span>
              {s.confirm && (
                <span style={{ position: "absolute", top: -8, right: -8, padding: "2px 6px", borderRadius: 999, background: "#C9693F", color: "#fff", fontSize: 9, fontWeight: 800 }}>confirm?</span>
              )}
            </div>
          );
        })}
      </div>
      {chart.note && <span style={{ fontSize: 9 * scale, color: "#9A4A26", fontStyle: "italic" }}>{chart.note}</span>}
    </div>
  );
}

function formatValue(v: number, unit?: string) {
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1_000_000) s = `${(v / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  else if (abs >= 1000) s = `${(v / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  else s = `${Math.round(v * 10) / 10}`;
  if (unit === "%") return `${s}%`;
  if (unit && unit !== "count") return `${s} ${unit}`;
  return s;
}

/* ------------------------------------------------------------------ */

export function ResumeDocument({ doc, opts = {} }: { doc: ResumeDoc; opts?: ResumeRenderOptions }) {
  const fs = opts.fontScale ?? 1;
  return doc.look === "visual" ? <VisualResume doc={doc} opts={opts} fs={fs} /> : <ClassicResume doc={doc} opts={opts} fs={fs} />;
}

function ContactLines({ doc, size }: { doc: ResumeDoc; size: number }) {
  const c = doc.contact;
  const items = [c.email, c.phone, c.linkedin?.replace(/^https?:\/\/(www\.)?/, ""), c.website?.replace(/^https?:\/\/(www\.)?/, ""), doc.location].filter(Boolean) as string[];
  return (
    <>
      {items.map((t) => (
        <span key={t} style={{ fontSize: size, wordBreak: "break-word" }}>
          {t}
        </span>
      ))}
    </>
  );
}

function ExperienceBlock({ e, fs, compact }: { e: Experience; fs: number; compact?: boolean }) {
  return (
    <div style={{ fontSize: 11.5 * fs, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 4 * fs, breakInside: "avoid" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span>
          <strong>{e.title}</strong>, {e.company}
          {e.location ? ` · ${e.location}` : ""}
        </span>
        <span style={{ color: MUTED }}>{period(e)}</span>
      </div>
      {!compact && e.bullets.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 3 * fs }}>
          {e.bullets.map((b) => (
            <li key={b.id}>
              {b.text}
              {b.confirm && <Confirm />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ VISUAL ------------------------------ */

function VisualResume({ doc, opts, fs }: { doc: ResumeDoc; opts: ResumeRenderOptions; fs: number }) {
  const sidebarW = "34%";
  const timeline = [...doc.experience].map((e) => ({ year: (e.start ?? "").slice(0, 4), title: e.title }));
  return (
    <div className="resume-root resume-visual" style={{ position: "relative", width: "100%", minHeight: "100%", color: INK, fontFamily: "var(--font-manrope), Manrope, system-ui, sans-serif", display: "flex" }}>
      {/* sidebar band (repeats on every printed page) */}
      <div aria-hidden="true" className="resume-band" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: sidebarW, background: PAPER2, borderRadius: "6px 0 0 6px" }} />

      <aside style={{ position: "relative", flex: `0 0 ${sidebarW}`, padding: `${40 * fs}px ${26 * fs}px`, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20 * fs }}>
        <div style={{ width: 92 * fs, height: 92 * fs, borderRadius: "50%", background: "linear-gradient(135deg, #DCE3F5, #9CC3C5)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {opts.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={opts.photoUrl} alt={doc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <svg width={34 * fs} height={34 * fs} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          )}
        </div>

        <Section id="contact" label="Contact" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 8 * fs, fontSize: 11 * fs, lineHeight: 1.5 }}>
          <H4 size={10 * fs}>Contact</H4>
          <ContactLines doc={doc} size={11 * fs} />
        </Section>

        {doc.strengths.length > 0 && (
          <Section id="strengths" label="Strengths" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 8 * fs }}>
            <H4 size={10 * fs}>Strengths</H4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 * fs, fontSize: 11 * fs }}>
              {doc.strengths.slice(0, 5).map((s, i) => (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{s.label}</span>
                  </span>
                  <div style={{ height: 6, borderRadius: 3, background: LINE }}>
                    <div style={{ width: `${Math.min(100, Math.max(10, s.level))}%`, height: "100%", borderRadius: 3, background: BAR_COLOURS[i % BAR_COLOURS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {timeline.length > 0 && (
          <Section id="path" label="Path" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 8 * fs }}>
            <H4 size={10 * fs}>Path</H4>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 11 * fs, lineHeight: 1.4 }}>
              {timeline.slice(0, 6).map((t, i) => (
                <div key={`${t.year}-${i}`}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: BAR_COLOURS[i % BAR_COLOURS.length], marginTop: 3, flex: "0 0 auto" }} />
                    <span>
                      <strong>{t.year}</strong> {t.title}
                    </span>
                  </div>
                  {i < Math.min(timeline.length, 6) - 1 && <div style={{ width: 2, height: 14 * fs, background: "#D9D5CC", marginLeft: 4 }} />}
                </div>
              ))}
            </div>
          </Section>
        )}

        {doc.education.length > 0 && (
          <Section id="education" label="Education" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 8 * fs, fontSize: 11 * fs, lineHeight: 1.5 }}>
            <H4 size={10 * fs}>Education</H4>
            {doc.education.map((ed) => (
              <span key={ed.id}>
                <strong>{ed.degree}</strong>, {ed.school}
                {ed.year ? ` · ${ed.year}` : ""}
              </span>
            ))}
          </Section>
        )}

        {doc.skills.length > 0 && (
          <Section id="skills" label="Skills" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 8 * fs, fontSize: 11 * fs, lineHeight: 1.5 }}>
            <H4 size={10 * fs}>Skills</H4>
            <span>{doc.skills.slice(0, 14).join(" · ")}</span>
          </Section>
        )}

        {doc.languages.length > 0 && (
          <Section id="languages" label="Languages" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 8 * fs, fontSize: 11 * fs, lineHeight: 1.5 }}>
            <H4 size={10 * fs}>Languages</H4>
            <span>{doc.languages.join(" · ")}</span>
          </Section>
        )}

        {doc.certifications.length > 0 && (
          <Section id="certifications" label="Certifications" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6 * fs, fontSize: 11 * fs, lineHeight: 1.5 }}>
            <H4 size={10 * fs}>Certifications</H4>
            {doc.certifications.map((c) => (
              <span key={c.id}>
                {c.text}
                {c.year ? ` · ${c.year}` : ""}
              </span>
            ))}
          </Section>
        )}
      </aside>

      <main style={{ position: "relative", flex: 1, minWidth: 0, padding: `${40 * fs}px ${32 * fs}px`, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 * fs }}>
        <Section id="header" label="Name & headline" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif", fontWeight: 500, fontSize: 30 * fs, lineHeight: 1.1 }}>{doc.name}</h3>
          <p style={{ margin: 0, fontSize: 12 * fs, color: MUTED }}>{doc.headline}</p>
        </Section>

        <Section id="summary" label="Summary" opts={opts}>
          <p style={{ margin: 0, fontSize: 11.5 * fs, lineHeight: 1.6 }}>{doc.summary}</p>
        </Section>

        {doc.charts.slice(0, 1).map((c) => (
          <Section key={c.id} id={`chart-${c.id}`} label={c.title} opts={opts}>
            <BarChart chart={c} scale={fs} backdropUrl={opts.backdropUrl} />
          </Section>
        ))}

        <Section id="experience" label="Experience" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 10 * fs }}>
          <H4 size={10 * fs}>Experience</H4>
          {doc.experience.map((e) => (
            <ExperienceBlock key={e.id} e={e} fs={fs} />
          ))}
        </Section>

        {doc.charts.slice(1, 2).map((c) => (
          <Section key={c.id} id={`chart-${c.id}`} label={c.title} opts={opts}>
            <BarChart chart={c} scale={fs} backdropUrl={opts.backdropUrl} />
          </Section>
        ))}

        {doc.speaking.length > 0 && (
          <Section id="speaking" label="Speaking" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6 * fs }}>
            <H4 size={10 * fs}>Speaking</H4>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5 * fs, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 3 }}>
              {doc.speaking.map((s) => (
                <li key={s.id}>
                  {s.text}
                  {s.year ? ` (${s.year})` : ""}
                  {s.confirm && <Confirm />}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {doc.publications.length > 0 && (
          <Section id="publications" label="Writing" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6 * fs }}>
            <H4 size={10 * fs}>Writing</H4>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5 * fs, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 3 }}>
              {doc.publications.map((s) => (
                <li key={s.id}>
                  {s.text}
                  {s.year ? ` (${s.year})` : ""}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {doc.awards.length > 0 && (
          <Section id="awards" label="Recognition" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6 * fs }}>
            <H4 size={10 * fs}>Recognition</H4>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5 * fs, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 3 }}>
              {doc.awards.map((s) => (
                <li key={s.id}>
                  {s.text}
                  {s.year ? ` (${s.year})` : ""}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </main>
    </div>
  );
}

/* ------------------------------ CLASSIC ------------------------------ */

function ClassicResume({ doc, opts, fs }: { doc: ResumeDoc; opts: ResumeRenderOptions; fs: number }) {
  const c = doc.contact;
  const contact = [c.email, c.phone, c.linkedin?.replace(/^https?:\/\/(www\.)?/, ""), c.website?.replace(/^https?:\/\/(www\.)?/, ""), doc.location].filter(Boolean).join("  ·  ");
  return (
    <div className="resume-root resume-classic" style={{ position: "relative", width: "100%", minHeight: "100%", color: INK, fontFamily: "var(--font-manrope), Manrope, system-ui, sans-serif", padding: `${52 * fs}px ${60 * fs}px`, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18 * fs }}>
      <Section id="header" label="Name & headline" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif", fontWeight: 500, fontSize: 34 * fs, lineHeight: 1.05, letterSpacing: "-0.01em" }}>{doc.name}</h3>
        <p style={{ margin: 0, fontSize: 13 * fs, color: TEAL, fontWeight: 600 }}>{doc.headline}</p>
        <p style={{ margin: 0, fontSize: 10.5 * fs, color: MUTED }}>{contact}</p>
      </Section>
      <div style={{ height: 1, background: LINE }} />

      <Section id="summary" label="Summary" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <H4 size={10 * fs}>Summary</H4>
        <p style={{ margin: 0, fontSize: 11.5 * fs, lineHeight: 1.6 }}>{doc.summary}</p>
      </Section>

      <Section id="experience" label="Experience" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 10 * fs }}>
        <H4 size={10 * fs}>Experience</H4>
        {doc.experience.map((e) => (
          <ExperienceBlock key={e.id} e={e} fs={fs} />
        ))}
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 * fs }}>
        {doc.education.length > 0 && (
          <Section id="education" label="Education" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5 * fs, lineHeight: 1.5 }}>
            <H4 size={10 * fs}>Education</H4>
            {doc.education.map((ed) => (
              <span key={ed.id}>
                <strong>{ed.degree}</strong>, {ed.school}
                {ed.year ? ` · ${ed.year}` : ""}
              </span>
            ))}
          </Section>
        )}
        {(doc.skills.length > 0 || doc.strengths.length > 0) && (
          <Section id="skills" label="Skills" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5 * fs, lineHeight: 1.5 }}>
            <H4 size={10 * fs}>Skills</H4>
            <span>{(doc.skills.length ? doc.skills : doc.strengths.map((s) => s.label)).slice(0, 14).join(" · ")}</span>
          </Section>
        )}
      </div>

      {doc.speaking.length > 0 && (
        <Section id="speaking" label="Speaking" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <H4 size={10 * fs}>Speaking</H4>
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5 * fs, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 3 }}>
            {doc.speaking.map((s) => (
              <li key={s.id}>
                {s.text}
                {s.year ? ` (${s.year})` : ""}
                {s.confirm && <Confirm />}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {doc.publications.length > 0 && (
        <Section id="publications" label="Writing" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <H4 size={10 * fs}>Writing</H4>
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11.5 * fs, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 3 }}>
            {doc.publications.map((s) => (
              <li key={s.id}>
                {s.text}
                {s.year ? ` (${s.year})` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 * fs }}>
        {doc.certifications.length > 0 && (
          <Section id="certifications" label="Certifications" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5 * fs, lineHeight: 1.5 }}>
            <H4 size={10 * fs}>Certifications</H4>
            {doc.certifications.map((s) => (
              <span key={s.id}>
                {s.text}
                {s.year ? ` · ${s.year}` : ""}
              </span>
            ))}
          </Section>
        )}
        {(doc.awards.length > 0 || doc.languages.length > 0) && (
          <Section id="awards" label="Recognition & languages" opts={opts} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5 * fs, lineHeight: 1.5 }}>
            <H4 size={10 * fs}>{doc.awards.length ? "Recognition" : "Languages"}</H4>
            {doc.awards.map((s) => (
              <span key={s.id}>
                {s.text}
                {s.year ? ` · ${s.year}` : ""}
              </span>
            ))}
            {doc.languages.length > 0 && <span style={{ color: MUTED }}>Languages: {doc.languages.join(" · ")}</span>}
          </Section>
        )}
      </div>
    </div>
  );
}
