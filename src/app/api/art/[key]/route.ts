import { toBody } from "@/lib/bytes";
import { getArt } from "@/lib/art";
import { art, oid } from "@/lib/db";

export const maxDuration = 120;

/** Serves cached generated art by preset key, or by stored ObjectId. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  try {
    const id = key.length === 24 ? oid(key) : null;
    if (id) {
      const doc = await (await art()).findOne({ _id: id });
      if (!doc) return new Response("Not found", { status: 404 });
      return new Response(toBody(doc.data), { headers: { "Content-Type": doc.mime, "Cache-Control": "public, max-age=31536000, immutable" } });
    }
    const img = await getArt(key);
    if (!img) return new Response("Not found", { status: 404 });
    return new Response(toBody(img.data), { headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    console.error("[art]", e);
    return new Response("Art unavailable", { status: 503 });
  }
}
