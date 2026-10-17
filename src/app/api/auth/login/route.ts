import { NextResponse } from "next/server";
import { authenticate, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { bad } from "@/lib/api";
import { users } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email, password, language } = (await req.json()) as { email?: string; password?: string; language?: string };
    if (!email || !password) return bad("Email and password are required");
    const u = await authenticate(email, password);
    if (!u) return bad("That email and password don't match any account", 401);
    if (language && language !== u.language) {
      await (await users()).updateOne({ _id: u._id }, { $set: { language } });
      u.language = language;
    }
    const token = await createSessionToken({ uid: u._id.toString(), email: u.email, name: u.name, role: u.role, language: u.language });
    const res = NextResponse.json({ ok: true, user: { email: u.email, name: u.name, role: u.role, language: u.language } });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    console.error(e);
    return bad("Sign-in failed", 500);
  }
}
