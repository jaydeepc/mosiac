import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { users, ensureSetup, oid } from "./db";
import type { UserDoc } from "./types";
import { SESSION_COOKIE, createSessionToken, verifySessionToken, type Session } from "./session-token";

export { SESSION_COOKIE, createSessionToken, verifySessionToken };
export type { Session };

/** Session from the request cookie (server components + route handlers). */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await verifySessionToken(token);
  if (!s) return null;
  // Verify the account still exists and is active (cheap, indexed)
  await ensureSetup();
  const col = await users();
  const id = oid(s.uid);
  if (!id) return null;
  const u = await col.findOne({ _id: id }, { projection: { active: 1, role: 1, name: 1, language: 1 } });
  if (!u || !u.active) return null;
  return { ...s, role: u.role, name: u.name, language: u.language ?? s.language };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError("Not signed in", 401);
  return s;
}
export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== "admin") throw new AuthError("Admins only", 403);
  return s;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function authenticate(email: string, password: string): Promise<UserDoc | null> {
  await ensureSetup();
  const col = await users();
  const u = await col.findOne({ email: email.trim().toLowerCase() });
  if (!u || !u.active) return null;
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return null;
  await col.updateOne({ _id: u._id }, { $set: { lastLoginAt: new Date() } });
  return u;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export function publicUser(u: UserDoc) {
  return {
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    language: u.language,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  };
}
