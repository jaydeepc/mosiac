import { chatJSON, decide, todayLabel, chat } from "./openrouter";
import { findCandidatesDeep, describeUrl } from "./research";
import { extractLinkedInProfile, structureLinkedInExport, linkedInToText, mergeLinkedIn, consolidateExperience, type LinkedInData } from "./linkedin";
import { config, languageEnglishName } from "../config";
import { readPage, sourceNameFor, hostOf } from "../web";
import { uid } from "../api";
import type { Candidate, Experience, Extraction, Insight, Profile, ProjectDoc, Question, ResumeDoc, Understanding, Bullet } from "../types";
import { emptyProfile } from "../types";

/* ------------------------------------------------------------------ */
/*  Shared voice: how Mosaic writes                                   */
/* ------------------------------------------------------------------ */

const VOICE = `You are Mosaic, an assistant that turns a person's real career into a resume aimed at a specific role.
Principles you never break:
- Impact first. Every bullet opens with the outcome or the scale (what changed, for whom, by how much), then how. Strong, specific verbs: built, cut, grew, shipped, led, launched, turned around, won. Never "helped", "worked on", "responsible for", "involved in".
- Plain, specific, honest. No clichés ("passionate", "visionary", "results-driven", "dynamic", "synergy"), no selling, no adjectives the evidence does not earn. Impact comes from facts and numbers, not from praise.
- Never invent facts, numbers, employers, dates or titles. If something is missing, leave it out or mark it to be confirmed.
- Prefer concrete outcomes with numbers the person actually gave. Keep each bullet to one sentence, ideally under 25 words. Cut filler words.
- Recency matters: the most recent two years carry the most detail; older work compresses to its single most impressive fact.
- Respect the person's language: write in the language you are told to write in, natively (not word-for-word translated).
- Today's date is ${todayLabel()}.`;

function profileForPrompt(p: Profile): string {
  return JSON.stringify(
    {
      name: p.name,
      headline: p.headline,
      location: p.location,
      contact: { email: p.email, phone: p.phone, linkedin: p.linkedin, website: p.website },
      summary: p.summary,
      experience: p.experience.map((e) => ({ id: e.id, title: e.title, company: e.company, location: e.location, start: e.start, end: e.end, source: e.source, bullets: e.bullets.map((b) => ({ id: b.id, text: b.text, confirm: b.confirm })) })),
      education: p.education,
      skills: p.skills,
      strengths: p.strengths,
      speaking: p.speaking,
      publications: p.publications,
      certifications: p.certifications,
      awards: p.awards,
      languages: p.languages,
      facts: p.facts,
    },
    null,
    1,
  );
}

function ensureIds(p: Profile): Profile {
  for (const e of p.experience) {
    e.id ||= uid("x");
    e.bullets ||= [];
    for (const b of e.bullets) b.id ||= uid("b");
    e.source ||= [];
  }
  for (const list of [p.speaking, p.publications, p.certifications, p.awards]) for (const s of list) s.id ||= uid("s");
  for (const ed of p.education) ed.id ||= uid("e");
  for (const f of p.facts) f.id ||= uid("f");
  return p;
}

function coerceProfile(raw: Partial<Profile> | undefined, fallbackName = ""): Profile {
  const base = emptyProfile(fallbackName);
  const p: Profile = {
    ...base,
    ...(raw ?? {}),
    experience: Array.isArray(raw?.experience) ? raw!.experience : [],
    education: Array.isArray(raw?.education) ? raw!.education : [],
    skills: Array.isArray(raw?.skills) ? raw!.skills : [],
    strengths: Array.isArray(raw?.strengths) ? raw!.strengths : [],
    speaking: Array.isArray(raw?.speaking) ? raw!.speaking : [],
    publications: Array.isArray(raw?.publications) ? raw!.publications : [],
    certifications: Array.isArray(raw?.certifications) ? raw!.certifications : [],
    awards: Array.isArray(raw?.awards) ? raw!.awards : [],
    languages: Array.isArray(raw?.languages) ? raw!.languages : [],
    facts: Array.isArray(raw?.facts) ? raw!.facts : [],
  };
  p.name ||= fallbackName;
  return ensureIds(p);
}

/* ------------------------------------------------------------------ */
/*  Stage 2 — understand the old resume                               */
/* ------------------------------------------------------------------ */

