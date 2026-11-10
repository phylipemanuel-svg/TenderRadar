import { query } from "@/lib/db";
import { json, errorResponse } from "../../_util";

export const runtime = "nodejs";

export async function GET() {
  try {
    const runs = await query(`SELECT id, started_at, finished_at, status, params, stats FROM search_runs ORDER BY id DESC LIMIT 30`);
    // Clean up any runs abandoned mid-search
    await query(`UPDATE search_runs SET status = 'abandoned' WHERE status = 'running' AND started_at < now() - interval '1 hour'`);
    return json({ runs });
  } catch (e) {
    return errorResponse(e);
  }
}
