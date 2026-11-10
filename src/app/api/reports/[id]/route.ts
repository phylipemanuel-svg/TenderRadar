import { query } from "@/lib/db";
import { json, errorResponse } from "../../_util";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const rows = await query(`SELECT id, created_at, title, data FROM reports WHERE id = $1`, [Number(id)]);
    if (!rows.length) return json({ error: "Not found" }, 404);
    return json({ report: rows[0] });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await query(`DELETE FROM reports WHERE id = $1`, [Number(id)]);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