export async function understandResume(text: string, fileName: string, pages: number | undefined, readMs: number, userName: string): Promise<{ profile: Profile; understanding: Understanding }> {
  const { data } = await chatJSON<{ profile: Partial<Profile>; understanding: Partial<Understanding> }>({
    model: config.models.writer,
    messages: [
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `Read this old resume carefully and return JSON with two keys.

"profile": the structured facts as they appear (do not embellish):
{ "name", "headline" (their current title/positioning in ≤8 words, or ""), "location", "email", "phone", "linkedin", "website",
  "experience": [{ "title", "company", "location", "start": "YYYY-MM" or "YYYY", "end": "YYYY-MM"|"YYYY"|"present", "bullets": [{"text"}], "source": ["resume"] }] (most recent first),
  "education": [{ "degree", "school", "year" }],
  "skills": [string], "speaking": [{"text","year"}], "publications": [{"text","year"}], "certifications": [{"text","year"}], "awards": [{"text","year"}], "languages": [string],
  "facts": [{"text": one atomic fact worth remembering (numbers, scope, team sizes), "source": "resume", "period": "YYYY"}] }

"understanding": your read of it:
{ "detectedLanguage": ISO 639-1 code of the resume's language,
  "lastUpdated": "YYYY-MM" — the latest date mentioned anywhere (end of most recent role, 'present' means the resume's own date if detectable, else the latest explicit date),
  "lastUpdatedLabel": e.g. "March 2023",
  "gapLabel": how long ago that is from today, e.g. "3½ years ago",
  "seniority": a 3–6 word description of what this reads like, e.g. "senior product leader", "early-career developer", "CXO-level operator", "QA specialist",
  "track": one of "leader" | "builder" | "specialist" — leader = scope/teams/outcomes; builder = things shipped, stack; specialist = depth, methods, certifications,
  "timeline": [{ "period": "2020 – 2023", "text": "Senior Product Manager, Kestrel Payments — led merchant onboarding; team of 9." }] (one line per role/education, most recent first, 3–7 items),
  "note": one or two sentences to the person, e.g. "This reads like a senior product leader's resume. In stage 4 I'll only ask about March 2023 → today — about four questions." Mention the gap only if lastUpdated is more than 6 months ago; otherwise say what you will ask about.,
  "questionBudget": ${config.questionBudget} normally; 2–3 if the resume is recent, 5–6 if the gap is over 5 years }

The resume text:
"""
${text.slice(0, 30000)}
"""`,
      },
    ],
    maxTokens: 6000,
    temperature: 0.1,
  });

  const profile = coerceProfile(data.profile, userName);
  const u = data.understanding ?? {};
  const understanding: Understanding = {
    fileName,
    pages,
    readMs,
    detectedLanguage: u.detectedLanguage ?? "en",
    lastUpdated: u.lastUpdated,
    lastUpdatedLabel: u.lastUpdatedLabel,
    gapLabel: u.gapLabel,
    seniority: u.seniority ?? "professional",
    track: (["leader", "builder", "specialist"] as const).includes(u.track as "leader") ? (u.track as Understanding["track"]) : "builder",
    timeline: Array.isArray(u.timeline) ? u.timeline : [],
    note: u.note ?? "I've read it. Next I'll check what's online, then ask only about what has changed since.",
    questionBudget: typeof u.questionBudget === "number" ? Math.min(8, Math.max(2, u.questionBudget)) : config.questionBudget,
  };
  return { profile, understanding };
}

/* ------------------------------------------------------------------ */
/*  Stage 3a — who is this person online? (deep research)             */
/* ------------------------------------------------------------------ */

export async function findCandidates(project: ProjectDoc): Promise<{ candidates: Candidate[]; pagesChecked: number; intro: string }> {
  return findCandidatesDeep(project);
}

