import { research, chat, decide, extractJSON } from "./openrouter";
import { config } from "../config";
import { hostOf, resolveRedirect, sourceNameFor } from "../web";
import { uid } from "../api";
import type { Candidate, ProjectDoc } from "../types";

/* ------------------------------------------------------------------ */
/*  Stage 3a — deep research: who is this person online?              */
/*  Many focused searches run in parallel (LinkedIn hunt, talks,       */
/*  podcasts, writing, code/papers, press, latest activity), results   */
/*  are de-duplicated, dated, and judged one by one.                   */
/* ------------------------------------------------------------------ */

export interface RawHit {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

const JSON_TAIL = `Return ONLY a JSON array (no prose) of up to 12 items: [{"title": string, "url": string, "snippet": one or two sentences on what the page says and who it appears to be, "date": "YYYY" or "YYYY-MM" if the page or result shows a date, else ""}]. Only include URLs that appeared in your search results. Include several results even if you are unsure they are the same person — they will be judged separately.`;

function nameVariants(name: string): string[] {
  const parts = name.trim().split(/\s+/);
  const out = new Set<string>([name.trim()]);
  if (parts.length >= 2) {
    out.add(`${parts[0]} ${parts[parts.length - 1]}`);
    // common transliteration swaps for Indian surnames
    const last = parts[parts.length - 1];
    const swaps: [RegExp, string][] = [
      [/barty$/i, "borty"],
      [/borty$/i, "barty"],
      [/^Chakra/i, "Chakra"],
      [/erjee$/i, "erji"],
      [/erji$/i, "erjee"],
      [/ee$/i, "i"],
    ];
    for (const [re, rep] of swaps) if (re.test(last)) out.add(`${parts.slice(0, -1).join(" ")} ${last.replace(re, rep)}`);
  }
  return [...out].slice(0, 3);
}

export async function findCandidatesDeep(project: ProjectDoc): Promise<{ candidates: Candidate[]; pagesChecked: number; intro: string }> {
  const p = project.profile;
  const u = project.understanding;
  const name = p.name;
  const variants = nameVariants(name);
  const quoted = variants.map((v) => `"${v}"`).join(" OR ");
  const current = p.experience[0] ? `${p.experience[0].title} at ${p.experience[0].company}` : p.headline ?? "";
  const companies = [...new Set(p.experience.map((e) => e.company).filter(Boolean))].slice(0, 4);
  const who = [name, p.headline, current, p.location, p.education[0]?.school].filter(Boolean).join(", ");
  const year = new Date().getFullYear();

  const native = (q: string) => research(`${q}\n\n${JSON_TAIL}`, undefined, 6000);
  const exa = (q: string, domains?: string[]) => research(`${q}\n\n${JSON_TAIL}`, "You are a careful research assistant. Use the web search results provided. Only report pages you actually found; never invent URLs. JSON only.", 6000, { engine: "exa", includeDomains: domains, maxResults: 10 });

  const queries: Promise<Awaited<ReturnType<typeof research>>>[] = [
    // LinkedIn hunt: three angles
    native(`Find the LinkedIn profile of ${quoted}${current ? `, ${current}` : ""}${p.location ? `, ${p.location}` : ""}. Search "site:linkedin.com/in ${name}" and "${name} LinkedIn". Also list other LinkedIn profiles with the same or similar name so the person can rule them out. Return every linkedin.com/in/ URL you find.`),
    exa(`${name} LinkedIn profile ${current} ${companies.join(" ")}`.trim(), ["linkedin.com"]),
    exa(`${name} ${p.location ?? ""} ${p.headline ?? ""} profile`.trim(), ["linkedin.com", "x.com", "twitter.com", "crunchbase.com", "wellfound.com"]),
    // Talks and speaker profiles
    native(`Find conference talks, keynotes, panels, speaker profiles and session pages by ${quoted} (${who}). Check Sessionize, ConfEngine, Meetup, YouTube, conference websites (e.g. TestMu, Agile India, Kanban India, The Test Tribe, Selenium Conf, Google DevFest, AWS/Google/Microsoft events) and university events. Include the event year.`),
    exa(`${name} speaker talk keynote session`, ["sessionize.com", "confengine.com", "youtube.com", "meetup.com", "thetesttribe.com", "testmuai.com", "kanbanindia.org", "agileindia.org"]),
    // Podcasts, interviews, webinars
    native(`Find podcast episodes, video interviews, webinars, AMAs and fireside chats featuring ${quoted} (${who}). Include YouTube, Spotify, Apple Podcasts and company webinar pages, with dates.`),
    // Writing: articles, columns, books
    native(`Find articles, columns, blog posts, newsletters and books written by ${quoted} (${who}): Medium, Substack, LinkedIn articles, company blogs (e.g. Thoughtworks Insights), newspapers and magazines (e.g. The Hindu, Open Source For You), book listings (Amazon, Springer, O'Reilly, Apress). Include dates.`),
    // Code, research, credentials
    native(`Find GitHub profiles/repositories, Google Scholar or arXiv papers, patents, certifications or open-source contributions by ${quoted} (${who}).`),
    // Press, company and community pages
    native(`Find press mentions, news articles, company team/leadership pages, award pages, community or meetup organiser pages and alumni pages about ${quoted} (${who})${companies.length ? ` — especially at ${companies.join(", ")}` : ""}.`),
    // Latest activity
    native(`What has ${quoted} (${who}) done most recently — in ${year} and ${year - 1}? Find the newest talks, posts, interviews, role changes, launches or publications, with dates.`),
  ];

  const results = await Promise.allSettled(queries);
  const hits: RawHit[] = [];
  let failed = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") {
      failed++;
      console.warn("[research] query failed:", (r.reason as Error)?.message);
      continue;
    }
    try {
      const arr = extractJSON<RawHit[]>(r.value.content);
      if (Array.isArray(arr)) hits.push(...arr.filter((h) => h && typeof h.url === "string" && /^https?:\/\//.test(h.url)).map((h) => ({ ...h, date: normDate(h.date) })));
    } catch (e) {
      console.warn("[research] unparsable reply:", (e as Error).message);
    }
    for (const c of r.value.citations) if (c.url && !hits.some((h) => h.url === c.url)) hits.push({ title: c.title ?? hostOf(c.url), url: c.url, snippet: c.content?.slice(0, 300) ?? "" });
  }

  await Promise.all(hits.map(async (h) => (h.url = await resolveRedirect(h.url))));
  const seen = new Map<string, RawHit>();
  for (const h of hits) {
    const key = h.url
      .replace(/[?#].*$/, "")
      .replace(/\/$/, "")
      .replace(/^https?:\/\/(www\.)?/, "")
      .toLowerCase();
    if (/linkedin\.com\/(posts|pulse|feed)/.test(key)) continue; // posts are read later via the profile
    const prev = seen.get(key);
    if (!prev) seen.set(key, h);
    else if (!prev.date && h.date) prev.date = h.date;
  }
  const unique = [...seen.values()];
  if (unique.length === 0) return { candidates: [], pagesChecked: 0, intro: "I searched LinkedIn, conference sites, podcasts, publications, GitHub and the press but couldn't find pages that are clearly about you. Paste a link below if you have one." };

  // Judge in batches so nothing gets dropped for length
  const batches: RawHit[][] = [];
  for (let i = 0; i < unique.length; i += 18) batches.push(unique.slice(i, i + 18));
  const personCard = JSON.stringify({ name, nameVariants: variants, headline: p.headline, location: p.location, roles: p.experience.slice(0, 5).map((e) => `${e.title} @ ${e.company} (${e.start ?? ""}–${e.end ?? ""})`), education: p.education.map((e) => `${e.degree} ${e.school}`), speaking: p.speaking.slice(0, 5).map((s) => s.text), lastUpdated: u?.lastUpdatedLabel });

  const judged = await Promise.all(
    batches.map((batch) =>
      decide<{ candidates: (Partial<Candidate> & { keep?: boolean })[] }>(
        `You judge whether web pages belong to a specific person, for a resume assistant. Be honest about uncertainty: when several people share a name, keep the alternatives and explain how you told them apart. Never guess that a page is theirs. Transliteration variants of the same name (e.g. Chakrabarty / Chakraborty) may still be the same person — judge by employer, field, city and dates, not spelling alone.`,
        `The person, from their resume: ${personCard}

Pages found: ${JSON.stringify(batch)}

Return JSON: {"candidates": [{"url", "keep": false for pages that are not about any person with this name (generic listings, unrelated topics) — otherwise true,
 "title": short display title (for LinkedIn use the person's name as written on that page), "subtitle": one line e.g. "Head of Product · Kestrel Payments · Bengaluru" or "Talk at TestMu Conf · 2026",
 "group": "linkedin" if the URL is linkedin.com/in or linkedin.com/pub else "web",
 "kind": "Profile"|"Talk"|"Podcast"|"Article"|"Book"|"Code"|"Paper"|"Press"|"Award"|"Listing"|"Page",
 "source": "LinkedIn"|"Sessionize"|"YouTube"|"Medium"|"GitHub"|"Scholar"|site or publication name,
 "date": "YYYY" or "YYYY-MM" if known from the snippet/title, else "",
 "strength": "strong"|"possible"|"unlikely",
 "why": one sentence starting with "Why:" naming the specific overlap or clash (employer, dates, field, city, co-author)}]}`,
        6000,
      ).catch((e) => {
        console.warn("[research] judge failed:", (e as Error).message);
        return { candidates: [] as (Partial<Candidate> & { keep?: boolean })[] };
      }),
    ),
  );

  const candidates: Candidate[] = [];
  for (const j of judged) {
    for (const c of j.candidates ?? []) {
      if (!c.url || c.keep === false) continue;
      const auto = sourceNameFor(c.url);
      const isLi = /linkedin\.com\/(in|pub)\//.test(c.url);
      const raw = unique.find((h) => h.url === c.url);
      candidates.push({
        id: uid("c"),
        group: isLi ? "linkedin" : "web",
        kind: c.kind ?? auto.kind,
        source: c.source ?? auto.source,
        title: c.title ?? raw?.title ?? hostOf(c.url),
        subtitle: c.subtitle,
        url: c.url,
        strength: (["strong", "possible", "unlikely"] as const).includes(c.strength as "strong") ? (c.strength as Candidate["strength"]) : "possible",
        why: c.why ?? "",
        date: normDate(c.date) || raw?.date,
        selected: c.strength === "strong",
      });
    }
  }
  const order = { strong: 0, possible: 1, unlikely: 2 };
  candidates.sort((a, b) => order[a.strength] - order[b.strength] || (b.date ?? "").localeCompare(a.date ?? ""));
  const li = candidates.filter((c) => c.group === "linkedin").slice(0, 4);
  const web = candidates.filter((c) => c.group === "web").slice(0, 24);
  const final = [...li, ...web];
  const strong = final.filter((c) => c.strength === "strong").length;
  const sources = [...new Set(final.map((c) => c.source))].slice(0, 6).join(", ");
  const intro = `I ran ${queries.length - failed} searches across LinkedIn, conference sites, podcasts, publications, GitHub and the press${sources ? ` (${sources}…)` : ""} — ${unique.length} pages checked, ${final.length} worth showing, ${strong} look like strong matches.`;
  return { candidates: final, pagesChecked: unique.length, intro };
}

function normDate(d?: string): string | undefined {
  if (!d) return undefined;
  const m = String(d).match(/(20\d{2}|19\d{2})(?:[-/.](\d{1,2}))?/);
  if (!m) return undefined;
  return m[2] ? `${m[1]}-${m[2].padStart(2, "0")}` : m[1];
}

/** Fast label for a pasted link. */
export async function describeUrl(url: string, pageText: string): Promise<{ title: string; subtitle: string; kind: string; date?: string }> {
  const res = await chat({
    model: config.models.fast,
    messages: [
      { role: "system", content: "You label web pages. JSON only." },
      { role: "user", content: `Page URL: ${url}\nContent (truncated):\n${pageText.slice(0, 4000)}\n\nReturn {"title": a short display title (≤10 words), "subtitle": one line describing what/who it is, "kind": "Profile"|"Talk"|"Podcast"|"Article"|"Book"|"Code"|"Paper"|"Press"|"Listing"|"Page", "date": "YYYY" or "YYYY-MM" if shown, else ""}` },
    ],
    json: true,
    maxTokens: 300,
  });
  const d = extractJSON<{ title: string; subtitle: string; kind: string; date?: string }>(res.content);
  return { ...d, date: normDate(d.date) };
}
