import type { RawNotice, SourceDefinition } from "../types";
import { SourceRunInput, SourceRunResult, USER_AGENT, causeOf } from "./common";
import { runProactisApi, probeProactisApi } from "./proactis";
import { stripHtml, cleanText } from "../sanitise";
import { isCandidate } from "../scoring";
import { isAllowedFetchUrl } from "../urls";

/**
 * Sell2Wales has two routes to its notices:
 *
 *  1. The OCDS API (proactis.ts) — structured, preferred.
 *  2. The public website search (search_mainpage.aspx) — no login needed.
 *
 * Since late 2026 the API's notice list returns HTTP 500 ("Error converting
 * data type nvarchar to float") for any month that holds notices. So every
 * search first probes the API with one request; if it answers, the API is used
 * as before, otherwise the website search is read instead. When Sell2Wales
 * fixes the API the connector moves back to it without any change here.
 *
 * The website is an ASP.NET WebForms page: 10 results a page, paged by form
 * postback. Results are sorted newest first and default to open, future and
 * pipeline opportunities (no awards), so reading stops once a page goes past
 * the look-back window. Listings carry title, summary, buyer, dates, value,
 * location and OCID but no CPV codes, so they are matched on keywords.
 */

const ORIGIN = "https://www.sell2wales.gov.wales";
const SEARCH_URL = `${ORIGIN}/search/search_mainpage.aspx`;
const PAGER_TARGET = "ctl00$MainBody$rpNoticeResultsPager";
const PAGES_PER_CALL = 6; // ~6-7s a page, keeps each call well inside maxDuration
const MAX_PAGES = 80;
const TIMEOUT_MS = 45000;

/* ---------- connector entry point: API first, website if the API is failing ---------- */

export async function runSell2Wales(def: SourceDefinition, input: SourceRunInput): Promise<SourceRunResult> {
  const cursor = input.cursor;
  if (cursor?.startsWith("api:")) return withPrefix("api:", await runProactisApi(def, { ...input, cursor: cursor.slice(4) || null }));
  if (cursor?.startsWith("web:")) {
    const [page, ...why] = cursor.slice(4).split("|");
    return runSell2WalesWeb(def, input, parseInt(page, 10), why.join("|"));
  }
  if (cursor) throw new Error("Invalid continuation cursor");

  let apiFault: string;
  try {
    await probeProactisApi(def);
    return withPrefix("api:", await runProactisApi(def, { ...input, cursor: null }));
  } catch (e) {
    apiFault = e instanceof Error ? e.message : String(e);
  }
  return runSell2WalesWeb(def, input, 1, apiFault.slice(0, 160));
}

function withPrefix(prefix: string, r: SourceRunResult): SourceRunResult {
  return { ...r, nextCursor: r.nextCursor ? prefix + r.nextCursor : null };
}

/* ---------- website search ---------- */

class Session {
  private cookies = new Map<string, string>();

