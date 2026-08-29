import { query } from "@/lib/db";
import { listOpportunities } from "@/lib/opportunities";
import { buildReport } from "@/lib/report";
import { json, errorResponse, readJson } from "../_util";

export const runtime = "nodejs";

export async function GET() {
  try {
    const reports = await query(`SELECT id, created_at, title, reporting_date, opportunity_count, combined_value FROM reports ORDER BY id DESC LIMIT 100`);
    return json({ reports });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson<{ ids: string[]; title?: string; reportingDate?: string }>(req);
    if (!Array.isArray(body.ids) || !body.ids.length) return json({ error: "Select at least one opportunity" }, 400);
    const all = await listOpportunities({ includeClosed: true });
    const chosen = all.filter((o) => body.ids.includes(o.id));
    if (!chosen.length) return json({ error: "No matching opportunities" }, 400);
    const date = body.reportingDate && !isNaN(Date.parse(body.reportingDate)) ? new Date(body.reportingDate) : new Date();
    const title = String(body.title || `Weekly Tender Opportunities ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`).slice(0, 200);
    const data = buildReport(chosen, title, date);
    const rows = await query<{ id: number }>(
      `INSERT INTO reports (title, reporting_date, opportunity_count, combined_value, data) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [title, data.reportingDate, data.opportunities.length, data.combinedValue, JSON.stringify(data)],
    );
    return json({ id: rows[0].id });
  } catch (e) {
    return errorResponse(e);
  }
}
