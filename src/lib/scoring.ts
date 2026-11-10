import type { FitCategory, FitReason, FitResult, RawNotice, RegionId, Settings, ScoringWeights } from "./types";
import { matchCpv, matchKeywords, matchesAnyTerm } from "./matching";
import { REGION_LABEL, BUYER_TYPE_LABEL } from "./regions";

export const DEFAULT_WEIGHTS: ScoringWeights = {
  service: 30,
  cpv: 20,
  keyword: 15,
  buyer: 10,
  geography: 10,
  value: 5,
  framework: 5,
  multiService: 5,
};

export function fitCategory(score: number): FitCategory {
  if (score >= 90) return "EXCEPTIONAL FIT";
  if (score >= 80) return "EXCELLENT FIT";
  if (score >= 70) return "STRONG FIT";
  if (score >= 60) return "POTENTIAL FIT";
  if (score >= 40) return "REVIEW / PARTNER";
  return "LOW FIT";
}

function scaled(points: number, max: number, defaultMax: number) {
  // Scale a rule's points from the default weight to the configured weight
  if (defaultMax === 0) return 0;
  return Math.round((points / defaultMax) * max);
}

/**
 * Rules-based Flotek Fit Score. Every point awarded has a human-readable reason.
 * The weights come from Settings; the maxima below are the defaults the rules
 * were written against and points are scaled if the weights are changed.
 */
export function scoreNotice(
  n: RawNotice,
  region: RegionId | "unknown",
  buyerType: string,
  settings: Settings,
): FitResult {
  const w = settings.weights;
  const reasons: FitReason[] = [];
  const title = n.title || "";
  const body = `${n.description || ""}\n${n.lots.map((l) => `${l.title || ""} ${l.description || ""}`).join("\n")}`;

  // ---- Exclusions ----
  const excl = matchesAnyTerm(settings.excludeKeywords, title);
  if (excl) {
    return {
      score: 0,
      category: "LOW FIT",
      reasons: [{ points: 0, label: `Excluded: title contains "${excl}"` }],
      matchedServices: [],
      matchedKeywords: [],
      matchedCpv: [],
      excluded: excl,
    };
  }

  // ---- Keyword matching ----
  const groupMatches = matchKeywords(settings.keywordGroups, title, body);
  const matchedServices = groupMatches.map((g) => g.label);
  const matchedKeywords = groupMatches.flatMap((g) => [...g.titleHits, ...g.bodyHits]);

  // ---- 1. Service / category match (up to 30) ----
  let servicePts = 0;
  let serviceLabel = "";
  let best = 0;
  for (const g of groupMatches) {
    const strength = g.titleHits.length * 2 + g.bodyHits.length;
    if (strength > best) {
      best = strength;
      const strong = g.titleHits.length >= 1 && strength >= 3;
      const medium = g.titleHits.length >= 1 || g.bodyHits.length >= 3;
      const p = strong ? 30 : medium ? 20 : g.bodyHits.length >= 2 ? 12 : 6;
      servicePts = p;
      serviceLabel = strong
        ? `Strong ${g.label} match (${g.titleHits.slice(0, 2).join(", ")} in title)`
        : medium
          ? `${g.label} match (${[...g.titleHits, ...g.bodyHits].slice(0, 2).join(", ")})`
          : `Some ${g.label} relevance (${g.bodyHits[0]})`;
    }
  }
  if (servicePts) reasons.push({ points: scaled(servicePts, w.service, 30), label: serviceLabel });

  // ---- 2. CPV match (up to 20) ----
  const cpvMatches = matchCpv(settings.cpvLibrary, n.cpv);
  let cpvPts = 0;
  let cpvLabel = "";
  for (const m of cpvMatches) {
    const p = m.level === "exact" ? 20 : m.level === "class" ? 14 : m.level === "category" ? 8 : 4;
    if (p > cpvPts) {
      cpvPts = p;
      cpvLabel =
        m.level === "exact"
          ? `Exact CPV match ${m.code} (${m.entry.label})`
          : m.level === "class"
            ? `Close CPV match ${m.code} (${m.entry.label})`
            : m.level === "category"
              ? `Related CPV ${m.code} (${m.entry.label} category)`
              : `CPV division ${m.code.slice(0, 2)} (IT / telecoms)`;
    }
  }
  if (cpvPts) reasons.push({ points: scaled(cpvPts, w.cpv, 20), label: cpvLabel });
  else if (n.cpv.length) reasons.push({ points: 0, label: `CPV ${n.cpv[0]} not in Flotek library` });
  else reasons.push({ points: 0, label: "No CPV code published" });

  // ---- 3. Keyword strength (up to 15) ----
  const distinct = new Set(matchedKeywords.map((k) => k.toLowerCase())).size;
  const kwPts = distinct >= 6 ? 15 : distinct >= 4 ? 12 : distinct === 3 ? 9 : distinct === 2 ? 6 : distinct === 1 ? 3 : 0;
  if (kwPts) reasons.push({ points: scaled(kwPts, w.keyword, 15), label: `${distinct} relevant keyword${distinct > 1 ? "s" : ""} matched` });

  // ---- 4. Preferred buyer / sector (up to 10) ----
  const buyerPts = settings.buyerPoints[buyerType] ?? 0;
  if (buyerPts) reasons.push({ points: scaled(buyerPts, w.buyer, 10), label: `${BUYER_TYPE_LABEL[buyerType] || buyerType} buyer` });

  // ---- 5. Preferred geography (up to 10) ----
  let geoPts = 0;
  let geoLabel = "";
  const preferred = settings.defaultRegions;
  if (region === "unknown") {
    geoPts = 4;
    geoLabel = "Location not stated (not penalised)";
  } else if (preferred.includes(region)) {
    geoPts = 10;
    geoLabel = `${REGION_LABEL[region]} (preferred region)`;
  } else if (region === "uk") {
    geoPts = 8;
    geoLabel = "UK wide delivery";
  } else if (["southwest", "midlands", "northwest", "england"].includes(region)) {
    geoPts = 5;
    geoLabel = `${REGION_LABEL[region]} (deliverable from Wales)`;
  } else {
    geoPts = 2;
    geoLabel = `${REGION_LABEL[region]} (outside core geography)`;
  }
  reasons.push({ points: scaled(geoPts, w.geography, 10), label: geoLabel });

  // ---- 6. Contract value suitability (up to 5) ----
  const v = n.value ?? n.valueMax ?? null;
  let valPts = 2;
  let valLabel = "Value not stated";
  if (v != null) {
    if (v >= settings.valueIdealMin && v <= settings.valueIdealMax) {
      valPts = 5;
      valLabel = `Value ${fmtMoney(v)} within Flotek's ideal range`;
    } else if (v > settings.valueIdealMax) {
      valPts = 3;
      valLabel = `Value ${fmtMoney(v)} is large (partnering may be needed)`;
    } else if (v >= settings.valueIdealMin / 2) {
      valPts = 3;
      valLabel = `Value ${fmtMoney(v)} below ideal range`;
    } else {
      valPts = 1;
      valLabel = `Value ${fmtMoney(v)} is small`;
    }
  }
  reasons.push({ points: scaled(valPts, w.value, 5), label: valLabel });

  // ---- 7. Recurring / framework potential (up to 5) ----
  let fwPts = 0;
  let fwLabel = "";
  const fwText = `${title} ${body} ${n.procurementMethodDetails || ""}`;
  const years = durationYears(n);
  if (n.isFramework || n.isDps || /\b(framework|dynamic purchasing|dynamic market|dps\b)/i.test(fwText)) {
    fwPts = 5;
    fwLabel = n.isDps ? "Dynamic purchasing system / dynamic market" : "Framework opportunity";
  } else if (years != null && years >= 3) {
    fwPts = 5;
    fwLabel = `Multi-year term (${years} years)`;
  } else if (years != null && years >= 2) {
    fwPts = 3;
    fwLabel = `${years}-year term`;
  } else if (/\b(managed service|support and maintenance|ongoing support|annual|recurring|extension)\b/i.test(fwText)) {
    fwPts = 3;
    fwLabel = "Recurring service potential";
  }
  if (fwPts) reasons.push({ points: scaled(fwPts, w.framework, 5), label: fwLabel });

  // ---- 8. Multiple Flotek service matches (up to 5) ----
  const groupCount = groupMatches.length;
  const multiPts = groupCount >= 3 ? 5 : groupCount === 2 ? 3 : 0;
  if (multiPts) reasons.push({ points: scaled(multiPts, w.multiService, 5), label: `${groupCount} Flotek service areas matched` });

  let score = reasons.reduce((s, r) => s + r.points, 0);
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    category: fitCategory(score),
    reasons: reasons.filter((r) => r.points !== 0 || r.label.startsWith("No CPV") || r.label.includes("not in Flotek")),
    matchedServices,
    matchedKeywords: [...new Set(matchedKeywords)],
    matchedCpv: cpvMatches.map((m) => m.code),
  };
}