  async request(url: string, form?: Record<string, string>): Promise<string> {
    if (!isAllowedFetchUrl(url)) throw new Error(`Refusing to fetch non-allowlisted URL host: ${url.slice(0, 80)}`);
    const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "text/html" };
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { method: form ? "POST" : "GET", headers, body: form ? new URLSearchParams(form).toString() : undefined, signal: ac.signal, cache: "no-store" });
    } catch (e) {
      throw new Error(`Could not connect to www.sell2wales.gov.wales: ${causeOf(e)}`);
    } finally {
      clearTimeout(t);
    }
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from www.sell2wales.gov.wales search`);
    return res.text();
  }
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag);
  return m ? decode(m[1]) : null;
}

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|#39);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos" || k === "#39") return "'";
    const code = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}

/** The form fields a browser would post back: hidden state, ticked boxes, text inputs and selects. */
export function formState(html: string): Record<string, string> {
  const form: Record<string, string> = {};
  for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const name = attr(tag, "name");
    if (!name) continue;
    const type = (attr(tag, "type") || "text").toLowerCase();
    if (type === "hidden" || type === "text") form[name] = attr(tag, "value") ?? "";
    else if ((type === "checkbox" || type === "radio") && /\schecked\b/i.test(tag)) form[name] = attr(tag, "value") ?? "on";
  }
  for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const name = attr(m[1], "name");
    if (!name) continue;
    const opts = [...m[2].matchAll(/<option\b[^>]*>/gi)].map((o) => o[0]);
    const sel = opts.find((o) => /\sselected\b/i.test(o)) ?? opts[0];
    if (sel) form[name] = attr(sel, "value") ?? "";
  }
  form["ctl00$MainBody$ddSortOrder"] = "publishDateDESC";
  return form;
}

function ukDate(s: string): string | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s);
  if (!m) return null;
  const [, d, mo, y, hh, mm] = m;
  const date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return hh ? `${date}T${hh.padStart(2, "0")}:${mm}:00` : date;
}

function parseValue(s: string): { value: number | null; valueMin: number | null; valueMax: number | null } {
  const nums = [...s.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((x) => Number(x[0])).filter((n) => n > 0);
  if (!nums.length) return { value: null, valueMin: null, valueMax: null };
  if (nums.length === 1) return { value: nums[0], valueMin: null, valueMax: null };
  return { value: Math.max(...nums), valueMin: Math.min(...nums), valueMax: Math.max(...nums) };
}

/** Procurement Act UK1-UK3 and PINs are pre-tender; UK5 onwards are awards, contract details and changes. */
function stageOf(type: string): RawNotice["stage"] {
  const t = type.trim();
  const uk = /^UK(\d+)$/i.exec(t);
  if (uk) return Number(uk[1]) <= 3 ? "planning" : Number(uk[1]) === 4 ? "tender" : "award";
  if (/award|modification|change|termination|completion/i.test(t)) return "award";
  if (/prior information|\bpin\b|pipeline|future|market engagement|planned/i.test(t)) return "planning";
  return "tender";
}

function property(block: string, label: string): string {
  const m = new RegExp(`<span class="notice-refno">\\s*${label}:?\\s*</span>\\s*<span[^>]*>([\\s\\S]*?)</span>`, "i").exec(block);
  return m ? cleanText(m[1], 400) : "";
}

export interface WebPage {
  notices: RawNotice[];
  page: number | null;
  totalPages: number | null;
}

export function parseResultsPage(html: string, def: Pick<SourceDefinition, "id" | "label">): WebPage {
  const blocks = html.split(/<div class="search-result">/).slice(1);
  const notices: RawNotice[] = [];
  for (const raw of blocks) {
    const block = raw.split(/<div class="search-result">|<div[^>]*class="[^"]*pager/)[0];
    const a = /<a class="notice-title" href="([^"]*ID=([A-Z0-9]+)[^"]*)">([\s\S]*?)<\/a>/i.exec(block);
    if (!a) continue;
    const id = a[2];
    const title = cleanText(decode(a[3]), 300);
    // the full summary is usually in aria-label; when that is empty, the visible (possibly truncated) text is used
    const descTag = /<span id=['"]lblDescription_[^'"]*['"] aria-label=(?:'([^']*)'|"([^"]*)")\s*>([\s\S]*?)<\/span>/i.exec(block);
    const description = stripHtml(decode((descTag?.[1] || descTag?.[2] || descTag?.[3] || "").trim()), 8000);
    const allLoc = new RegExp(`id="allLocations_${id}"[^>]*>([\\s\\S]*?)<a\\b`, "i").exec(block);
    const location = cleanText(allLoc ? allLoc[1] : property(block, "Location"), 400);
    const buyer = property(block, "Published by");
    const type = property(block, "Notice Type");
    const ocid = property(block, "OCID") || null;
    const deadline = ukDate(property(block, "Deadline date"));
    const { value, valueMin, valueMax } = parseValue(property(block, "Value"));
    const url = new URL(a[1].replace(/&amp;/g, "&"), ORIGIN).toString();
    if (!title || !buyer) continue;
    notices.push({
      ocid,
      reference: property(block, "Reference no") || id,
      noticeId: id,
      title,
      buyer,
      description,
      published: ukDate(property(block, "Publication date")),
      deadline,
      value,
      valueMin,
      valueMax,
      currency: "GBP",
      procurementMethod: null,
      procurementMethodDetails: type ? `Sell2Wales ${type}` : null,
      stage: stageOf(type),
      rawStatus: null,
      isFramework: /framework/i.test(`${title} ${description}`),
      isDps: /dynamic (purchasing|market)|\bDPS\b/i.test(`${title} ${description}`),
      lots: [],
      cpv: [],
      regionCodes: [],
      locationText: location,
      contractStart: null,
      contractEnd: null,
      durationText: null,
      extensionsText: null,
      url,
      documents: [{ title: `Notice on ${def.label}`, url }],
      sourceId: def.id,
      sourceLabel: def.label,
    });
  }
  const pg = /Page\s+(\d+)\s+of\s+(\d+)/i.exec(html);
  return { notices, page: pg ? Number(pg[1]) : null, totalPages: pg ? Number(pg[2]) : null };
}

async function runSell2WalesWeb(def: SourceDefinition, input: SourceRunInput, startPage: number, apiFault: string): Promise<SourceRunResult> {
  if (!Number.isFinite(startPage) || startPage < 1 || startPage > MAX_PAGES) throw new Error("Invalid continuation cursor");
  const since = Date.now() - input.params.lookbackDays * 86400000;
  const session = new Session();
  const first = await session.request(SEARCH_URL);
  const form = formState(first);
  if (!form.__VIEWSTATE) throw new Error("Sell2Wales website search layout not recognised (no form state); the connector needs updating");

  const candidates: RawNotice[] = [];
  let checked = 0;
  let pages = 0;
  let reachedEnd = false;
  let failure: string | null = null;
  let page = startPage;

  for (; page < startPage + PAGES_PER_CALL; page++) {
    let html: string;
    try {
      html = page === 1 ? first : await session.request(SEARCH_URL, { ...form, __EVENTTARGET: PAGER_TARGET, __EVENTARGUMENT: String(page) });
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
      break;
    }
    pages++;
    const parsed = parseResultsPage(html, def);
    if (!parsed.notices.length) {
      if (page === 1 && !parsed.totalPages) throw new Error("Sell2Wales website search layout not recognised (no results found on page 1); the connector needs updating");
      reachedEnd = true;
      break;
    }
    let older = 0;
    for (const n of parsed.notices) {
      if (n.published && Date.parse(n.published) < since) {
        older++;
        continue;
      }
      checked++;
      if (n.stage !== "award" && isCandidate(n, input.settings)) candidates.push(n);
    }
    // newest first: once a whole page is outside the window there is nothing more to read
    if (older === parsed.notices.length || (parsed.totalPages != null && page >= parsed.totalPages) || page >= MAX_PAGES) {
      reachedEnd = true;
      break;
    }
  }

  const why = `the Sell2Wales API is failing (${apiFault || "no response"})`;
  if (failure) {
    if (page === 1) throw new Error(failure);
    return { status: "CONNECTED", message: `Partial: read the Sell2Wales website search up to page ${page - 1} because ${why}, then it stopped responding (${failure}).`, checked, candidates, nextCursor: null, pages };
  }
  if (!reachedEnd) {
    return { status: "CONNECTED", message: `Reading Sell2Wales website search, page ${page - 1}…`, checked, candidates, nextCursor: `web:${page}|${apiFault}`, pages };
  }
  return {
    status: "CONNECTED",
    message: `Fallback: read from the Sell2Wales website search because ${why}. Website listings carry no CPV codes, so these notices are matched on keywords only.`,
    checked,
    candidates,
    nextCursor: null,
    pages,
  };
}
