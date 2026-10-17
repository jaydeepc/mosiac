import { requireAdmin, hashPassword, publicUser } from "@/lib/auth";
import { bad, handleError, json } from "@/lib/api";
import { ensureSetup, users, ObjectId } from "@/lib/db";

export async function GET() {
  try {
    await ensureSetup();
    await requireAdmin();
    const list = await (await users()).find({}, { sort: { createdAt: 1 } }).toArray();
    return json({ users: list.map(publicUser) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await ensureSetup();
    const admin = await requireAdmin();
    const body = (await req.json()) as { email?: string; name?: string; password?: string; role?: "admin" | "member"; language?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("A valid email is required");
    if (!body.password || body.password.length < 6) return bad("Password must be at least 6 characters");
    const col = await users();
    if (await col.findOne({ email })) return bad("That email already has an account", 409);
    const doc = {
      _id: new ObjectId(),
      email,
      name: body.name?.trim() || email.split("@")[0],
      passwordHash: await hashPassword(body.password),
      role: body.role === "admin" ? ("admin" as const) : ("member" as const),
      active: true,
      language: body.language || "en",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(admin.uid),
    };
    await col.insertOne(doc);
    return json({ user: publicUser(doc) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