export function durationYears(n: RawNotice): number | null {
  if (n.contractStart && n.contractEnd) {
    const a = Date.parse(n.contractStart);
    const b = Date.parse(n.contractEnd);
    if (!isNaN(a) && !isNaN(b) && b > a) return Math.round(((b - a) / (365.25 * 86400000)) * 10) / 10;
  }
  const m = (n.durationText || "").match(/(\d+)\s*(year|yr|month)/i);
  if (m) return m[2].toLowerCase().startsWith("m") ? Math.round((parseInt(m[1], 10) / 12) * 10) / 10 : parseInt(m[1], 10);
  return null;
}

export function fmtMoney(v: number | null | undefined, currency = "GBP"): string {
  if (v == null || isNaN(v)) return "Not stated";
  const sym = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency + " ";
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, "")}m`;
  if (v >= 1000) return `${sym}${Math.round(v / 1000)}k`;
  return `${sym}${Math.round(v)}`;
}

export function fmtMoneyFull(v: number | null | undefined, currency = "GBP"): string {
  if (v == null || isNaN(v)) return "Not stated";
  const sym = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency + " ";
  return sym + Math.round(v).toLocaleString("en-GB");
}

/** Quick relevance pre-filter used by the source connectors before staging. */
export function isCandidate(n: RawNotice, settings: Settings): boolean {
  if (matchCpv(settings.cpvLibrary, n.cpv).some((m) => m.level !== "division")) return true;
  const body = n.description || "";
  return matchKeywords(settings.keywordGroups, n.title, body).length > 0;
}
