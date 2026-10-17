import * as cheerio from "cheerio";
import { research } from "./ai/openrouter";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 MosaicResearch/1.0";

export interface PageRead {
  url: string;
  title: string;
  text: string;
  via: "fetch" | "search";
}

/** Reads a page's visible text. Falls back to web-grounded summarisation when a site blocks bots (LinkedIn, Medium). */
export async function readPage(url: string, hint?: string): Promise<PageRead> {
  const direct = await fetchVisibleText(url).catch(() => null);
  if (direct && direct.text.length > 400 && !looksLikeWall(direct.text)) return direct;
  const res = await research(
    `Open and read this exact page: ${url}\n${hint ? `It is believed to be: ${hint}\n` : ""}Report, as plain text and as completely as you can, the professional content on it: name, headline, roles with companies and dates, descriptions of work, numbers/metrics, talks, articles, projects, education, certifications, awards. Also report anything that looks personal or irrelevant to a career (so it can be left out). If the page is unavailable, say exactly "PAGE UNAVAILABLE" and describe what search results say about it instead.`,
    "You read web pages for a resume assistant. Report only what the page actually says. Never invent roles, dates or numbers.",
    3000,
  );
  return { url, title: direct?.title || hostOf(url), text: res.content, via: "search" };
}

function looksLikeWall(t: string) {
  return /sign in to|join linkedin|log in to continue|enable javascript|access denied|captcha|just a moment/i.test(t.slice(0, 1500)) && t.length < 3000;
}

export async function fetchVisibleText(url: string): Promise<PageRead> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" }, redirect: "follow", signal: ctrl.signal });
    const ctype = res.headers.get("content-type") ?? "";
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    if (!ctype.includes("html")) return { url, title: hostOf(url), text: raw.slice(0, 20000), via: "fetch" };
    const $ = cheerio.load(raw);
    $("script, style, noscript, svg, nav, footer, header, iframe, form, [role=navigation], [aria-hidden=true]").remove();
    const title = $("title").first().text().trim() || $("h1").first().text().trim() || hostOf(url);
    const root = $("main").length ? $("main") : $("article").length ? $("article") : $("body");
    const text = root
      .text()
      .replace(/\s+\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
      .slice(0, 20000);
    return { url, title, text, via: "fetch" };
  } finally {
    clearTimeout(t);
  }
}

/** Google grounding returns redirect links; resolve them to the real page so people see where they're going. */
export async function resolveRedirect(url: string): Promise<string> {
  if (!/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect/.test(url)) return url;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA } });
    return res.url && !/vertexaisearch/.test(res.url) ? res.url : url;
  } catch {
    try {
      const res = await fetch(url, { method: "GET", redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": UA } });
      const loc = res.headers.get("location");
      return loc ?? url;
    } catch {
      return url;
    }
  } finally {
    clearTimeout(t);
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function sourceNameFor(url: string): { source: string; kind: string } {
  const h = hostOf(url);
  if (h.includes("linkedin.com")) return { source: "LinkedIn", kind: "Profile" };
  if (h.includes("github.com")) return { source: "GitHub", kind: "Code" };
  if (h.includes("medium.com") || h.includes("substack.com") || h.includes("dev.to") || h.includes("hashnode")) return { source: h.includes("medium") ? "Medium" : h.includes("substack") ? "Substack" : "Blog", kind: "Article" };
  if (h.includes("scholar.google") || h.includes("arxiv.org") || h.includes("researchgate") || h.includes("acm.org") || h.includes("ieee.org")) return { source: "Scholar", kind: "Paper" };
  if (h.includes("youtube.com") || h.includes("youtu.be") || h.includes("sessionize") || h.includes("confengine") || h.includes("meetup")) return { source: h.includes("sessionize") ? "Sessionize" : h.includes("youtube") || h.includes("youtu.be") ? "YouTube" : h, kind: "Talk" };
  if (h.includes("twitter.com") || h.includes("x.com")) return { source: "X", kind: "Profile" };
  if (h.includes("crunchbase") || h.includes("angel.co") || h.includes("wellfound")) return { source: "Crunchbase", kind: "Profile" };
  return { source: h, kind: "Page" };
}
