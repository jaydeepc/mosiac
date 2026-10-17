import { getSession } from "@/lib/auth";
import { json } from "@/lib/api";
import { config } from "@/lib/config";

export async function GET() {
  const s = await getSession();
  return json({ user: s, allowSelfSignup: config.allowSelfSignup });
}
