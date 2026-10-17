import { withAuth, json, bad } from "@/lib/api";
import { transcribeAudio } from "@/lib/ai/openrouter";
import { languageEnglishName } from "@/lib/config";

export const maxDuration = 120;

/** Transcribes one WAV chunk (base64). Returns text in the spoken language + translation. */
export const POST = withAuth(async (_session, req: Request) => {
  const body = (await req.json()) as { audio?: string; hintLanguage?: string; targetLanguage?: string; context?: string };
  if (!body.audio || body.audio.length < 2000) return bad("No audio");
  const t = await transcribeAudio(body.audio, {
    hintLanguage: body.hintLanguage ? languageEnglishName(body.hintLanguage) : undefined,
    targetLanguage: body.targetLanguage ? languageEnglishName(body.targetLanguage) : "English",
    context: body.context,
  });
  return json(t);
});
