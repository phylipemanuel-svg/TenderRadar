import { saveDecision, getOpportunity } from "@/lib/opportunities";
import { json, errorResponse, readJson } from "../../../_util";
import type { Decision } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);
    const body = await readJson<{ decision?: Decision; selected?: boolean; notes?: string }>(req);
    await saveDecision(decoded, body);
    return json({ opportunity: await getOpportunity(decoded) });
  } catch (e) {
    return errorResponse(e);
  }
}
