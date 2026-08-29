import { loadSettings } from "@/lib/settings";
import { finaliseRun } from "@/lib/pipeline";
import { json, errorResponse, readJson } from "../../_util";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await readJson<{ runId: number }>(req);
    const settings = await loadSettings();
    const stats = await finaliseRun(Number(body.runId), settings);
    return json({ stats });
  } catch (e) {
    return errorResponse(e);
  }
}
