import { getOpportunity, getChanges } from "@/lib/opportunities";
import { json, errorResponse } from "../../_util";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);
    const opp = await getOpportunity(decoded);
    if (!opp) return json({ error: "Not found" }, 404);
    const changes = await getChanges(decoded);
    return json({ opportunity: opp, changes });
  } catch (e) {
    return errorResponse(e);
  }
}
