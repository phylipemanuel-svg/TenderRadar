import type { RawNotice, NoticeDocument, Lot } from "../types";
import { stripHtml, cleanText } from "../sanitise";
import { normaliseCpv } from "../cpv";
import { safeExternalUrl } from "../urls";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

/** Collect releases from either feed shape (FTS: {releases:[]}, CF: {results:[{releases:[]}]}). */
export function collectReleases(json: Any): Any[] {
  if (!json) return [];
  if (Array.isArray(json.releases)) return json.releases;
  const out: Any[] = [];
  if (Array.isArray(json.results)) {
    for (const r of json.results) {
      if (Array.isArray(r.releases)) out.push(...r.releases);
      else if (r.tender) out.push(r);
    }
  }
  if (Array.isArray(json.records)) {
    for (const r of json.records) {
      if (r.compiledRelease) out.push(r.compiledRelease);
      else if (Array.isArray(r.releases)) out.push(...r.releases);
    }
  }
  return out;
}

function cpvCodes(t: Any): string[] {
  const codes = new Set<string>();
  const push = (c: Any) => {
    if (!c) return;
    const scheme = String(c.scheme || "").toUpperCase();
    if (scheme && scheme !== "CPV") return;
    const n = normaliseCpv(c.id);
    if (n) codes.add(n);
  };
  push(t?.classification);
  for (const c of t?.additionalClassifications || []) push(c);
  for (const it of t?.items || []) {
    push(it.classification);
    for (const c of it.additionalClassifications || []) push(c);
  }
  for (const l of t?.lots || []) {
    push(l.classification);
    for (const c of l.additionalClassifications || []) push(c);
  }
  return [...codes];
}

function buyerParty(r: Any): Any {
  const parties: Any[] = Array.isArray(r.parties) ? r.parties : [];
  const buyerId = r.buyer?.id;
  return (
    parties.find((p) => buyerId && p.id === buyerId) ||
    parties.find((p) => (p.roles || []).includes("buyer")) ||
    parties.find((p) => (p.roles || []).includes("procuringEntity")) ||
    null
  );
}

