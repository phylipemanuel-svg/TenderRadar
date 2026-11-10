import { parseAnalysis } from "@/lib/chatgpt";
import { saveAnalysis, getOpportunity } from "@/lib/opportunities";
import { json, errorResponse, readJson } from "../_util";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ text: string }>(req);
    if (typeof body.text !== "string" || body.text.length > 2_000_000) return json({ error: "Paste the JSON returned by ChatGPT" }, 400);
    const items = parseAnalysis(body.text);
    let imported = 0;
    const unmatched: string[] = [];
    for (const a of items) {
      const opp = await getOpportunity(a.opportunity_id);
      if (!opp) {
        unmatched.push(a.opportunity_id);
        continue;
      }
      await saveAnalysis(a.opportunity_id, a);
      imported++;
    }
    return json({ imported, unmatched });
  } catch (e) {
    return errorResponse(e, 400);
  }
}
