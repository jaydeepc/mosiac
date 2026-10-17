import { config } from "../config";

/* ------------------------------------------------------------------ */
/* OpenRouter client: text, structured JSON, grounded research, audio */
/* transcription and image generation. Every model id comes from env. */
/* ------------------------------------------------------------------ */

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean; // force JSON object output
  web?: boolean | { maxResults?: number; engine?: string; includeDomains?: string[] };
  plugins?: Record<string, unknown>[];
  reasoning?: "none" | "low" | "medium" | "high";
  timeoutMs?: number;
  retries?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  citations: { url: string; title?: string; content?: string }[];
  cost?: number;
  raw: unknown;
}

function headers() {
  return {
    Authorization: `Bearer ${config.openrouter.key()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": config.appUrl,
    "X-Title": config.appName,
  };
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const model = opts.model ?? config.models.writer;
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 4000,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  if (opts.reasoning) body.reasoning = { effort: opts.reasoning === "none" ? "low" : opts.reasoning, exclude: true };
  // Jev router and some providers reject unknown fields; keep the body minimal otherwise.
  const plugins: Record<string, unknown>[] = [...(opts.plugins ?? [])];
  if (opts.web) {
    const w = typeof opts.web === "object" ? opts.web : {};
    const plugin: Record<string, unknown> = {
      id: "web",
      max_results: w.maxResults ?? config.web.maxResults,
    };
    const engine = w.engine ?? config.web.engine;
    if (engine && engine !== "auto") plugin.engine = engine;
    if (w.includeDomains?.length) {
      plugin.include_domains = w.includeDomains;
      // Google native search cannot filter domains → let OpenRouter fall back to Exa
      delete plugin.engine;
    }
    plugins.push(plugin);
  }
  if (plugins.length) body.plugins = plugins;

  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 120_000);
    try {
      const res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const data = (await res.json()) as {
        error?: { message?: string; code?: number };
        model?: string;
        usage?: { cost?: number };
        choices?: { message?: { content?: string | ContentPart[]; annotations?: { type: string; url_citation?: { url: string; title?: string; content?: string } }[] } }[];
      };
      if (!res.ok || data.error) {
        const msg = data.error?.message ?? `OpenRouter HTTP ${res.status}`;
        // 4xx that aren't rate limits are not worth retrying
        if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408) throw new Error(msg);
        throw new RetryableError(msg);
      }
      const msg = data.choices?.[0]?.message;
      const content =
        typeof msg?.content === "string"
          ? msg.content
          : Array.isArray(msg?.content)
            ? msg!.content.map((p) => (p.type === "text" ? p.text : "")).join("")
            : "";
      const citations =
        msg?.annotations?.filter((a) => a.type === "url_citation" && a.url_citation).map((a) => a.url_citation!) ?? [];
      return { content, model: data.model ?? model, citations, cost: data.usage?.cost, raw: data };
    } catch (e) {
      lastErr = e;
      const retryable = e instanceof RetryableError || (e as Error)?.name === "AbortError" || /fetch failed|ECONNRESET|ETIMEDOUT/i.test(String((e as Error)?.message));
      if (!retryable || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

class RetryableError extends Error {}

/** Extracts the first JSON value from a model reply (tolerates ``` fences and prose). */
export function extractJSON<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // find the first balanced { } or [ ]
    const start = Math.min(...["{", "["].map((c) => candidate.indexOf(c)).filter((i) => i >= 0));
    if (!isFinite(start)) throw new Error("No JSON found in model reply");
    const open = candidate[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (inStr) {
        if (ch === "\\") i++;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return JSON.parse(candidate.slice(start, i + 1)) as T;
      }
    }
    throw new Error("Unbalanced JSON in model reply");
  }
}

/** Chat and parse a JSON object reply, with one automatic repair attempt. */
export async function chatJSON<T>(opts: Omit<ChatOptions, "json">): Promise<{ data: T; result: ChatResult }> {
  const result = await chat({ ...opts, json: !opts.web, temperature: opts.temperature ?? 0.2 });
  try {
    return { data: extractJSON<T>(result.content), result };
  } catch {
    const repair = await chat({
      model: config.models.fast,
      messages: [
        { role: "system", content: "You convert text into strictly valid JSON. Output JSON only." },
        { role: "user", content: `Return ONLY the JSON contained in the following text, fixing any syntax errors. If it is not JSON, build the JSON object the text describes.\n\n${result.content.slice(0, 20000)}` },
      ],
      json: true,
      maxTokens: opts.maxTokens ?? 4000,
      temperature: 0,
    });
    return { data: extractJSON<T>(repair.content), result };
  }
}

