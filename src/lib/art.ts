import { art, ObjectId } from "./db";
import { generateImage } from "./ai/openrouter";

const STYLE =
  "soft watercolour wash on cold-pressed paper, loose brush edges, lavender–sage–apricot palette, generous white space, calm and painterly, no text, no letters, no people";

export const ART_PROMPTS: Record<string, { prompt: string; aspect: string }> = {
  "hero-login": {
    prompt: `${STYLE}. A handful of small rounded mosaic tiles in muted teal, sage, apricot and terracotta drifting gently down onto a blank sheet of paper, as if settling into place.`,
    aspect: "4:3",
  },
  "hero-ready": {
    prompt: `${STYLE}. Mosaic tiles that have just settled into a neat two-page document, a feeling of completion and quiet celebration, light washes around the edges.`,
    aspect: "3:2",
  },
  "infographic-backdrop": {
    prompt: `${STYLE}. A very light, barely-there watercolour backdrop suitable to sit behind a small bar chart on a resume: faint washes in the corners only, the centre almost pure paper white.`,
    aspect: "3:2",
  },
};

const inflight = new Map<string, Promise<{ data: Buffer; mime: string }>>();

/** Returns cached art or generates it once (concurrent requests share one generation). */
export async function getArt(key: string): Promise<{ data: Buffer; mime: string } | null> {
  const spec = ART_PROMPTS[key];
  if (!spec) return null;
  const col = await art();
  const cached = await col.findOne({ key });
  if (cached) return { data: Buffer.from(cached.data.buffer), mime: cached.mime };
  if (!inflight.has(key)) {
    inflight.set(
      key,
      (async () => {
        const img = await generateImage(spec.prompt, { aspect: spec.aspect });
        await col.updateOne({ key }, { $setOnInsert: { _id: new ObjectId(), key, mime: img.mime, data: img.data, prompt: spec.prompt, createdAt: new Date() } }, { upsert: true });
        return img;
      })().finally(() => inflight.delete(key)),
    );
  }
  return inflight.get(key)!;
}

/** Generates and stores a one-off painting (e.g. a resume's infographic backdrop). */
export async function generateStoredArt(key: string, prompt: string, aspect = "3:2"): Promise<ObjectId> {
  const col = await art();
  const img = await generateImage(`${STYLE}. ${prompt}`, { aspect });
  const _id = new ObjectId();
  await col.insertOne({ _id, key, mime: img.mime, data: img.data, prompt, createdAt: new Date() });
  return _id;
}