export async function candidateFromUrl(project: ProjectDoc, url: string): Promise<Candidate> {
  const auto = sourceNameFor(url);
  let title = hostOf(url);
  let subtitle: string | undefined;
  let date: string | undefined;
  try {
    const page = await readPage(url);
    const d = await describeUrl(url, page.text);
    title = d.title || title;
    subtitle = d.subtitle;
    date = d.date;
    auto.kind = d.kind || auto.kind;
  } catch {
    /* keep host as title */
  }
  void project;
  return { id: uid("c"), group: /linkedin\.com\/(in|pub)\//.test(url) ? "linkedin" : "web", kind: auto.kind, source: auto.source, title, subtitle, url, date, strength: "possible", why: "Why: you added this link yourself — I'll read it and keep only what fits.", addedByUser: true, selected: true };
}

/* ------------------------------------------------------------------ */
/*  Stage 3b — read a confirmed source; take or leave with reasons    */
/* ------------------------------------------------------------------ */

export async function readSource(project: ProjectDoc, candidate: Candidate, onProgress?: (line: string) => void): Promise<{ extraction: Extraction; profile: Profile }> {
  const t0 = Date.now();
  const isLinkedIn = /linkedin\.com\/(in|pub)\//.test(candidate.url) || candidate.url === "about:linkedin-export";
  let liData: LinkedInData | null = null;
  let liMerge: { added: string[]; updated: string[] } | null = null;
  let page: import("../web").PageRead;
  if (isLinkedIn) {
    onProgress?.(candidate.url === "about:linkedin-export" ? "reading your LinkedIn export…" : "pulling the public profile text — experience, about, recent posts…");
    liData = candidate.url === "about:linkedin-export" ? await structureLinkedInExport(project.linkedinExport?.text ?? "") : await extractLinkedInProfile(candidate.url, project.profile.name);
    const merged = mergeLinkedIn(project.profile, liData);
    liMerge = { added: merged.added, updated: merged.updated };
    project = { ...project, profile: merged.profile };
    page = { url: candidate.url, title: candidate.title, text: linkedInToText(liData), via: "search" };
  } else {
    page = await readPage(candidate.url, `${candidate.title} — ${candidate.subtitle ?? ""}`, project.profile.name);
  }
  // Follow pages the main page points at (a speaker profile → its sessions, a book page → its author bio), one level deep.
  const followed: { url: string; title: string; text: string }[] = [];
  if (page.links?.length) {
    const picks = await pickFollowUps(project, candidate, page.links);
    for (const link of picks.slice(0, 4)) {
      onProgress?.(`also opening ${link.title || hostOf(link.url)}…`);
      try {
        const sub = await readPage(link.url, link.title, project.profile.name);
        if (sub.text.length > 200) followed.push({ url: link.url, title: sub.title || link.title, text: sub.text.slice(0, 6000) });
      } catch {
        /* skip */
      }
    }
  }
  const p = project.profile;
  const u = project.understanding;
  const target = u?.seniority ? `a ${u.seniority}'s resume` : "this person's resume";

  const result = await decide<{
    took: string[];
    leftOut: { text: string; why: string }[];
    willAsk: string[];
    note?: string;
    newExperience: Partial<Experience>[];
    updatedExperience: { id: string; end?: string; title?: string; bullets?: { text: string; confirm?: boolean }[] }[];
    newSpeaking: { text: string; year?: string; confirm?: boolean }[];
    newPublications: { text: string; year?: string }[];
    newCertifications: { text: string; year?: string }[];
    newAwards: { text: string; year?: string }[];
    newFacts: { text: string; period?: string }[];
    headline?: string;
    location?: string;
    linkedin?: string;
  }>(
    `You decide what, from a web page the person confirmed is theirs, belongs in ${target}. You are strict: only things that are evidence of professional work, scope, outcomes, recognition or credentials. Leave out vanity metrics (endorsements, followers), status banners ("open to work"), personal details, and anything that doesn't fit the career — and say why in one plain phrase. Never force-fit. Numbers quoted in talks or articles must be flagged to confirm, not taken as fact.`,
    `The person's current profile (from their resume):
${profileForPrompt(p)}

Resume last updated: ${u?.lastUpdatedLabel ?? "unknown"}. Today: ${todayLabel()}.

Page: ${candidate.title} (${candidate.source}, ${candidate.kind}${candidate.date ? `, ${candidate.date}` : ""}) — ${candidate.url}
Content:
"""
${page.text.slice(0, 14000)}
"""
${followed.length ? `Linked pages I also opened:\n${followed.map((f) => `--- ${f.title} (${f.url})\n${f.text}`).join("\n")}` : ""}

${isLinkedIn ? `This is the person's own LinkedIn profile, already read and structured above; its positions and dates have been merged into the profile (return newExperience: [] — never add positions from it). Focus on: bullets from role descriptions, About-section facts, recent-post themes that show current work, certifications, honours, publications. ${liData?.sourceNote ?? ""}` : ""}
Be exhaustive: if the page lists several talks, articles, roles, posts or projects, enumerate EVERY one with its date (year at least) — do not summarise them as "several talks". Recent items (last two years) matter most and must each be captured. Posts and activity on a LinkedIn profile reveal current focus: distil them into 1–3 facts about what the person works on now.

Return JSON:
{"took": [short phrases describing each piece you are taking and where it goes, e.g. "Head of Product, Jan 2024 – present — a role missing from your 2023 resume"],
 "leftOut": [{"text": what you left out, "why": why, e.g. "not evidence" / "not relevant to the role" / "personal"}],
 "willAsk": [numbers or claims you found that should be confirmed with the person before use],
 "note": only if nothing useful was found: one or two plain sentences explaining why (e.g. "Three college projects from 2015 — real, but a VP Product resume gains nothing from them and loses space."),
 "newExperience": roles on the page that are NOT already in the profile: [{"title","company","location","start":"YYYY-MM"|"YYYY","end":"YYYY-MM"|"present","bullets":[{"text","confirm":bool}]}] (bullets only if the page states what they did; otherwise []),
 "updatedExperience": existing roles to amend by id (e.g. an end date that is now known, or a bullet from the page): [{"id","end","title","bullets":[{"text","confirm"}]}],
 "newSpeaking": [{"text": "Fintech Product Summit 2025 — \\"Onboarding at scale\\"", "year":"2025"}],
 "newPublications": [{"text","year"}], "newCertifications": [{"text","year"}], "newAwards": [{"text","year"}],
 "newFacts": [{"text": atomic sourced fact, "period":"YYYY"}],
 "headline": an improved one-line headline if the page gives a better current positioning (else omit), "location": if newly known, "linkedin": the linkedin URL if this page is their LinkedIn}
If the page is unavailable or clearly not about this person, take nothing and explain in "note".`,
    3500,
  );

  const profile = structuredClone(p);
  const src = candidate.source;
  for (const ne of isLinkedIn ? [] : (result.newExperience ?? [])) {
    if (!ne.title || !ne.company) continue;
    const dup = profile.experience.find((e) => e.company.toLowerCase() === ne.company!.toLowerCase() && e.title.toLowerCase() === ne.title!.toLowerCase());
    if (dup) continue;
    profile.experience.push({ id: uid("x"), title: ne.title, company: ne.company, location: ne.location, start: ne.start, end: ne.end, bullets: (ne.bullets ?? []).map((b) => ({ id: uid("b"), text: b.text, confirm: b.confirm, source: src })), source: [src] });
  }
  for (const up of result.updatedExperience ?? []) {
    const e = profile.experience.find((x) => x.id === up.id);
    if (!e) continue;
    // LinkedIn titles and dates are taken as written; the judge only adds bullets there.
    const authoritative = e.source?.includes("LinkedIn");
    if (up.end && !authoritative) e.end = up.end;
    if (up.title && !authoritative) e.title = up.title;
    for (const b of up.bullets ?? []) if (b.text && !e.bullets.some((x) => x.text === b.text)) e.bullets.push({ id: uid("b"), text: b.text, confirm: b.confirm, source: src });
    if (!e.source?.includes(src)) e.source = [...(e.source ?? []), src];
  }
  const push = (list: { id: string; text: string; year?: string; source?: string; confirm?: boolean }[], items?: { text: string; year?: string; confirm?: boolean }[]) => {
    for (const it of items ?? []) if (it.text && !list.some((l) => l.text.toLowerCase() === it.text.toLowerCase())) list.push({ id: uid("s"), text: it.text, year: it.year, source: src, confirm: it.confirm });
  };
  push(profile.speaking, result.newSpeaking);
  push(profile.publications, result.newPublications);
  push(profile.certifications, result.newCertifications);
  push(profile.awards, result.newAwards);
  for (const f of result.newFacts ?? []) if (f.text) profile.facts.push({ id: uid("f"), text: f.text, source: src, period: f.period });
  if (result.headline) profile.headline = result.headline;
  if (result.location && !profile.location) profile.location = result.location;
  if (result.linkedin && !profile.linkedin) profile.linkedin = result.linkedin;
  if (isLinkedIn && !profile.linkedin && candidate.url.startsWith("http")) profile.linkedin = candidate.url;
  const consolidated = consolidateExperience(profile);
  profile.experience = consolidated.experience;
  sortExperience(profile);

  const liTook = liMerge ? [...liMerge.added.map((a) => `Role from LinkedIn: ${a}`), ...liMerge.updated.map((u) => `Dates fixed from LinkedIn: ${u}`)] : [];
  const extraction: Extraction = {
    candidateId: candidate.id,
    title: `${candidate.source} · ${candidate.title}`,
    status: "done",
    readMs: Date.now() - t0,
    took: [...liTook, ...(result.took ?? []).filter((t) => !liTook.some((l) => l.toLowerCase().includes(t.toLowerCase().slice(0, 30))))],
    leftOut: result.leftOut ?? [],
    willAsk: result.willAsk ?? [],
    followed: followed.map((f) => ({ url: f.url, title: f.title })),
    note: (liData && liData.coverage === "none" ? liData.sourceNote : undefined) || result.note || ((result.took ?? []).length === 0 ? (page.via === "search" && /PAGE UNAVAILABLE/i.test(page.text) ? "I couldn't open this page, so nothing was taken from it." : `Nothing on this page added to what I already know about you — real, but it would only take space in ${target}.`) : undefined),
  };
  return { extraction, profile };
}

function sortExperience(p: Profile) {
  const key = (e: Experience) => (!e.end || /present/i.test(e.end) ? "9999-99" : e.end.padEnd(7, "-12"));
  p.experience.sort((a, b) => key(b).localeCompare(key(a)) || (b.start ?? "").localeCompare(a.start ?? ""));
}

async function pickFollowUps(project: ProjectDoc, candidate: Candidate, links: { url: string; title: string }[]): Promise<{ url: string; title: string }[]> {
  const sameHost = hostOf(candidate.url);
  const shortlist = links
    .filter((l) => /^https?:\/\//.test(l.url) && !/\.(png|jpg|jpeg|gif|svg|pdf|zip|css|js)(\?|$)/i.test(l.url))
    .filter((l) => !/\/(login|signup|signin|privacy|terms|cookie|about|contact|pricing|cart|search)\b/i.test(l.url))
    .slice(0, 80);
  if (shortlist.length === 0) return [];
  try {
    const d = await decide<{ urls: string[] }>(
      `You pick which linked pages are worth opening to learn more about ONE person's professional work (their talks, sessions, articles, books, projects). Prefer pages on the same site that are clearly about this person's own items; skip navigation, other speakers, generic listings and social share links.`,
      `Person: ${project.profile.name}. Current page: ${candidate.title} (${candidate.url}) on ${sameHost}.\nLinks: ${JSON.stringify(shortlist)}\n\nReturn JSON {"urls": up to 4 URLs worth opening, most valuable first; [] if none}`,
      600,
    );
    return (d.urls ?? []).map((u) => shortlist.find((l) => l.url === u)).filter((x): x is { url: string; title: string } => Boolean(x));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Stage 4 — questions about the gap, and absorbing answers          */
/* ------------------------------------------------------------------ */

export async function generateQuestions(project: ProjectDoc): Promise<Question[]> {
  const p = project.profile;
  const u = project.understanding;
  const budget = u?.questionBudget ?? config.questionBudget;
  const lang = languageEnglishName(project.language);
  const willAsk = project.extractions.flatMap((e) => e.willAsk);
  const { data } = await chatJSON<{ questions: { text: string; textLocalized?: string; why: string }[] }>({
    model: config.models.writer,
    messages: [
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `Plan the interview. The person will answer by voice, so ask open, warm, specific questions — one idea each — that a friend who knows their field would ask. Avoid questions the resume already answers.

Profile so far:
${profileForPrompt(p)}

${u ? `Resume last updated ${u.lastUpdatedLabel ?? "unknown"} (${u.gapLabel ?? ""}). Only ask about ${u.lastUpdatedLabel ?? "the recent period"} → today, unless something earlier is clearly missing (e.g. a role with no outcomes at all).` : "There was no old resume: ask about the whole career, most recent first, starting with what they do today."}
${willAsk.length ? `Things found online that need confirming — fold each into a question: ${JSON.stringify(willAsk)}` : ""}

Ask ${budget} questions at most. Good questions name specifics from their profile ("Your LinkedIn mentions the next 10 million small businesses — what did your team actually ship towards that, and what moved?"). Always include one question that asks for numbers (team size, volume, what went up or down) if those are missing.

Return JSON: {"questions": [{"text": the question in English, "textLocalized": the same question written natively in ${lang} (if ${lang} is English, repeat the English), "why": one short phrase on why you're asking}]}`,
      },
    ],
    maxTokens: 2500,
    temperature: 0.4,
  });
  return (data.questions ?? []).slice(0, Math.max(2, budget + 1)).map((q) => ({ id: uid("q"), text: q.text, textLocalized: q.textLocalized, why: q.why, status: "open" as const }));
}

/** Quick, cheap: one italic line showing what is being written as the person speaks. */
export async function liveDraftLine(project: ProjectDoc, question: Question, partialTranscript: string): Promise<string> {
  if (partialTranscript.trim().length < 20) return "";
  try {
    const res = await chat({
      model: config.models.fast,
      messages: [
        { role: "system", content: `${VOICE}\nYou write ONE resume bullet (max 18 words, English, no trailing period) from a partial spoken answer. If there isn't enough yet, return the most concrete fragment so far, ending with an ellipsis.` },
        { role: "user", content: `Question: ${question.text}\nPartial answer (may be in another language): """${partialTranscript.slice(-1500)}"""\nBullet:` },
      ],
      maxTokens: 60,
      temperature: 0.3,
    });
    return res.content.trim().replace(/^[-•*]\s*/, "").slice(0, 160);
  } catch {
    return "";
  }
}

export async function absorbAnswer(project: ProjectDoc, question: Question, answer: string, answerLanguage?: string): Promise<{ profile: Profile; summaryOfChange: string; followUp?: string }> {
  const p = project.profile;
  const { data } = await chatJSON<{
    updatedExperience: { id: string; title?: string; end?: string; start?: string; bullets?: { text: string; confirm?: boolean }[] }[];
    newExperience: Partial<Experience>[];
    newFacts: { text: string; period?: string }[];
    newSkills: string[];
    newSpeaking: { text: string; year?: string }[];
    newCertifications: { text: string; year?: string }[];
    newAwards: { text: string; year?: string }[];
    resolveConfirm: string[];
    headline?: string;
    summaryOfChange: string;
    followUp?: string;
  }>({
    model: config.models.writer,
    messages: [
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `The person answered an interview question by voice. Turn what they said into resume material — in English, regardless of the language they spoke — and merge it into the right places.

Profile so far:
${profileForPrompt(p)}

Question: ${question.text}
Their answer${answerLanguage ? ` (spoken in ${answerLanguage})` : ""}:
"""
${answer.slice(0, 12000)}
"""

Rules: write 1–4 bullets, each one sentence, concrete, using only numbers they said. If they estimated ("about a third"), keep the estimate and set confirm:true. If the answer resolves something previously marked confirm, list that bullet id in resolveConfirm (and provide the corrected text as a bullet). If they describe a role not in the profile, add it to newExperience. Don't repeat bullets that already exist.

Return JSON: {"updatedExperience": [{"id": existing role id, "title"?, "start"?, "end"?, "bullets": [{"text","confirm"}]}], "newExperience": [{"title","company","location","start","end","bullets":[{"text","confirm"}]}], "newFacts": [{"text","period"}], "newSkills": [string], "newSpeaking": [{"text","year"}], "newCertifications": [{"text","year"}], "newAwards": [{"text","year"}], "resolveConfirm": [bullet ids], "headline": only if their answer changes how they should be positioned today, "summaryOfChange": one short sentence to show the person what you placed, e.g. "Added two bullets under Head of Product — the five-minute onboarding rebuild and the team growth to 14.", "followUp": only if one crucial number or detail is missing, a single short follow-up question; otherwise omit}`,
      },
    ],
    maxTokens: 3000,
    temperature: 0.3,
  });

  const profile = structuredClone(p);
  for (const up of data.updatedExperience ?? []) {
    const e = profile.experience.find((x) => x.id === up.id);
    if (!e) continue;
    if (up.title) e.title = up.title;
    if (up.start) e.start = up.start;
    if (up.end) e.end = up.end;
    for (const b of up.bullets ?? []) if (b.text && !e.bullets.some((x) => x.text === b.text)) e.bullets.push({ id: uid("b"), text: b.text, confirm: b.confirm, source: "talk" });
    if (!e.source?.includes("talk")) e.source = [...(e.source ?? []), "talk"];
  }
  for (const ne of data.newExperience ?? []) {
    if (!ne.title || !ne.company) continue;
    profile.experience.push({ id: uid("x"), title: ne.title, company: ne.company, location: ne.location, start: ne.start, end: ne.end ?? "present", bullets: (ne.bullets ?? []).map((b) => ({ id: uid("b"), text: b.text, confirm: b.confirm, source: "talk" })), source: ["talk"] });
  }
  for (const id of data.resolveConfirm ?? []) {
    for (const e of profile.experience) for (const b of e.bullets) if (b.id === id) b.confirm = false;
  }
  for (const f of data.newFacts ?? []) if (f.text) profile.facts.push({ id: uid("f"), text: f.text, source: "talk", period: f.period });
  for (const s of data.newSkills ?? []) if (s && !profile.skills.includes(s)) profile.skills.push(s);
  const push = (list: { id: string; text: string; year?: string; source?: string }[], items?: { text: string; year?: string }[]) => {
    for (const it of items ?? []) if (it.text && !list.some((l) => l.text.toLowerCase() === it.text.toLowerCase())) list.push({ id: uid("s"), text: it.text, year: it.year, source: "talk" });
  };
  push(profile.speaking, data.newSpeaking);
  push(profile.certifications, data.newCertifications);
  push(profile.awards, data.newAwards);
  if (data.headline) profile.headline = data.headline;
  sortExperience(profile);
  return { profile, summaryOfChange: data.summaryOfChange ?? "Placed in your Mosaic.", followUp: data.followUp };
}