/* ------------------------------ Decisions ------------------------------ */
/** Routed decisioning model (Jev) for judgement calls, falls back to writer. */
export async function decide<T>(system: string, user: string, maxTokens = 2500): Promise<T> {
  const messages: ChatMessage[] = [
    { role: "system", content: `${system}\n\nRespond with a single JSON object and nothing else — no prose, no thinking out loud.` },
    { role: "user", content: user },
  ];
  try {
    const { data } = await chatJSON<T>({ model: config.models.decision, messages, maxTokens, temperature: 0.1, reasoning: "medium" });
    return data;
  } catch (e) {
    console.warn("[decide] decision model failed, falling back to writer:", (e as Error).message);
    const { data } = await chatJSON<T>({ model: config.models.writer, messages, maxTokens, temperature: 0.1 });
    return data;
  }
}

/* ------------------------------ Research ------------------------------ */
export async function research(prompt: string, system?: string, maxTokens = 3500): Promise<ChatResult> {
  return chat({
    model: config.models.research,
    messages: [
      { role: "system", content: system ?? "You are a careful research assistant. Use web search. Only report pages you actually found; never invent URLs." },
      { role: "user", content: prompt },
    ],
    web: true,
    maxTokens: Math.max(maxTokens, 6000),
    temperature: 0.2,
    // Grounded models otherwise spend the whole budget thinking about the search results.
    reasoning: "low",
    timeoutMs: 150_000,
  });
}

/* ---------------------------- Transcription ---------------------------- */
export interface Transcript {
  text: string;
  language: string; // BCP-47-ish code, e.g. "ta"
  languageName: string; // "Tamil"
  translation?: string; // English (or target) translation when different
  empty: boolean;
}

export async function transcribeAudio(wavBase64: string, opts: { hintLanguage?: string; targetLanguage?: string; context?: string }): Promise<Transcript> {
  const target = opts.targetLanguage ?? "en";
  const prompt = `Transcribe this audio exactly as spoken. Keep the original language AND its native script (Devanagari for Hindi/Marathi, Tamil script for Tamil, etc. — never romanise); do not translate inside "text".
${opts.hintLanguage ? `The speaker probably speaks ${opts.hintLanguage}, but detect the real language.` : "Detect the language."}
${opts.context ? `Context: the person is answering this question for their resume: "${opts.context}"` : ""}
If the audio is silence or noise, return empty:true and text "".
Return JSON: {"text": string, "language": "<ISO 639-1 code>", "languageName": "<English name>", "translation": "<translation into ${target} if the spoken language differs, else empty string>", "empty": boolean}`;
  const { data } = await chatJSON<Transcript>({
    model: config.models.transcribe,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "input_audio", input_audio: { data: wavBase64, format: "wav" } },
        ],
      },
    ],
    maxTokens: 3000,
    temperature: 0.1,
    timeoutMs: 90_000,
  });
  return {
    text: (data.text ?? "").trim(),
    language: data.language ?? "en",
    languageName: data.languageName ?? "English",
    translation: data.translation?.trim() || undefined,
    empty: Boolean(data.empty) || !(data.text ?? "").trim(),
  };
}

/* --------------------------- Image generation --------------------------- */
export async function generateImage(prompt: string, opts: { aspect?: string; quality?: string; format?: string } = {}): Promise<{ data: Buffer; mime: string; cost?: number }> {
  const format = opts.format ?? config.image.format;
  const res = await fetch(`${config.openrouter.baseUrl}/images`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: config.models.image,
      prompt,
      aspect_ratio: opts.aspect ?? "3:2",
      quality: opts.quality ?? config.image.quality,
      output_format: format,
    }),
  });
  const json = (await res.json()) as { error?: { message?: string }; data?: { b64_json: string; media_type?: string }[]; usage?: { cost?: number } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Image API HTTP ${res.status}`);
  const img = json.data?.[0];
  if (!img?.b64_json) throw new Error("Image API returned no image");
  return { data: Buffer.from(img.b64_json, "base64"), mime: img.media_type ?? `image/${format}`, cost: json.usage?.cost };
}

/* ------------------------------ Helpers ------------------------------ */
export function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
