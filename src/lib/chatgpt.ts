import type { ExternalAnalysis, Opportunity } from "./types";
import { cleanText } from "./sanitise";

export const CHATGPT_PROMPT = `Analyse these live procurement opportunities for Flotek Group.

Flotek is a UK technology and communications business (telecoms, Microsoft Teams Phone / Webex Calling, connectivity, networking, managed IT, Microsoft 365 and Azure, cyber security, structured cabling, CCTV and AV) serving the NHS, public sector, education, housing and multi-site organisations, based in Wales and delivering UK wide.

For each opportunity:

* score strategic fit 0-100
* explain what the buyer is procuring
* identify why Flotek is a strong match
* identify qualification requirements
* identify potential capability gaps
* assess commercial attractiveness
* highlight mandatory accreditations
* assess bid/no-bid
* give a recommended next action

Do not invent missing information.

Rank the opportunities from strongest to weakest.

Return structured results that can be imported back into Flotek Tender Radar. Reply ONLY with a JSON array (no commentary, no markdown fences) where each element has exactly these keys:

{
  "opportunity_id": "<copy the opportunity_id field from the input unchanged>",
  "rank": 1,
  "strategic_fit": 0-100,
  "what_buyer_is_procuring": "...",
  "why_flotek_matches": "...",
  "qualification_requirements": "...",
  "capability_gaps": "...",
  "commercial_attractiveness": "...",
  "mandatory_accreditations": "...",
  "bid_recommendation": "BID" | "NO BID" | "QUALIFY",
  "recommended_next_action": "...",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}`;

/** The export record — every piece of tender information the app holds. */
export function exportRecord(o: Opportunity) {
  return {
    opportunity_id: o.id,
    title: o.title,
    buyer: o.buyer,
    buyer_type: o.buyerType,
    flotek_fit_score: o.fit.score,
    fit_category: o.fit.category,
    fit_reasons: o.fit.reasons.map((r) => `+${r.points} ${r.label}`),
    matched_flotek_services: o.fit.matchedServices,
    matched_keywords: o.fit.matchedKeywords,
    priority: o.priority,
    live_status: o.liveStatus,
    change_status: o.changeStatus,
    value: o.value,
    value_min: o.valueMin ?? null,
    value_max: o.valueMax ?? null,
    currency: o.currency,
    vat_basis: o.vatBasis ?? null,
    published: o.published,
    deadline: o.deadline,
    days_remaining: o.daysRemaining,
    contract_start: o.contractStart,
    contract_end: o.contractEnd,
    duration: o.durationText,
    extensions: o.extensionsText,
    procurement_method: o.procurementMethod,
    procurement_method_details: o.procurementMethodDetails,
    procurement_stage: o.stage,
    framework: o.isFramework,
    dynamic_purchasing_system: o.isDps,
    lots: o.lots,
    cpv_codes: o.cpv,
    region: o.regionLabel,
    location: o.locationText,
    description: o.description,
    source: o.sourceLabel,
    all_sources: o.sources,
    procurement_reference: o.reference,
    ocid: o.ocid,
    notice_url: o.url,
    documents: o.documents,
    user_decision: o.decision,
    user_notes: o.notes,
  };
}

export function toCsv(list: Opportunity[]): string {
  const recs = list.map(exportRecord);
  const cols = Object.keys(recs[0] || exportRecord(dummy()));
  const cell = (v: unknown) => {
    let s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    // Prevent CSV formula injection
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [cols.join(","), ...recs.map((r) => cols.map((c) => cell((r as Record<string, unknown>)[c])).join(","))].join("\r\n");
}

function dummy(): Opportunity {
  return {
    id: "", ocid: null, reference: null, noticeId: null, title: "", buyer: "", description: "", published: null, deadline: null, value: null, currency: "GBP",
    procurementMethod: null, procurementMethodDetails: null, stage: "unknown", rawStatus: null, isFramework: false, isDps: false, lots: [], cpv: [], regionCodes: [],
    locationText: "", contractStart: null, contractEnd: null, durationText: null, extensionsText: null, url: null, documents: [], sourceId: "", sourceLabel: "",
    sources: [], region: "unknown", regionLabel: "", buyerType: "", fit: { score: 0, category: "LOW FIT", reasons: [], matchedServices: [], matchedKeywords: [], matchedCpv: [] },
    liveStatus: "OPEN", daysRemaining: null, priority: "NORMAL", changeStatus: "NEW", changes: [],
  };
}

/** Parse analysis JSON pasted or uploaded from ChatGPT. Tolerant of markdown fences and wrappers. */
export function parseAnalysis(text: string): ExternalAnalysis[] {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    const start = s.indexOf("[");
    const end = s.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("Could not find a JSON array in the pasted text");
    parsed = JSON.parse(s.slice(start, end + 1));
  }
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const inner = obj.results || obj.opportunities || obj.analysis || obj.data;
    if (Array.isArray(inner)) arr = inner;
  }
  if (!arr.length) throw new Error("The JSON did not contain an array of opportunity analyses");
  const str = (v: unknown, max = 4000) => (v == null ? undefined : cleanText(typeof v === "string" ? v : JSON.stringify(v), max));
  const out: ExternalAnalysis[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = str(r.opportunity_id ?? r.id ?? r.opportunityId, 300);
    if (!id) continue;
    const fit = Number(r.strategic_fit ?? r.score ?? r.fit_score);
    out.push({
      opportunity_id: id,
      strategic_fit: Number.isFinite(fit) ? Math.max(0, Math.min(100, Math.round(fit))) : undefined,
      what_buyer_is_procuring: str(r.what_buyer_is_procuring ?? r.summary),
      why_flotek_matches: str(r.why_flotek_matches ?? r.why_strong_match),
      qualification_requirements: str(r.qualification_requirements),
      capability_gaps: str(r.capability_gaps),
      commercial_attractiveness: str(r.commercial_attractiveness),
      mandatory_accreditations: str(r.mandatory_accreditations),
      bid_recommendation: str(r.bid_recommendation ?? r.bid_no_bid, 40)?.toUpperCase(),
      recommended_next_action: str(r.recommended_next_action ?? r.next_action),
      confidence: str(r.confidence, 20)?.toUpperCase(),
      rank: Number.isFinite(Number(r.rank)) ? Number(r.rank) : undefined,
      imported_at: new Date().toISOString(),
    });
  }
  return out;
}
