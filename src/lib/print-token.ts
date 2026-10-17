import { SignJWT, jwtVerify } from "jose";

const secret = () => new TextEncoder().encode((process.env.AUTH_SECRET || "mosaic-dev-secret") + ":print");

/** Short-lived token that lets the PDF renderer open /print/[id] without a session cookie. */
export async function createPrintToken(projectId: string, which: "main" | "second"): Promise<string> {
  return new SignJWT({ pid: projectId, which }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(secret());
}

export async function verifyPrintToken(token: string): Promise<{ pid: string; which: "main" | "second" } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.pid) return null;
    return { pid: String(payload.pid), which: payload.which === "second" ? "second" : "main" };
  } catch {
    return null;
  }
}