/* ------------------------------------------------------------------ */
/*  Stage 5 — aim                                                      */
/* ------------------------------------------------------------------ */

export async function suggestAim(project: ProjectDoc): Promise<{ roleSuggestions: string[]; shape: ProjectDoc["shape"]; shapeReason: string; defaultRole: string }> {
  const p = project.profile;
  const u = project.understanding;
  const data = await decide<{ roleSuggestions: string[]; shape: "leader" | "builder" | "specialist"; shapeReason: string; defaultRole: string }>(
    `You infer, from evidence, which roles a person's career points to next, and how their story should read (leader / builder / specialist). Be grounded in their actual level: a CXO gets CXO roles, a QA specialist gets QA roles, a new graduate gets entry roles.`,
    `Profile:
${profileForPrompt(p)}
Seniority read from the old resume: ${u?.seniority ?? "unknown"}; track: ${u?.track ?? "unknown"}.

Return JSON: {"roleSuggestions": 3 short role targets ordered by fit, each ≤6 words and including the domain, e.g. "VP Product, fintech" / "Head of Product, B2B SaaS" / "CPO, early-stage",
"defaultRole": a fuller version of the first suggestion with geography if known, e.g. "VP Product — fintech, India",
"shape": "leader" (scope, teams, outcomes first; tools last) | "builder" (what they shipped, with what, and the stack) | "specialist" (depth, certifications, methods, precision),
"shapeReason": one sentence, e.g. "I chose Leader from your last resume and the role."}`,
    800,
  );
  return {
    roleSuggestions: (data.roleSuggestions ?? []).slice(0, 3),
    shape: (["leader", "builder", "specialist"] as const).includes(data.shape) ? data.shape : (u?.track ?? "builder"),
    shapeReason: data.shapeReason ?? "",
    defaultRole: data.defaultRole ?? data.roleSuggestions?.[0] ?? "",
  };
}

