import { getSelectedOpportunities } from "@/lib/opportunities";
import { exportRecord, toCsv, CHATGPT_PROMPT } from "@/lib/chatgpt";
import { errorResponse } from "../_util";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
    const list = await getSelectedOpportunities();
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      return new Response(toCsv(list), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="flotek-tender-shortlist-${date}.csv"` },
      });
    }
    const payload = {
      export_format: "flotek-tender-radar/v1",
      exported_at: new Date().toISOString(),
      instructions: CHATGPT_PROMPT,
      opportunities: list.map(exportRecord),
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="flotek-tender-shortlist-${date}.json"` },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
