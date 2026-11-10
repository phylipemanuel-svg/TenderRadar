import { listOpportunities } from "@/lib/opportunities";
import { loadSettings } from "@/lib/settings";
import { query } from "@/lib/db";
import { json, errorResponse } from "../_util";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeClosed = url.searchParams.get("closed") === "1";
    const [opps, settings, runs] = await Promise.all([
      listOpportunities({ includeClosed }),
      loadSettings(),
      query<{ id: number; finished_at: string; stats: unknown }>(`SELECT id, finished_at, stats FROM search_runs WHERE status = 'complete' ORDER BY id DESC LIMIT 2`),
    ]);
    return json({ opportunities: opps, minScore: settings.minScore, lastRun: runs[0] || null, previousRun: runs[1] || null });
  } catch (e) {
    return errorResponse(e);
  }
}