export async function insightsForRole(project: ProjectDoc, role: string, jobDescription?: string): Promise<Insight[]> {
  const p = project.profile;
  const { data } = await chatJSON<{ insights: { tone: "good" | "warn"; title: string; text: string; askPrompt?: string }[] }>({
    model: config.models.writer,
    messages: [
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `Give exactly three things you noticed about this person's story for the target role. One should be their strongest card and how you'll lead with it. One should be a gap that this kind of role usually asks about (tone "warn") with a 30-second way to fix it. One should be a structural call (what to shrink or merge to fit two pages).

Profile:
${profileForPrompt(p)}

Target role: ${role}
${jobDescription ? `Job description pasted by the person:\n"""${jobDescription.slice(0, 6000)}"""\nUse its language and must-haves when judging fit.` : ""}

Return JSON: {"insights": [{"tone": "good"|"warn", "title": ≤8 words ending with a full stop, e.g. "Scale is your strongest card.", "text": one or two sentences of plain explanation, "askPrompt": for the "warn" item only — the 30-second question to ask them, e.g. "In 30 seconds: did you own a budget, pricing or revenue number? Roughly what size?"}]}`,
      },
    ],
    maxTokens: 1200,
    temperature: 0.4,
  });
  return (data.insights ?? []).slice(0, 3).map((i, idx) => ({ n: idx + 1, tone: i.tone === "warn" ? "warn" : "good", title: i.title, text: i.text, askPrompt: i.askPrompt }));
}

