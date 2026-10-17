# Mosaic — your story, pieced together

An AI‑native, voice‑first application that turns a person's real career into a two‑page story aimed at a specific role. Upload an old resume (any language), confirm what is really you online, talk about the years in between, aim at a role, pick a look, refine by commenting on sections, and download as PDF or DOCX.

Built with Next.js 16 (App Router), MongoDB, and OpenRouter models. Every model is a one‑line change in `.env.local`.

## The eight stages

| # | Stage | What happens |
|---|-------|--------------|
| 1 | Welcome | Painted landing page; language chosen at sign‑in |
| 2 | Upload | Old resume read (PDF/DOCX/text/photo), "What I understood", last‑updated date noticed, question budget set. Web research starts in the background. |
| 3a | Is this you? | Look‑alikes grouped by source (several LinkedIn profiles with the same name); strength + plain "why". Tick what is yours; paste links Mosaic missed. |
| 3b | Reading what you ticked | Every confirmed page is opened. For each: **Took / Left out (and why) / Will ask you first**. Nothing is force‑fitted; "Use anyway" overrides. |
| 4 | Tell me more | Voice‑first interview, about four questions, only about the gap. Live transcription in any language (chunked, so an hour‑long answer is fine), "writing as you speak" on the preview. Type instead, skip, ask in your language. |
| 5 | Aim | Role suggestions from evidence, paste a job description, story shape (Leader / Builder / Specialist), three insights incl. a 30‑second voice follow‑up for gaps. Summary written here. |
| 6 | Look | Visual (charts, timeline, strengths, optional photo) or Classic. Second‑language version, written natively. |
| 7 | Craft | Resume written; click any section → comment by voice or text → only that part is rewritten; undo. Visual / Classic and language toggles, page 1 / 2. |
| 8 | Ready | PDF (2 pages, type auto‑tightened), DOCX, second‑language PDF, share link, aim at another role. |

Admin can create users and manage access from **People** (`/admin/users`).

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000. The admin account is created on first run from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

PDF export uses headless Chrome via Puppeteer (downloaded automatically by `npm install`). On a server without it, set `PUPPETEER_EXECUTABLE_PATH`.

## Deploying to Vercel

The app is deployed at **https://mosaic-beta-ochre.vercel.app** (Vercel project `mosaic`, region `bom1`).

```bash
vercel link --project mosaic
vercel env add MONGODB_URI production   # repeat for each variable in .env.example
vercel --prod
```

- MongoDB Atlas → **Network Access** must allow `0.0.0.0/0`: Vercel functions use changing egress IPs, and Atlas answers an unlisted IP with a TLS alert (`SSL alert number 80`).
- PDF export runs headless Chromium from `@sparticuz/chromium` (Node 22). Vercel's bundler drops the packed binary, so the first export on a cold instance downloads the matching pack (~70 MB) into `/tmp`; later exports reuse it. Override the pack with `CHROMIUM_PACK_URL`.
- `vercel.json` sets 300 s / 1769 MB for the API routes. The Hobby plan clamps durations to its own limit.
- `APP_URL` is optional on Vercel; the production URL is derived from `VERCEL_PROJECT_PRODUCTION_URL`.

## Configuration (`.env.local`)

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI`, `MONGODB_DB` | MongoDB connection |
| `AUTH_SECRET` | JWT signing secret for sessions |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Seeded admin account |
| `ALLOW_SELF_SIGNUP` | `true` lets anyone create an account from the sign‑in page (default `false`; admins add people) |
| `OPENROUTER_API_KEY` | OpenRouter key |
| `MODEL_WRITER` | Writes understanding, questions, resume, comments (`google/gemini-3.8-flash`) |
| `MODEL_FAST` | Cheap model for light tasks and live draft lines (`google/gemini-3.5-flash-lite`) |
| `MODEL_DECISION` | Decisioning / judgement calls: is‑this‑you ranking, take‑or‑leave, role inference (`typesafe/jev-router`) |
| `MODEL_RESEARCH` + `WEB_SEARCH_ENGINE` | Web‑grounded research via OpenRouter's `web` plugin. `native` = Google Search grounding for Gemini; `exa` is the cheaper fallback |
| `MODEL_TRANSCRIBE` | Audio transcription + translation (`google/gemini-3.5-flash-lite`) |
| `MODEL_IMAGE`, `IMAGE_QUALITY` | Painted hero art and chart backdrops (`openai/gpt-image-2.5-sunburst`) |
| `QUESTION_BUDGET` | Default number of interview questions |

## How the AI is wired

- **Research** (`src/lib/ai/stages.ts → findCandidates`): two grounded searches (LinkedIn; everything else), redirect resolution, then the decision model ranks each page `strong / possible / unlikely` with a one‑line reason. Same‑name people are kept as "unlikely" so the person can rule them out.
- **Reading** (`readSource`): page text (direct fetch, or grounded summary when a site blocks bots), then a strict take‑or‑leave judgement. Numbers found in talks/articles are flagged *Will ask you first*, never taken as fact.
- **Voice** (`src/lib/recorder.ts`): raw PCM → 16 kHz WAV chunks every ~12 s (or on a pause) → `/api/transcribe`; browser speech recognition adds instant captions when available. Transcripts stay in the spoken script with an English translation.
- **Writing voice**: plain, specific, no clichés, nothing invented; estimates are marked `confirm?` on the page.
- **Colour**: palette pairs differ in lightness as well as hue, and chart bars carry their values, so the Visual look reads with colour‑blindness.

## Design

The UI follows the Mosaic design canvas exactly: paper ground `#FBFAF6`, ink `#1E2430`, teal `#2F6F73`, terracotta `#C9693F` for pins and "confirm?" flags, Newsreader + Manrope, soft watercolour washes that never sit under text. Desktop: guide on the left, "Your Mosaic so far" on the right. Mobile: the same stages with the preview as a sheet.
