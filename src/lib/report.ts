import type { Opportunity } from "./types";
import { fmtMoneyFull, durationYears } from "./scoring";

export interface ReportOpportunity {
  rank: number;
  id: string;
  title: string;
  buyer: string;
  tags: string[];
  score: number;
  fitCategory: string;
  priority: string;
  priorityLabel: string; // e.g. "CRITICAL DEADLINE", "HIGH PRIORITY", "QUALIFY / PARTNER"
  confidence: string; // HIGH / MEDIUM / LOW / RULES-BASED
  summary: string;
  value: number | null;
  valueLabel: string;
  valueNote: string;
  deadline: string | null;
  deadlineLabel: string;
  deadlineNote: string;
  term: string;
  termNote: string;
  evaluation: string;
  evaluationNote: string;
  whyMatch: { title: string; body: string }[];
  qualify: { title: string; body: string }[];
  recommendedAction: string;
  shortAction: string;
  url: string | null;
  source: string;
  region: string;
}

export interface ReportData {
  title: string;
  reportingDate: string; // ISO date
  weekEnding: string;
  intro: string;
  combinedValue: number;
  combinedValueLabel: string;
  strongMatches: number;
  needingAction: number;
  valueFootnote: string;
  opportunities: ReportOpportunity[];
}

const fmtDate = (iso: string | null, withTime = false) => {
  if (!iso) return "Not stated";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Not stated";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (!withTime) return date;
  const hasTime = /T\d{2}:\d{2}/.test(iso) && !/T00:00(:00)?/.test(iso);
  if (!hasTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};
const fmtShort = (iso: string | null) => {
  if (!iso) return "TBC";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "TBC" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const ACCREDITATION_RE =
  /\b(cyber essentials plus|cyber essentials|iso ?27001|iso ?9001|iso ?14001|psn|ncsc|check\b|crest|dspt|data security and protection toolkit|g-cloud|safecontractor|chas|constructionline|ssip|bs ?7858|nsi|ssaib|microsoft (gold|solutions) partner|cisco (gold|premier|select) partner|ofcom|social value|tupe|living wage|gdpr|dpia)\b/gi;

function sentence(s: string, max = 220): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return (end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s\S*$/, "") + "…").trim();
}

export function priorityLabelFor(o: Opportunity): string {
  if (o.fit.score < 60) return "QUALIFY / PARTNER";
  if (o.liveStatus === "PIPELINE" || o.liveStatus === "MARKET ENGAGEMENT") return "PIPELINE";
  if (o.priority === "CRITICAL") return "CRITICAL DEADLINE";
  if (o.priority === "HIGH") return "HIGH PRIORITY";
  if (o.priority === "MEDIUM") return "MEDIUM PRIORITY";
  return "MONITOR";
}

export function shortPriority(o: Opportunity): string {
  if (o.fit.score < 60) return "QUALIFY";
  if (o.liveStatus === "PIPELINE" || o.liveStatus === "MARKET ENGAGEMENT") return "PIPELINE";
  return o.priority;
}

