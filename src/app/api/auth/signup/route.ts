import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { bad } from "@/lib/api";
import { ensureSetup, users, ObjectId } from "@/lib/db";
import { createSessionToken, hashPassword, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  if (!config.allowSelfSignup) return bad("Self sign-up is disabled. Ask your Mosaic admin for an account.", 403);
  try {
    await ensureSetup();
    const { email, password, name, language } = (await req.json()) as Record<string, string | undefined>;
    if (!email || !password || password.length < 6) return bad("Email and a password of at least 6 characters are required");
    const col = await users();
    const exists = await col.findOne({ email: email.toLowerCase().trim() });
    if (exists) return bad("An account with that email already exists", 409);
    const doc = {
      _id: new ObjectId(),
      email: email.toLowerCase().trim(),
      name: name?.trim() || email.split("@")[0],
      passwordHash: await hashPassword(password),
      role: "member" as const,
      active: true,
      language: language || "en",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await col.insertOne(doc);
    const token = await createSessionToken({ uid: doc._id.toString(), email: doc.email, name: doc.name, role: doc.role, language: doc.language });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return res;
  } catch (e) {
    console.error(e);
    return bad("Sign-up failed", 500);
  }
}
