import { chat, extractJSON, chatJSON } from "./openrouter";
import { config } from "../config";
import { uid } from "../api";
import type { Experience, Profile } from "../types";

/* ------------------------------------------------------------------ */
/*  LinkedIn, read properly.                                           */
/*  LinkedIn blocks direct fetches, but the Exa index holds the public */
/*  profile text. Three targeted pulls return structured JSON built    */
/*  only from that text; a PDF/paste export goes through the same      */
/*  structuring step.                                                  */
/* ------------------------------------------------------------------ */

export interface LinkedInRole {
  title: string;
  company: string;
  location?: string;
  start?: string; // YYYY-MM or YYYY
  end?: string; // YYYY-MM | YYYY | "present"
  description?: string;
}
export interface LinkedInData {
  name?: string;
  headline?: string;
  location?: string;
  about?: string;
  experience: LinkedInRole[];
  education: { degree: string; school: string; year?: string }[];
  certifications: { text: string; year?: string }[];
  skills: string[];
  honours: { text: string; year?: string }[];
  publications: { text: string; year?: string }[];
  languages: string[];
  posts: { theme: string; date?: string }[];
  totalExperience?: string;
  vanity: string[]; // follower counts, endorsements, banners — reported so they can be left out
  coverage: "full" | "partial" | "none";
  sourceNote: string;
}

const EMPTY: LinkedInData = { experience: [], education: [], certifications: [], skills: [], honours: [], publications: [], languages: [], posts: [], vanity: [], coverage: "none", sourceNote: "" };

const SYSTEM = `You extract facts from LinkedIn profile text supplied in the web search results. Use ONLY that text. Never fill gaps from memory or from other people with a similar name. If the results do not contain the profile, return coverage "none". Output JSON only.`;

