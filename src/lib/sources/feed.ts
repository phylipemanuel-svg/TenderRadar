import { XMLParser } from "fast-xml-parser";
import type { RawNotice } from "../types";
import { fetchText, SourceRunInput, SourceRunResult } from "./common";
import { stripHtml, cleanText } from "../sanitise";
import { isCandidate } from "../scoring";
import { safeExternalUrl, isAllowedFetchUrl } from "../urls";
import type { SourceDefinition } from "../types";

/**
 * Generic RSS / Atom feed connector for procurement portals that publish a
 * public notice feed but no search API (Sell2Wales, Public Contracts Scotland,
 * eTendersNI). The feed URL is entered in Settings and must be on the source's
 * own domain (allowlist enforced) — nothing else is ever fetched.
 *
 * Feeds carry less structure than OCDS (often no CPV, value or deadline), so
 * these notices score on keywords and the buyer, and are flagged for manual
 * checking of the deadline on the portal.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

function arr(x: any): any[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function text(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object") return String(x["#text"] ?? x.href ?? "");
  return String(x);
}

function extractDeadline(s: string): string | null {
  const m = s.match(/(deadline|closing date|closes|return by|submission date)[^0-9]{0,30}(\d{1,2}[\/\-\s](?:\d{1,2}|[A-Za-z]{3,9})[\/\-\s]\d{2,4})/i);
  if (!m) return null;
  const d = new Date(m[2].replace(/\//g, " "));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function extractValue(s: string): number | null {
  const m = s.match(/£\s?([\d,]+(?:\.\d+)?)\s*(m|k|million|thousand)?/i);
  if (!m) return null;
  let v = parseFloat(m[1].replace(/,/g, ""));
  const suf = (m[2] || "").toLowerCase();
  if (suf === "m" || suf === "million") v *= 1_000_000;
  if (suf === "k" || suf === "thousand") v *= 1000;
  return Number.isFinite(v) ? v : null;
}

function extractCpv(s: string): string[] {
  const out = new Set<string>();
  for (const m of s.matchAll(/\b(\d{8})(?:-\d)?\b/g)) if (["32", "45", "48", "50", "51", "64", "72", "79", "30", "35"].includes(m[1].slice(0, 2))) out.add(m[1]);
  return [...out];
}

export async function runFeedSource(def: SourceDefinition, feedUrl: string, input: SourceRunInput): Promise<SourceRunResult> {
  if (!feedUrl) {
    return {
      status: "NOT CONNECTED",
      message: `No feed URL configured. Paste the ${def.label} RSS/Atom feed link into Settings > Feed sources.`,
      checked: 0,
      candidates: [],
      nextCursor: null,
      pages: 0,
    };
  }
  if (!isAllowedFetchUrl(feedUrl, def.allowedHosts)) {
    return { status: "ERROR", message: `Feed URL must be an https link on ${def.allowedHosts[0]}`, checked: 0, candidates: [], nextCursor: null, pages: 0 };
  }
  const xml = await fetchText(feedUrl, 25000, def.allowedHosts);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", textNodeName: "#text" });
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new Error("Feed did not return valid XML");
  }
  const items: any[] = arr(doc?.rss?.channel?.item).concat(arr(doc?.feed?.entry));
  if (!items.length && !doc?.rss && !doc?.feed) throw new Error("Response was not an RSS or Atom feed");

  const since = Date.now() - input.params.lookbackDays * 86400000;
  const candidates: RawNotice[] = [];
  let checked = 0;
  for (const it of items) {
    checked++;
    const title = cleanText(text(it.title), 300);
    const linkRaw = text(it.link) || text(arr(it.link)[0]);
    const url = safeExternalUrl(linkRaw);
    const bodyRaw = text(it.description) || text(it.summary) || text(it.content) || "";
    const description = stripHtml(bodyRaw, 8000);
    const pubRaw = text(it.pubDate) || text(it.published) || text(it.updated) || text(it["dc:date"]);
    const published = pubRaw && !isNaN(Date.parse(pubRaw)) ? new Date(pubRaw).toISOString() : null;
    if (published && Date.parse(published) < since) continue;
    // Buyer: many feeds put "Buyer: X" or "Organisation: X" in the body, or prefix the title.
    const bm = `${bodyRaw}`.match(/(?:buyer|organisation|organization|authority|contracting authority|published by)\s*[:\-]\s*([^<\n|]{3,120})/i);
    let buyer = bm ? cleanText(bm[1], 160) : "";
    if (!buyer) {
      const tm = title.match(/^([^:\-–]{4,80})\s*[:\-–]\s+/);
      buyer = tm ? tm[1].trim() : def.label;
    }
    if (!title) continue;
    const n: RawNotice = {
      ocid: null,
      reference: text(it.guid) ? cleanText(text(it.guid), 120) : null,
      noticeId: url,
      title,
      buyer,
      description,
      published,
      deadline: extractDeadline(`${title}\n${bodyRaw}`),
      value: extractValue(bodyRaw),
      currency: "GBP",
      procurementMethod: null,
      procurementMethodDetails: null,
      stage: /\b(award|awarded|contract award)\b/i.test(title) ? "award" : /\b(prior information|pin\b|market engagement)/i.test(title) ? "planning" : "tender",
      rawStatus: null,
      isFramework: /framework/i.test(title),
      isDps: /dynamic purchasing|\bDPS\b/i.test(title),
      lots: [],
      cpv: extractCpv(bodyRaw),
      regionCodes: [],
      locationText: cleanText(bodyRaw, 300),
      contractStart: null,
      contractEnd: null,
      durationText: null,
      extensionsText: null,
      url,
      documents: url ? [{ title: "Notice on " + def.label, url }] : [],
      sourceId: def.id,
      sourceLabel: def.label,
    };
    if (n.stage !== "award" && isCandidate(n, input.settings)) candidates.push(n);
  }
  return { status: "CONNECTED", message: `Feed read: ${checked} items`, checked, candidates, nextCursor: null, pages: 1 };
}