export function buildReportOpportunity(o: Opportunity, rank: number): ReportOpportunity {
  const a = o.analysis;
  const years = durationYears(o);
  const accreditations = [...new Set((o.description.match(ACCREDITATION_RE) || []).map((x) => x.replace(/\s+/g, " ")))].slice(0, 5);
  const tags = [...o.fit.matchedServices.slice(0, 2), o.buyerType !== "other" ? o.buyerType.replace("bluelight", "blue light").replace("welshgov", "welsh government").replace("ukgov", "uk government") : o.regionLabel]
    .map((t) => t.toUpperCase())
    .filter(Boolean);
  if (o.isFramework) tags.push("FRAMEWORK");
  if (o.isDps) tags.push("DYNAMIC MARKET");

  const score = a?.strategic_fit ?? o.fit.score;
  const fitCategory = score >= 90 ? "EXCEPTIONAL FIT" : score >= 80 ? "EXCELLENT FIT" : score >= 70 ? "STRONG FIT" : score >= 60 ? "POTENTIAL FIT" : score >= 40 ? "LOWER FIT" : "LOW FIT";

  // ---- Why Flotek is a match ----
  const whyMatch: { title: string; body: string }[] = [];
  if (a?.why_flotek_matches) {
    a.why_flotek_matches
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .slice(0, 3)
      .forEach((s, i) => whyMatch.push({ title: i === 0 ? "External analysis" : "", body: sentence(s) }));
  } else {
    if (o.fit.matchedServices.length) {
      whyMatch.push({
        title: `Direct ${o.fit.matchedServices[0]} scope`,
        body: `The notice matches Flotek's ${o.fit.matchedServices.slice(0, 3).join(", ")} capability (${o.fit.matchedKeywords.slice(0, 4).join(", ")}).`,
      });
    }
    const cpvReason = o.fit.reasons.find((r) => /CPV/.test(r.label) && r.points > 0);
    if (cpvReason) whyMatch.push({ title: "Procurement category alignment", body: cpvReason.label + "." });
    const buyerReason = o.fit.reasons.find((r) => /buyer/.test(r.label) && r.points > 0);
    if (buyerReason) whyMatch.push({ title: "Target buyer and sector fit", body: `${o.buyer} is a ${buyerReason.label.replace(" buyer", "")} organisation in Flotek's core public sector market, ${o.regionLabel === "Not stated" ? "location to be confirmed" : `located in ${o.regionLabel}`}.` });
    const fw = o.fit.reasons.find((r) => /framework|term|recurring|dynamic/i.test(r.label) && r.points > 0);
    if (fw && whyMatch.length < 3) whyMatch.push({ title: "Recurring revenue potential", body: fw.label + (years ? ` with a ${years}-year term` : "") + "." });
  }
  while (whyMatch.length < 2 && o.fit.reasons.length > whyMatch.length) {
    const r = o.fit.reasons[whyMatch.length];
    whyMatch.push({ title: "Scoring factor", body: r.label + "." });
  }

  // ---- Qualify before committing ----
  const qualify: { title: string; body: string }[] = [];
  if (a?.qualification_requirements) qualify.push({ title: "Qualification requirements", body: sentence(a.qualification_requirements) });
  if (a?.capability_gaps) qualify.push({ title: "Potential capability gaps", body: sentence(a.capability_gaps) });
  if (a?.mandatory_accreditations) qualify.push({ title: "Mandatory accreditations", body: sentence(a.mandatory_accreditations) });
  if (!qualify.length) {
    if (o.daysRemaining != null && o.daysRemaining <= 14 && o.liveStatus !== "CLOSED") {
      qualify.push({ title: "Deadline is immediate", body: `The submission deadline is ${fmtDate(o.deadline, true)}, ${o.daysRemaining} day(s) away. Mobilisation must start now if this is pursued.` });
    }
    if (accreditations.length) qualify.push({ title: "Accreditations referenced", body: `The notice mentions ${accreditations.join(", ")}. Confirm every mandatory requirement in the tender pack and map it to evidence.` });
    if (o.value == null) qualify.push({ title: "Value not published", body: "No estimated value is stated in the notice. Confirm the budget and volume from the tender documents before committing bid effort." });
    else if (o.value > 5_000_000) qualify.push({ title: "Scale of contract", body: `At ${fmtMoneyFull(o.value)} this is a large contract. Confirm delivery capacity, financial thresholds and whether a partner is needed.` });
    if (o.isFramework || o.isDps) qualify.push({ title: "Framework demand is not guaranteed", body: "Appointment does not guarantee call-off volume. Weigh bid effort against realistic call-off expectations." });
    if (o.lots.length > 1) qualify.push({ title: `${o.lots.length} lots`, body: `Review which lots match Flotek's services: ${o.lots.slice(0, 3).map((l) => l.title).filter(Boolean).join("; ")}.` });
    if (o.regionLabel === "Not stated") qualify.push({ title: "Delivery location unconfirmed", body: "The notice does not state where services are delivered. Confirm sites and on-site requirements." });
    if (o.sourceId !== "fts" && o.sourceId !== "contractsfinder") qualify.push({ title: "Confirm details on the portal", body: `This notice came from a ${o.sourceLabel} feed which carries less structured data. Verify the deadline, value and scope on the portal.` });
  }
  if (qualify.length < 2) qualify.push({ title: "Read the full pack", body: "Confirm evaluation weightings, TUPE, social value and insurance requirements from the tender documents before bid/no-bid." });

  // ---- Recommended action ----
  let recommendedAction: string;
  if (a?.recommended_next_action) recommendedAction = sentence(a.recommended_next_action, 320);
  else if (o.liveStatus === "PIPELINE" || o.liveStatus === "MARKET ENGAGEMENT") recommendedAction = `Register interest with ${o.buyer} now and engage early. Use the market engagement window to shape the requirement and confirm the likely procurement route and timing.`;
  else if (o.fit.score < 60) recommendedAction = `Qualify quickly. Confirm whether Flotek can deliver the core requirement directly or needs a named delivery partner; otherwise treat this as a pass.`;
  else if (o.daysRemaining != null && o.daysRemaining <= 7) recommendedAction = `Mobilise immediately. Download the pack, confirm eligibility and accreditations today, and assign a bid lead — the deadline is ${fmtDate(o.deadline, true)}.`;
  else if (o.daysRemaining != null && o.daysRemaining <= 14) recommendedAction = `Download the pack and build a requirement matrix this week. Confirm mandatory accreditations and evidence before committing to the full response.`;
  else recommendedAction = `Register on the portal, download the documents and complete a bid/no-bid review. Confirm evaluation criteria, contract term and reference requirements.`;

  const shortAction = a?.recommended_next_action ? sentence(a.recommended_next_action, 110) : sentence(recommendedAction, 110);

  const summary = a?.what_buyer_is_procuring ? sentence(a.what_buyer_is_procuring, 330) : sentence(o.description || o.title, 330);

  const evaluation = o.procurementMethodDetails || (o.procurementMethod ? o.procurementMethod.replace(/^\w/, (c) => c.toUpperCase()) : "Not stated");

  return {
    rank,
    id: o.id,
    title: o.title,
    buyer: o.buyer,
    tags: tags.slice(0, 3),
    score,
    fitCategory,
    priority: shortPriority(o),
    priorityLabel: priorityLabelFor(o),
    confidence: a?.confidence ? `${a.confidence} CONFIDENCE` : "RULES-BASED SCORE",
    summary,
    value: o.value,
    valueLabel: fmtMoneyFull(o.value, o.currency),
    valueNote: o.value == null ? "not published in notice" : o.vatBasis ? o.vatBasis.toLowerCase() : "published value, VAT basis not stated",
    deadline: o.deadline,
    deadlineLabel: fmtDate(o.deadline),
    deadlineNote: o.deadline ? (/T\d{2}:\d{2}/.test(o.deadline) && !/T00:00/.test(o.deadline) ? `${new Date(o.deadline).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })} submission` : "submission deadline") : "check notice",
    term: years ? `${years} year${years === 1 ? "" : "s"}` : o.durationText || (o.isFramework ? "Framework" : "Not stated"),
    termNote: o.extensionsText || (o.contractEnd ? `to ${fmtDate(o.contractEnd)}` : o.isFramework ? "see framework terms" : "see tender documents"),
    evaluation: sentence(evaluation, 40),
    evaluationNote: o.procurementMethod && o.procurementMethodDetails ? o.procurementMethod : "as published",
    whyMatch: whyMatch.slice(0, 3),
    qualify: qualify.slice(0, 3),
    recommendedAction,
    shortAction,
    url: o.url,
    source: `${o.sourceLabel} notice${o.ocid ? " and public OCDS data" : ""}`,
    region: o.regionLabel,
  };
}

