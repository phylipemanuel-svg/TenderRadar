import { query } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { sourceById } from "@/lib/sources/registry";
import { runFindATender } from "@/lib/sources/fts";
import { runContractsFinder } from "@/lib/sources/contractsfinder";
import { runFeedSource } from "@/lib/sources/feed";
import { runProactisApi } from "@/lib/sources/proactis";
import { recordSourceProgress } from "@/lib/pipeline";
import { json, errorResponse, readJson } from "../../../_util";
import type { SearchParams } from "@/lib/types";
import type { SourceRunResult } from "@/lib/sources/common";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await ctx.params;
  let runId = 0;
  try {
    const body = await readJson<{ runId: number; cursor?: string | null }>(req);
    runId = Number(body.runId);
    const def = sourceById(sourceId);
    if (!def || def.kind === "manual") return json({ error: "Unknown or manual source" }, 400);
    const runs = await query<{ params: SearchParams }>(`SELECT params FROM search_runs WHERE id = $1 AND status = 'running'`, [runId]);
    if (!runs.length) return json({ error: "Search run not found" }, 404);
    const settings = await loadSettings();
    const input = { settings, params: runs[0].params, cursor: body.cursor || null };

    let result: SourceRunResult;
    try {
      if (def.id === "fts") result = await runFindATender(input);
      else if (def.id === "contractsfinder") result = await runContractsFinder(input);
      else if (def.id === "sell2wales" || def.id === "pcs") result = await runProactisApi(def, input);
      else result = await runFeedSource(def, settings.feedUrls[def.id] || "", input);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly = /abort/i.test(msg) ? "Timed out waiting for the source to respond" : msg;
      await recordSourceProgress(runId, sourceId, 0, 0, "ERROR", friendly, true);
      return json({ sourceId, status: "ERROR", message: friendly, checked: 0, relevant: 0, nextCursor: null });
    }

    if (result.candidates.length) {
      // batch insert staging rows
      const values: string[] = [];
      const params: unknown[] = [];
      result.candidates.forEach((c, i) => {
        values.push(`($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}::jsonb)`);
        params.push(runId, sourceId, JSON.stringify(c));
      });
      await query(`INSERT INTO search_staging (run_id, source_id, data) VALUES ${values.join(",")}`, params);
    }
    await recordSourceProgress(runId, sourceId, result.checked, result.candidates.length, result.status, result.message, !result.nextCursor);
    return json({ sourceId, status: result.status, message: result.message, checked: result.checked, relevant: result.candidates.length, nextCursor: result.nextCursor, pages: result.pages });
  } catch (e) {
    if (runId) await recordSourceProgress(runId, sourceId, 0, 0, "ERROR", e instanceof Error ? e.message : String(e), true).catch(() => {});
    return errorResponse(e);
  }
}
