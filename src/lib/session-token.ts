import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "mosaic_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "mosaic-dev-secret");

export interface Session {
  uid: string;
  email: string;
  name: string;
  role: "admin" | "member";
  language: string;
}

export async function createSessionToken(s: Session): Promise<string> {
  return new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.uid) return null;
    return {
      uid: String(payload.uid),
      email: String(payload.email),
      name: String(payload.name ?? ""),
      role: payload.role === "admin" ? "admin" : "member",
      language: String(payload.language ?? "en"),
    };
  } catch {
    return null;
  }
}
