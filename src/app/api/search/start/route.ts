import { query } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { SEARCHABLE_SOURCES } from "@/lib/sources/registry";
import { json, errorResponse, readJson } from "../../_util";
import type { SearchParams, RegionId } from "@/lib/types";

export const runtime = "nodejs";

const REGIONS: RegionId[] = ["wales", "southwest", "midlands", "northwest", "england", "scotland", "northernireland", "uk"];

export async function POST(req: Request) {
  try {
    const body = await readJson<Partial<SearchParams>>(req);
    const settings = await loadSettings();
    const params: SearchParams = {
      regions: (Array.isArray(body.regions) ? body.regions.filter((r) => REGIONS.includes(r)) : settings.defaultRegions) as RegionId[],
      lookbackDays: Math.min(365, Math.max(7, Number(body.lookbackDays) || settings.lookbackDays)),
      sources: Array.isArray(body.sources) ? body.sources.filter((s) => SEARCHABLE_SOURCES.some((d) => d.id === s)) : SEARCHABLE_SOURCES.map((s) => s.id),
    };
    if (!params.sources.length) params.sources = SEARCHABLE_SOURCES.map((s) => s.id);
    const rows = await query<{ id: number }>(`INSERT INTO search_runs (params, stats) VALUES ($1::jsonb, '{"perSource":{}}'::jsonb) RETURNING id`, [JSON.stringify(params)]);
    return json({ runId: rows[0].id, params, sources: SEARCHABLE_SOURCES.filter((s) => params.sources.includes(s.id)).map((s) => ({ id: s.id, label: s.label, kind: s.kind })) });
  } catch (e) {
    return errorResponse(e);
  }
}