export function buildReport(list: Opportunity[], title: string, reportingDate = new Date()): ReportData {
  const ordered = [...list].sort((a, b) => (b.analysis?.strategic_fit ?? b.fit.score) - (a.analysis?.strategic_fit ?? a.fit.score));
  const opps = ordered.map((o, i) => buildReportOpportunity(o, i + 1));
  const valued = ordered.filter((o) => o.value != null);
  const combinedValue = valued.reduce((s, o) => s + (o.value || 0), 0);
  const strong = ordered.filter((o) => (o.analysis?.strategic_fit ?? o.fit.score) >= 70).length;
  const action = ordered.filter((o) => o.priority === "CRITICAL" || o.priority === "HIGH").length;
  const services = [...new Set(ordered.flatMap((o) => o.fit.matchedServices))].slice(0, 4).map((s) => s.toLowerCase());
  const nextDecision = ordered.filter((o) => o.deadline).sort((a, b) => Date.parse(a.deadline!) - Date.parse(b.deadline!))[0];
  const bases = new Set(valued.map((o) => o.vatBasis || "VAT basis not stated"));
  return {
    title,
    reportingDate: reportingDate.toISOString().slice(0, 10),
    weekEnding: reportingDate.toLocaleDateString("en-GB", { day: "numeric", month: "long" }).toUpperCase(),
    intro: `A focused shortlist of public sector opportunities aligned to Flotek's strengths in ${services.length ? services.join(", ") : "technology and communications"}.${
      nextDecision ? ` The earliest decision point is ${nextDecision.buyer}'s deadline on ${fmtShort(nextDecision.deadline)}.` : ""
    }`,
    combinedValue,
    combinedValueLabel: combinedValue > 0 ? fmtMoneyHeadline(combinedValue) + (valued.length < ordered.length ? "+*" : "*") : "TBC",
    strongMatches: strong,
    needingAction: action,
    valueFootnote:
      valued.length === 0
        ? "No published values were available for the selected opportunities."
        : `The headline total combines ${valued.map((o) => `${fmtMoneyFull(o.value, o.currency)} for ${o.buyer}`).join(", ")}.${
            valued.length < ordered.length ? ` ${ordered.length - valued.length} opportunit${ordered.length - valued.length === 1 ? "y has" : "ies have"} no published value.` : ""
          }${bases.size > 1 ? " VAT bases differ; check the tender documents before relying on the aggregate." : ""}`,
    opportunities: opps,
  };
}

export function fmtMoneyHeadline(v: number): string {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m`;
  if (v >= 1000) return `£${Math.round(v / 1000)}k`;
  return `£${Math.round(v)}`;
}
