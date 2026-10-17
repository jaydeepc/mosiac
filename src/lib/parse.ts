import { chat } from "./ai/openrouter";
import { config } from "./config";

/** Extracts text from an uploaded resume (PDF, DOCX, TXT, or an image via the vision model). */
export async function extractResumeText(buffer: Buffer, mime: string, name: string): Promise<{ text: string; pages?: number }> {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      const clean = normalize(text);
      if (clean.replace(/\s/g, "").length > 120) return { text: clean, pages: totalPages };
      // scanned PDF → let the multimodal model read it
      const viaModel = await readWithModel(buffer, "application/pdf", name);
      return { text: viaModel, pages: totalPages };
    } catch (e) {
      console.warn("[parse] unpdf failed, falling back to model:", (e as Error).message);
      return { text: await readWithModel(buffer, "application/pdf", name) };
    }
  }
  if (mime.includes("wordprocessingml") || lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer });
    return { text: normalize(res.value) };
  }
  if (mime.startsWith("image/")) {
    return { text: await readWithModel(buffer, mime, name) };
  }
  if (mime.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".rtf")) {
    return { text: normalize(buffer.toString("utf8")) };
  }
  // .doc and anything else: try as text, else model
  const asText = buffer.toString("utf8");
  if (/[A-Za-z]{3,}/.test(asText) && asText.replace(/[^\x20-\x7E\n]/g, "").length > asText.length * 0.6) return { text: normalize(asText) };
  return { text: await readWithModel(buffer, mime || "application/octet-stream", name) };
}

async function readWithModel(buffer: Buffer, mime: string, name: string): Promise<string> {
  const b64 = buffer.toString("base64");
  const part = mime.startsWith("image/")
    ? ({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } } as const)
    : ({ type: "file", file: { filename: name, file_data: `data:${mime};base64,${b64}` } } as const);
  const res = await chat({
    model: config.models.writer,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "This is someone's resume/CV. Transcribe ALL of its text faithfully in reading order, preserving section headings, dates, bullet points and the original language. Output plain text only." },
          part,
        ],
      },
    ],
    maxTokens: 8000,
    temperature: 0,
    plugins: mime === "application/pdf" ? [{ id: "file-parser", pdf: { engine: "native" } }] : undefined,
  });
  return normalize(res.content);
}

export function normalize(t: string): string {
  return t
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