function handleOf(url: string): string {
  const m = url.match(/linkedin\.com\/(?:in|pub)\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : "";
}

async function exaJSON<T>(prompt: string, maxResults = 8): Promise<T | null> {
  try {
    const res = await chat({
      model: config.models.research,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      web: { engine: "exa", includeDomains: ["linkedin.com"], maxResults },
      maxTokens: 6000,
      temperature: 0.1,
      reasoning: "low",
      timeoutMs: 120_000,
    });
    return extractJSON<T>(res.content);
  } catch (e) {
    console.warn("[linkedin] exa pull failed:", (e as Error).message);
    return null;
  }
}

/** Reads a public LinkedIn profile through the Exa index. */
export async function extractLinkedInProfile(url: string, name: string): Promise<LinkedInData> {
  const handle = handleOf(url);
  const who = `${name} (LinkedIn profile ${url}${handle ? `, handle "${handle}"` : ""})`;

  const [exp, about, posts] = await Promise.all([
    exaJSON<{ experience: LinkedInRole[]; totalExperience?: string; coverage: string }>(
      `Search for the LinkedIn profile ${url} ${name} experience. From the profile text of ${who} ONLY, list the complete Experience section — every position, including multiple positions at the same company — with exact dates as shown.
Return JSON: {"experience": [{"title","company","location","start": "YYYY-MM" or "YYYY","end": "YYYY-MM"|"YYYY"|"present","description": the role description if present}], "totalExperience": e.g. "21 years 4 months" if stated, "coverage": "full" if the experience list looked complete, "partial" if truncated, "none" if the profile text was not in the results}`,
      8,
    ),
    exaJSON<Partial<LinkedInData> & { coverage: string }>(
      `Search for the LinkedIn profile ${url} ${name} about education skills. From the profile text of ${who} ONLY, extract:
{"name", "headline": the headline line under the name, "location", "about": the About section verbatim or near-verbatim, "education": [{"degree","school","year"}], "certifications": [{"text","year"}], "skills": [top skills listed], "honours": [{"text","year"}], "publications": [{"text","year"}], "languages": [string], "vanity": [things like follower/connection counts, endorsement counts, 'open to work' banners — list them so they can be left out], "coverage": "full"|"partial"|"none"}`,
      8,
    ),
    exaJSON<{ posts: { theme: string; date?: string }[]; coverage: string }>(
      `Search for recent LinkedIn posts and activity by ${name}${handle ? ` (linkedin.com/posts/${handle}_ …)` : ""}. From the post texts in the results ONLY, summarise what this person has been working on and talking about recently.
Return JSON: {"posts": [{"theme": one line on the topic of the post and what it reveals about their current work (projects, launches, talks, roles), "date": "YYYY-MM" if visible}], "coverage": "full"|"partial"|"none"}. Up to 8 posts, newest first.`,
      8,
    ),
  ]);

  const data: LinkedInData = {
    ...EMPTY,
    name: about?.name,
    headline: about?.headline,
    location: about?.location,
    about: about?.about,
    experience: (exp?.experience ?? []).filter((r) => r && r.title && r.company).map((r) => ({ ...r, start: normDate(r.start), end: normEnd(r.end) })),
    education: about?.education ?? [],
    certifications: about?.certifications ?? [],
    skills: about?.skills ?? [],
    honours: about?.honours ?? [],
    publications: about?.publications ?? [],
    languages: about?.languages ?? [],
    posts: posts?.posts ?? [],
    totalExperience: exp?.totalExperience,
    vanity: about?.vanity ?? [],
    coverage: exp?.coverage === "full" ? "full" : exp?.experience?.length ? "partial" : about?.coverage === "none" ? "none" : "partial",
    sourceNote: "",
  };
  data.sourceNote =
    data.coverage === "none"
      ? "The public profile text wasn't in the index. Upload LinkedIn's PDF export (Profile → More → Save to PDF) or paste the profile text and I'll read that instead."
      : `Read from the public profile text: ${data.experience.length} positions${data.posts.length ? `, ${data.posts.length} recent posts` : ""}${data.coverage === "partial" ? " (the list looked truncated — the PDF export would complete it)" : ""}.`;
  return data;
}

/** Structures a pasted profile or LinkedIn's "Save to PDF" export. */
export async function structureLinkedInExport(text: string): Promise<LinkedInData> {
  const { data } = await chatJSON<Partial<LinkedInData>>({
    model: config.models.writer,
    messages: [
      { role: "system", content: "You turn the text of a LinkedIn profile export into structured JSON. Use only what the text says. JSON only." },
      {
        role: "user",
        content: `Profile text:\n"""\n${text.slice(0, 40000)}\n"""\n\nReturn JSON: {"name","headline","location","about","experience":[{"title","company","location","start":"YYYY-MM"|"YYYY","end":"YYYY-MM"|"YYYY"|"present","description"}] (every position, most recent first, including multiple positions at one company),"education":[{"degree","school","year"}],"certifications":[{"text","year"}],"skills":[string],"honours":[{"text","year"}],"publications":[{"text","year"}],"languages":[string],"vanity":[string]}`,
      },
    ],
    maxTokens: 6000,
    temperature: 0.1,
  });
  const out: LinkedInData = { ...EMPTY, ...data, experience: (data.experience ?? []).filter((r) => r && r.title && r.company).map((r) => ({ ...r, start: normDate(r.start), end: normEnd(r.end) })), posts: [], coverage: (data.experience ?? []).length ? "full" : "none", sourceNote: "" };
  out.sourceNote = out.coverage === "full" ? `Read from your export: ${out.experience.length} positions.` : "I couldn't find an Experience section in that text.";
  return out;
}

/** Plain-text rendering so the take-or-leave judge sees exactly what was read. */
export function linkedInToText(d: LinkedInData): string {
  const lines: string[] = [];
  if (d.name) lines.push(`Name: ${d.name}`);
  if (d.headline) lines.push(`Headline: ${d.headline}`);
  if (d.location) lines.push(`Location: ${d.location}`);
  if (d.totalExperience) lines.push(`Total experience: ${d.totalExperience}`);
  if (d.about) lines.push(`\nAbout:\n${d.about}`);
  lines.push("\nExperience:");
  for (const r of d.experience) lines.push(`- ${r.title} — ${r.company}${r.location ? ` (${r.location})` : ""} · ${r.start ?? "?"} – ${r.end ?? "?"}${r.description ? `\n  ${r.description}` : ""}`);
  if (d.education.length) lines.push("\nEducation:", ...d.education.map((e) => `- ${e.degree}, ${e.school}${e.year ? ` · ${e.year}` : ""}`));
  if (d.certifications.length) lines.push("\nCertifications:", ...d.certifications.map((c) => `- ${c.text}${c.year ? ` · ${c.year}` : ""}`));
  if (d.honours.length) lines.push("\nHonours & awards:", ...d.honours.map((c) => `- ${c.text}${c.year ? ` · ${c.year}` : ""}`));
  if (d.publications.length) lines.push("\nPublications:", ...d.publications.map((c) => `- ${c.text}${c.year ? ` · ${c.year}` : ""}`));
  if (d.skills.length) lines.push(`\nSkills: ${d.skills.join(", ")}`);
  if (d.languages.length) lines.push(`Languages: ${d.languages.join(", ")}`);
  if (d.posts.length) lines.push("\nRecent posts / activity:", ...d.posts.map((p) => `- ${p.date ? `${p.date}: ` : ""}${p.theme}`));
  if (d.vanity.length) lines.push(`\nVanity / status (leave out): ${d.vanity.join("; ")}`);
  return lines.join("\n");
}

/* --------------------------- deterministic merge --------------------------- */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(ltd|limited|inc|llc|pvt|private|technologies|technology|solutions|india)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const STOP = new Set(["of", "the", "and", "in", "at", "for", "a", "an", "&"]);
const RANK = ["intern", "junior", "associate", "senior", "lead", "staff", "principal", "manager", "head", "director", "vp", "vice", "chief", "founder", "president", "cxo", "ceo", "cto", "coo"];

function words(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((w) => w && !STOP.has(w));
}

/** Same company? Tolerant of suffixes and spelling. */
function similar(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const xa = new Set(words(a));
  const ya = new Set(words(b));
  const inter = [...xa].filter((w) => ya.has(w)).length;
  return inter / Math.min(xa.size, ya.size) >= 0.6;
}

/** Same role? Strict: a seniority word on one side only (Senior vs plain, Director vs Head) means a different role. */
function sameRole(a: string, b: string): boolean {
  const xa = words(a);
  const ya = words(b);
  if (!xa.length || !ya.length) return false;
  const rankA = xa.filter((w) => RANK.includes(w)).sort().join(" ");
  const rankB = ya.filter((w) => RANK.includes(w)).sort().join(" ");
  if (rankA !== rankB) return false;
  const sa = new Set(xa);
  const sb = new Set(ya);
  const inter = [...sa].filter((w) => sb.has(w)).length;
  return inter / Math.max(sa.size, sb.size) >= 0.6;
}

/** Folds LinkedIn's dated roles into the profile: exact dates win, missing roles are added, nothing is dropped. */
export function mergeLinkedIn(profile: Profile, li: LinkedInData, source = "LinkedIn"): { profile: Profile; added: string[]; updated: string[] } {
  const p: Profile = structuredClone(profile);
  const added: string[] = [];
  const updated: string[] = [];
  for (const r of li.experience) {
    const match = p.experience.find((e) => similar(e.company, r.company) && sameRole(e.title, r.title) && !(e.source?.includes(source) && e.start && e.start !== r.start));
    if (match) {
      const changes: string[] = [];
      if (r.start && r.start !== match.start) {
        match.start = r.start;
        changes.push("start date");
      }
      if (r.end && r.end !== match.end) {
        match.end = r.end;
        changes.push("end date");
      }
      if (r.location && !match.location) match.location = r.location;
      if (!match.source?.includes(source)) match.source = [...(match.source ?? []), source];
      if (changes.length) updated.push(`${r.title}, ${r.company} — ${changes.join(" and ")} set to ${r.start ?? "?"} – ${r.end ?? "?"}`);
    } else {
      const e: Experience = { id: uid("x"), title: r.title, company: r.company, location: r.location, start: r.start, end: r.end ?? "present", bullets: [], source: [source] };
      if (r.description) e.bullets.push({ id: uid("b"), text: r.description.split(/(?<=[.!?])\s+/)[0]?.slice(0, 220) ?? r.description.slice(0, 220), source });
      p.experience.push(e);
      added.push(`${r.title}, ${r.company} · ${r.start ?? "?"} – ${r.end ?? "present"}`);
    }
  }
  for (const ed of li.education) if (ed.school && !p.education.some((e) => similar(e.school, ed.school))) p.education.push({ id: uid("e"), degree: ed.degree, school: ed.school, year: ed.year });
  const pushSimple = (list: { id: string; text: string; year?: string; source?: string }[], items: { text: string; year?: string }[]) => {
    for (const it of items) if (it.text && !list.some((l) => similar(l.text, it.text))) list.push({ id: uid("s"), text: it.text, year: it.year, source });
  };
  pushSimple(p.certifications, li.certifications);
  pushSimple(p.awards, li.honours);
  pushSimple(p.publications, li.publications);
  for (const s of li.skills) if (s && !p.skills.some((x) => similar(x, s))) p.skills.push(s);
  for (const l of li.languages) if (l && !p.languages.includes(l)) p.languages.push(l);
  if (li.headline && (!p.headline || p.headline.length < 12)) p.headline = li.headline.split("|")[0].trim();
  if (li.location && !p.location) p.location = li.location;
  if (li.name && !p.name) p.name = li.name;
  for (const post of li.posts) if (post.theme) p.facts.push({ id: uid("f"), text: `Recent LinkedIn activity: ${post.theme}`, source, period: post.date });
  if (li.about) p.facts.push({ id: uid("f"), text: `LinkedIn About: ${li.about.slice(0, 600)}`, source });
  // most recent first
  const key = (e: Experience) => (!e.end || /present/i.test(e.end) ? "9999-99" : e.end.padEnd(7, "-12"));
  p.experience.sort((a, b) => key(b).localeCompare(key(a)) || (b.start ?? "").localeCompare(a.start ?? ""));
  return { profile: p, added, updated };
}

/**
 * Deterministic clean-up: entries at the same company whose titles overlap are one role.
 * The entry with LinkedIn-sourced dates wins the dates; bullets, sources and locations are unioned.
 */
export function consolidateExperience(profile: Profile): Profile {
  const p: Profile = structuredClone(profile);
  const out: Experience[] = [];
  for (const e of p.experience) {
    const bothLinkedIn = (o: Experience) => o.source?.includes("LinkedIn") && e.source?.includes("LinkedIn");
    const dup = out.find((o) => similar(o.company, e.company) && sameRole(o.title, e.title) && !bothLinkedIn(o));
    if (!dup) {
      out.push(e);
      continue;
    }
    const liA = dup.source?.includes("LinkedIn");
    const liB = e.source?.includes("LinkedIn");
    const winner = liB && !liA ? e : dup;
    const loser = winner === dup ? e : dup;
    const merged: Experience = {
      ...winner,
      id: dup.id,
      title: winner.title.length >= loser.title.length || liB !== liA ? winner.title : loser.title,
      start: winner.start ?? loser.start,
      end: winner.end ?? loser.end,
      location: winner.location ?? loser.location,
      source: [...new Set([...(dup.source ?? []), ...(e.source ?? [])])],
      bullets: dedupeBullets([...dup.bullets, ...e.bullets]),
    };
    out[out.indexOf(dup)] = merged;
  }
  p.experience = out;
  const key = (x: Experience) => (!x.end || /present/i.test(x.end) ? "9999-99" : x.end.padEnd(7, "-12"));
  p.experience.sort((a, b) => key(b).localeCompare(key(a)) || (b.start ?? "").localeCompare(a.start ?? ""));
  return p;
}

function dedupeBullets(list: Experience["bullets"]): Experience["bullets"] {
  const out: Experience["bullets"] = [];
  for (const b of list) if (b.text && !out.some((o) => similar(o.text, b.text))) out.push(b);
  return out;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12" };
export function normDate(d?: string): string | undefined {
  if (!d) return undefined;
  const s = String(d).trim();
  if (/present|current|now|till date/i.test(s)) return "present";
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{4})/);
  if (m) {
    const mm = MONTHS[m[1].slice(0, 3).toLowerCase()];
    return mm ? `${m[2]}-${mm}` : m[2];
  }
  m = s.match(/(\d{4})/);
  return m ? m[1] : undefined;
}
function normEnd(d?: string): string | undefined {
  const n = normDate(d);
  return n ?? (d ? undefined : "present");
}