/* ------------------------------------------------------------------ */
/*  Stage 7 — craft the resume                                         */
/* ------------------------------------------------------------------ */

export async function craftResume(project: ProjectDoc, language: string, look: "visual" | "classic"): Promise<ResumeDoc> {
  const p = project.profile;
  const lang = languageEnglishName(language);
  const { data } = await chatJSON<Partial<ResumeDoc>>({
    model: config.models.writer,
    messages: [
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `Write the final two-page resume as JSON, in ${lang} (write natively; proper nouns stay as they are). Aim it at: ${project.targetRole ?? "the person's natural next role"}. Shape: ${project.shape ?? "leader"} (${project.shape === "builder" ? "what they shipped, with what, and the stack" : project.shape === "specialist" ? "depth, certifications, methods, precision" : "scope, teams, outcomes first; tools last"}). Look: ${look} (${look === "visual" ? "include 1–2 charts drawn ONLY from numbers the person gave or confirmed, and 3–5 strengths with levels from evidence density" : "no charts; strengths may be empty; skills list matters more"}).
${project.jobDescription ? `Job description to aim at:\n"""${project.jobDescription.slice(0, 6000)}"""` : ""}
${project.insights?.length ? `Decisions already shown to the person: ${project.insights.map((i) => `${i.title} ${i.text}`).join(" | ")}` : ""}

Everything you may use (do not add anything not here):
${profileForPrompt(p)}

Two-page budget: roughly 650–800 words total. Most recent two roles get 3–5 bullets each; older roles get 1–2 bullets or one line; roles older than ~10 years can shrink to one line. Summary: 3–4 sentences, first person implied (no "I"), no clichés, ending with what they are looking for only if the target role makes it natural. Keep every bullet one sentence. Keep bullet ids from the profile where you reuse text; new bullets get no id. Mark any bullet or chart value that rests on an unconfirmed estimate with confirm:true.

Return JSON (all keys present, use [] when empty):
{"name", "headline": ≤8 words positioning for the target role, "location", "contact": {"email","phone","linkedin","website"},
 "summary": string,
 "experience": [{"id","title","company","location","start","end","bullets":[{"id","text","confirm"}]}],
 "education": [{"id","degree","school","year"}],
 "strengths": [{"label": ≤3 words, "level": 40–100}],
 "skills": [string] (8–14, ordered by relevance to the role),
 "speaking": [{"id","text","year","confirm"}], "publications": [{"id","text","year"}], "certifications": [{"id","text","year"}], "awards": [{"id","text","year"}], "languages": [string],
 "charts": [{"id","title": e.g. "Merchants onboarded, by year", "type":"bar", "unit": "count"|"%"|"₹ Cr"|..., "series":[{"label":"2022","value":250000,"confirm":false}], "note": "Chart drawn from what you told me" or a confirm note}],
 "confirmations": [{"id","where": section or bullet id, "text": what needs confirming}],
 "checks": {"twoPages": true, "plainLanguage": true}}`,
      },
    ],
    maxTokens: 7000,
    temperature: 0.35,
  });
  return coerceResume(data, project, language, look);
}

