import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(e: unknown, status = 500) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  return NextResponse.json({ error: msg }, { status });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Request body must be JSON");
  }
}
