import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { json, errorResponse, readJson } from "../_util";
import type { Settings } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    return json({ settings: await loadSettings(), defaults: DEFAULT_SETTINGS });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await readJson<{ settings: Settings; reset?: boolean }>(req);
    const saved = await saveSettings(body.reset ? DEFAULT_SETTINGS : body.settings);
    return json({ settings: saved });
  } catch (e) {
    return errorResponse(e, 400);
  }
}