function coerceResume(d: Partial<ResumeDoc>, project: ProjectDoc, language: string, look: "visual" | "classic"): ResumeDoc {
  const p = project.profile;
  const withIds = <T extends { id?: string }>(arr: T[] | undefined, prefix: string): (T & { id: string })[] => (Array.isArray(arr) ? arr : []).map((x) => ({ ...x, id: x.id || uid(prefix) }));
  const exp: Experience[] = withIds(d.experience as Experience[] | undefined, "x").map((e) => ({ ...e, bullets: withIds(e.bullets as Bullet[] | undefined, "b") }));
  return {
    look,
    language,
    name: d.name || p.name,
    headline: d.headline || p.headline || "",
    location: d.location ?? p.location,
    contact: { email: d.contact?.email ?? p.email, phone: d.contact?.phone ?? p.phone, linkedin: d.contact?.linkedin ?? p.linkedin, website: d.contact?.website ?? p.website },
    summary: d.summary ?? p.summary ?? "",
    experience: exp.length ? exp : p.experience,
    education: withIds(d.education, "e").length ? withIds(d.education, "e") : p.education,
    strengths: look === "visual" ? (Array.isArray(d.strengths) ? d.strengths.slice(0, 5) : p.strengths) : (Array.isArray(d.strengths) ? d.strengths : []),
    skills: Array.isArray(d.skills) ? d.skills : p.skills,
    speaking: withIds(d.speaking, "s"),
    publications: withIds(d.publications, "s"),
    certifications: withIds(d.certifications, "s"),
    awards: withIds(d.awards, "s"),
    languages: Array.isArray(d.languages) ? d.languages : p.languages,
    charts: look === "visual" ? withIds(d.charts, "ch").filter((c) => Array.isArray(c.series) && c.series.length >= 2).slice(0, 2) : [],
    confirmations: withIds(d.confirmations, "cf"),
    checks: { twoPages: true, plainLanguage: true },
  };
}

