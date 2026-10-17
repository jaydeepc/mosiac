import { toBody } from "@/lib/bytes";
import { getSession } from "@/lib/auth";
import { files, oid, projects } from "@/lib/db";
import { ObjectId } from "mongodb";
import { verifyPrintToken } from "@/lib/print-token";

/** Serves an uploaded file (resume or photo). Owner, admin, or anyone with a shared project link. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const _id = oid(id);
  if (!_id) return new Response("Not found", { status: 404 });
  const doc = await (await files()).findOne({ _id });
  if (!doc) return new Response("Not found", { status: 404 });
  const session = await getSession();
  let allowed = Boolean(session && (session.role === "admin" || doc.userId.equals(new ObjectId(session.uid))));
  if (!allowed) {
    const printToken = new URL(req.url).searchParams.get("print");
    const claims = printToken ? await verifyPrintToken(printToken) : null;
    if (claims) allowed = Boolean(await (await projects()).findOne({ _id: new ObjectId(claims.pid), photoFileId: _id }, { projection: { _id: 1 } }));
  }
  if (!allowed) {
    // photos on publicly shared Mosaics are viewable
    const shared = await (await projects()).findOne({ photoFileId: _id, shareSlug: { $exists: true } }, { projection: { _id: 1 } });
    allowed = Boolean(shared);
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });
  const dl = new URL(req.url).searchParams.get("download");
  return new Response(toBody(doc.data), {
    headers: {
      "Content-Type": doc.mime,
      "Cache-Control": "private, max-age=3600",
      ...(dl ? { "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}"` } : {}),
    },
  });
}