function toNumber(v: Any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function docsOf(t: Any): NoticeDocument[] {
  const out: NoticeDocument[] = [];
  for (const d of t?.documents || []) {
    const url = safeExternalUrl(d.url);
    if (!url) continue;
    out.push({ title: cleanText(d.title || d.documentType || "Document", 120), url, type: cleanText(d.documentType, 40) });
    if (out.length >= 20) break;
  }
  return out;
}

function stageOf(r: Any, t: Any): RawNotice["stage"] {
  const tags: string[] = Array.isArray(r.tag) ? r.tag.map(String) : [];
  if (tags.some((x) => x.startsWith("award") || x.startsWith("contract"))) return "award";
  if (tags.includes("planning") || tags.includes("planningUpdate")) return "planning";
  if (tags.includes("tender") || tags.includes("tenderUpdate") || tags.includes("tenderAmendment")) return "tender";
  if (r.planning && !t?.tenderPeriod?.endDate) return "planning";
  if (t?.status === "planned" || t?.status === "planning") return "planning";
  if (t?.status === "complete" || r.awards?.length) return "award";
  if (t?.title) return "tender";
  return "unknown";
}

function periodOf(t: Any): Any {
  if (t?.contractPeriod?.startDate || t?.contractPeriod?.endDate || t?.contractPeriod?.durationInDays) return t.contractPeriod;
  const lot = (t?.lots || []).find((l: Any) => l?.contractPeriod);
  return lot?.contractPeriod || null;
}

function renewalOf(t: Any): Any {
  if (t?.renewal) return t.renewal;
  const lot = (t?.lots || []).find((l: Any) => l?.renewal || l?.options);
  return lot ? { ...(lot.renewal || {}), options: lot.options } : null;
}

function durationText(t: Any): string | null {
  const cp = periodOf(t);
  if (!cp) return null;
  if (cp.durationInDays) {
    const d = Number(cp.durationInDays);
    if (d >= 365) return `${Math.round((d / 365.25) * 10) / 10} years`;
    if (d >= 30) return `${Math.round(d / 30)} months`;
    return `${d} days`;
  }
  if (cp.startDate && cp.endDate) {
    const days = (Date.parse(cp.endDate) - Date.parse(cp.startDate)) / 86400000;
    if (days >= 365) return `${Math.round((days / 365.25) * 10) / 10} years`;
    if (days >= 30) return `${Math.round(days / 30)} months`;
  }
  return null;
}

function extensionsText(t: Any): string | null {
  const parts: string[] = [];
  const r = renewalOf(t);
  if (r?.description) parts.push(cleanText(r.description, 200));
  else if (r?.options?.description) parts.push(cleanText(r.options.description, 200));
  if (r?.maximumRenewals) parts.push(`up to ${r.maximumRenewals} renewal(s)`);
  if (r?.period?.durationInDays) parts.push(`each ${Math.round(r.period.durationInDays / 30)} months`);
  const cp = periodOf(t);
  if (cp?.maxExtentDate) parts.push(`max extent ${String(cp.maxExtentDate).slice(0, 10)}`);
  return parts.length ? parts.join(", ") : null;
}

function vatBasis(t: Any): string | null {
  // Procurement Act notices publish amount (net) and amountGross (inc VAT)
  if (t?.value?.amountGross != null && t?.value?.amount != null) return "Excluding VAT";
  const s = JSON.stringify(t?.value || {}).toLowerCase();
  if (/excl|ex vat|exclusive/.test(s)) return "Excluding VAT";
  if (/incl|inc vat|inclusive|gross/.test(s)) return "Including VAT";
  return null;
}

export function normaliseRelease(r: Any, sourceId: string, sourceLabel: string, noticeUrlFor: (r: Any) => string | null, stageHint?: RawNotice["stage"]): RawNotice | null {
  const t = r.tender || {};
  const party = buyerParty(r);
  const buyer = cleanText(r.buyer?.name || party?.name || t.procuringEntity?.name, 200);
  const title = cleanText(t.title || r.title, 300);
  if (!buyer || !title) return null;

  const addr = party?.address || {};
  const regionCodes: string[] = [];
  const locBits: string[] = [];
  const pushAddr = (a: Any) => {
    if (!a) return;
    if (a.region) {
      regionCodes.push(String(a.region));
      locBits.push(String(a.region));
    }
    for (const k of ["streetAddress", "locality", "region", "postalCode", "countryName", "description"]) if (a[k]) locBits.push(String(a[k]));
  };
  for (const it of t.items || []) {
    if (Array.isArray(it.deliveryAddresses)) it.deliveryAddresses.forEach(pushAddr);
    pushAddr(it.deliveryAddress);
    if (it.deliveryLocation?.description) locBits.push(String(it.deliveryLocation.description));
    if (it.deliveryLocation?.nuts) regionCodes.push(String(it.deliveryLocation.nuts));
  }
  if (Array.isArray(t.deliveryAddresses)) t.deliveryAddresses.forEach(pushAddr);
  if (Array.isArray(t.deliveryLocations)) for (const l of t.deliveryLocations) if (l?.description) locBits.push(String(l.description));
  pushAddr(addr);
  const postcode = addr.postalCode ? String(addr.postalCode) : null;

  const lots: Lot[] = (t.lots || []).slice(0, 30).map((l: Any) => ({
    id: l.id ? String(l.id) : undefined,
    title: cleanText(l.title, 200),
    value: toNumber(l.value?.amount),
    description: cleanText(l.description, 400),
  }));

  const value = toNumber(t.value?.amount) ?? toNumber(t.value?.amountGross) ?? toNumber(r.planning?.budget?.amount?.amount);
  const method = t.procurementMethod ? String(t.procurementMethod) : null;
  const methodDetails = cleanText(t.procurementMethodDetails, 200) || null;
  const techniques = t.techniques || {};
  const isFramework = !!techniques.hasFrameworkAgreement || /framework/i.test(methodDetails || "");
  const isDps = !!techniques.hasDynamicPurchasingSystem || /dynamic (purchasing|market)/i.test(methodDetails || "") || /\bDPS\b/.test(title);

  const documents = docsOf(t);
  const noticeDoc = documents.find((d) => /tendernotice|notice/i.test(d.type || ""));
  const url = noticeUrlFor(r) || noticeDoc?.url || safeExternalUrl(t.url) || documents[0]?.url || null;

  return {
    ocid: r.ocid ? String(r.ocid) : null,
    reference: t.id ? String(t.id).slice(0, 120) : null,
    noticeId: r.id ? String(r.id).slice(0, 160) : null,
    title,
    buyer,
    buyerClassification: party?.details?.classifications?.map((c: Any) => c.description || c.id).join(", ") || party?.details?.scale || null,
    description: stripHtml(
      [t.description || r.planning?.rationale || "", t.submissionMethodDetails ? `\n\nHow to apply: ${t.submissionMethodDetails}` : ""].join(""),
      12000,
    ),
    published: r.date ? String(r.date) : null,
    deadline: t.tenderPeriod?.endDate ? String(t.tenderPeriod.endDate) : t.enquiryPeriod?.endDate ? String(t.enquiryPeriod.endDate) : null,
    value,
    valueMin: toNumber(t.minValue?.amount),
    valueMax: toNumber(t.maxValue?.amount),
    currency: t.value?.currency || "GBP",
    vatBasis: vatBasis(t),
    procurementMethod: method,
    procurementMethodDetails: methodDetails,
    stage: (() => { const st = stageOf(r, t); return st === "unknown" && stageHint ? stageHint : st; })(),
    rawStatus: t.status ? String(t.status) : null,
    isFramework,
    isDps,
    lots,
    cpv: cpvCodes(t),
    regionCodes: [...new Set(regionCodes)],
    locationText: cleanText(locBits.join(" | "), 600),
    postcode,
    contractStart: periodOf(t)?.startDate ? String(periodOf(t).startDate) : null,
    contractEnd: periodOf(t)?.endDate ? String(periodOf(t).endDate) : null,
    durationText: durationText(t),
    extensionsText: extensionsText(t),
    url,
    documents,
    sourceId,
    sourceLabel,
  };
}