/** Editorial pass: every line rewritten for force and clarity, facts untouched. */
export async function sharpenResume(project: ProjectDoc, doc: ResumeDoc): Promise<ResumeDoc> {
  const lang = languageEnglishName(doc.language);
  const { data } = await chatJSON<{ headline?: string; summary?: string; experience?: { id: string; bullets: { id: string; text: string; confirm?: boolean }[] }[] }>({
    model: config.models.writer,
    messages: [
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `You are the final editor of this resume, aimed at: ${project.targetRole ?? "the next role"}. Language: ${lang}. Make every line land harder WITHOUT adding or changing a single fact, number, name or date.

Rules for each bullet: outcome or scale first, then the how; one strong verb; cut filler ("responsible for", "worked on", "various", "successfully"); under 25 words; keep "confirm" flags exactly as they are. The headline: ≤8 words that position the person for the target role using their strongest real credential. The summary: 3–4 tight sentences, the first one carrying the single most impressive fact.

Resume JSON:
${JSON.stringify({ headline: doc.headline, summary: doc.summary, experience: doc.experience.map((e) => ({ id: e.id, title: e.title, company: e.company, bullets: e.bullets })) })}

Return JSON: {"headline": string, "summary": string, "experience": [{"id": same id, "bullets": [{"id": same id, "text": rewritten, "confirm": same}]}]} — same number of bullets per role, same ids, same order.`,
      },
    ],
    maxTokens: 5000,
    temperature: 0.35,
  });
  const next: ResumeDoc = { ...doc };
  if (data.headline) next.headline = data.headline;
  if (data.summary) next.summary = data.summary;
  if (Array.isArray(data.experience)) {
    next.experience = doc.experience.map((e) => {
      const upd = data.experience!.find((x) => x.id === e.id);
      if (!upd || !Array.isArray(upd.bullets) || upd.bullets.length !== e.bullets.length) return e;
      return { ...e, bullets: e.bullets.map((b, i) => ({ ...b, text: upd.bullets[i]?.text || b.text })) };
    });
  }
  return next;
}

/** Rewrites one section in response to a comment. Returns the new doc + a one-line explanation. */
export async function applyComment(project: ProjectDoc, doc: ResumeDoc, sectionId: string, sectionLabel: string, comment: string): Promise<{ doc: ResumeDoc; resolution: string }> {
  const lang = languageEnglishName(doc.language);
  const { data } = await chatJSON<{ patch: Partial<ResumeDoc>; resolution: string }>({
    model: config.models.writer,
    messages: [
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `The person commented on one section of their resume. Rewrite ONLY what the comment asks for, in ${lang}, keeping everything else exactly as it is. If the comment adds a new fact (a number, a role, a date), use it. If it asks to remove something, remove it. If it asks for tone, fix tone without changing facts.

Section commented on: ${sectionLabel} (id "${sectionId}")
Comment: """${comment}"""

The full resume JSON:
${JSON.stringify(doc)}

Also available evidence (don't add anything not here or in the comment):
${profileForPrompt(project.profile)}

Return JSON: {"patch": an object containing ONLY the top-level resume keys you changed, with their complete new values (e.g. {"summary": "..."} or {"experience": [...all roles...]} or {"charts": [...]} or {"name": "...", "headline": "..."}),
"resolution": one plain sentence telling the person what you did, e.g. "Rewritten — dropped \\"visionary\\" and \\"passionate\\", kept the million-merchant fact."}`,
      },
    ],
    maxTokens: 5000,
    temperature: 0.3,
  });
  const patch = data.patch ?? {};
  const next: ResumeDoc = { ...doc, ...patch, look: doc.look, language: doc.language };
  if (patch.experience) next.experience = (patch.experience as Experience[]).map((e) => ({ ...e, id: e.id || uid("x"), bullets: (e.bullets ?? []).map((b) => ({ ...b, id: b.id || uid("b") })) }));
  return { doc: next, resolution: data.resolution ?? "Updated." };
}

/** Writes the whole resume natively in another language (not a translation pass). */
export async function craftInLanguage(project: ProjectDoc, doc: ResumeDoc, language: string): Promise<ResumeDoc> {
  const lang = languageEnglishName(language);
  const { data } = await chatJSON<Partial<ResumeDoc>>({
    model: config.models.writer,
    messages: [
      { role: "system", content: VOICE },
      {
        role: "user",
        content: `Rewrite this resume natively in ${lang} — the way a strong ${lang}-speaking professional would write their own resume for ${project.targetRole ?? "this role"} — not a word-for-word translation. Keep the same facts, numbers, structure, ids and ordering. Proper nouns (companies, products, schools) stay as written unless they have a standard ${lang} form. Chart labels and strengths translate too; chart values do not change.

${JSON.stringify(doc)}

Return the complete resume JSON with the same keys.`,
      },
    ],
    maxTokens: 7000,
    temperature: 0.3,
  });
  const out = coerceResume(data, project, language, doc.look);
  // keep ids aligned with source where possible
  return { ...out, charts: doc.charts.map((c, i) => ({ ...c, ...(out.charts[i] ?? {}), id: c.id, series: c.series.map((s, j) => ({ ...s, label: out.charts[i]?.series?.[j]?.label ?? s.label })) })) };
}

/* ------------------------------------------------------------------ */
/*  Summary written at stage 5 so the preview fills in                 */
/* ------------------------------------------------------------------ */

export async function writeSummary(project: ProjectDoc, role: string): Promise<string> {
  const res = await chat({
    model: config.models.writer,
    messages: [
      { role: "system", content: VOICE },
      { role: "user", content: `Write the 3–4 sentence summary paragraph for this person's resume aimed at: ${role}. English. Plain, specific, uses only facts below, no clichés, no "I". Output the paragraph only.\n\n${profileForPrompt(project.profile)}` },
    ],
    maxTokens: 400,
    temperature: 0.4,
  });
  return res.content.trim();
}
