import { NextRequest, NextResponse } from "next/server";
import { checkCredentials, createSessionToken, rateLimitCheck, rateLimitReset, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const rl = rateLimitCheck(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.` }, { status: 429 });
  }
  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const username = String(body.username || "").slice(0, 200);
  const password = String(body.password || "").slice(0, 500);
  // small constant delay to blunt brute force
  await new Promise((r) => setTimeout(r, 400));
  if (!checkCredentials(username, password)) {
    return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  }
  rateLimitReset(ip);
  const token = await createSessionToken(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
