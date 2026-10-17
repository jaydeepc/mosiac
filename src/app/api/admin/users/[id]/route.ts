import { requireAdmin, hashPassword, publicUser } from "@/lib/auth";
import { bad, handleError, json } from "@/lib/api";
import { ensureSetup, users, oid, projects, files } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureSetup();
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return bad("Not found", 404);
    const body = (await req.json()) as { name?: string; role?: "admin" | "member"; active?: boolean; password?: string; language?: string };
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) set.name = body.name.trim();
    if (body.role !== undefined) set.role = body.role === "admin" ? "admin" : "member";
    if (body.active !== undefined) set.active = Boolean(body.active);
    if (body.language !== undefined) set.language = body.language;
    if (body.password) {
      if (body.password.length < 6) return bad("Password must be at least 6 characters");
      set.passwordHash = await hashPassword(body.password);
    }
    if (id === admin.uid && (set.active === false || set.role === "member")) return bad("You can't lock yourself out");
    const col = await users();
    const res = await col.findOneAndUpdate({ _id }, { $set: set }, { returnDocument: "after" });
    if (!res) return bad("Not found", 404);
    return json({ user: publicUser(res) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureSetup();
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return bad("Not found", 404);
    if (id === admin.uid) return bad("You can't delete your own account");
    await (await users()).deleteOne({ _id });
    await (await projects()).deleteMany({ userId: _id });
    await (await files()).deleteMany({ userId: _id });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
