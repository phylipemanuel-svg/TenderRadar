import { collectReleases, normaliseRelease } from "./ocds";
import { fetchJson, SourceRunInput, SourceRunResult } from "./common";
import { isCandidate } from "../scoring";
import type { RawNotice, SourceDefinition } from "../types";

/**
 * Sell2Wales and Public Contracts Scotland share the same public "OCDS Web API"
 * (no key, Open Government Licence):
 *   https://api.sell2wales.gov.wales/v1              (documentation)
 *   https://api.publiccontractsscotland.gov.uk/v1    (documentation)
 *
 * GET /v1/Notices?dateFrom=mm-yyyy&noticeType=N&outputType=0 returns every
 * notice of one type published in one calendar month, in OCDS format. The
 * connector therefore walks month × notice-type combinations for the look-back
 * window. Each call to the connector handles a few combinations and hands back
 * a cursor so the browser can keep going without hitting the time limit.
 */

const NOTICE_TYPES: { type: number; label: string; stage: RawNotice["stage"] }[] = [
  { type: 2, label: "Contract notice", stage: "tender" },
  { type: 51, label: "Website invitation to tender", stage: "tender" },
  { type: 21, label: "Social and other specific services", stage: "tender" },
  { type: 5, label: "Contract notice (utilities)", stage: "tender" },
  { type: 24, label: "Concession notice", stage: "tender" },
  { type: 1, label: "Prior information notice", stage: "planning" },
  { type: 52, label: "Website prior information notice", stage: "planning" },
];
const REQUESTS_PER_CALL = 6;

/** Each portal's API is reachable on more than one hostname; the first that answers is remembered. */
export const PROACTIS_ENDPOINTS: Record<string, string[]> = {
  sell2wales: ["https://api.sell2wales.gov.wales/v1/Notices", "https://api-sell2wales.klickstream.com/v1/Notices"],
  pcs: ["https://api.publiccontractsscotland.gov.uk/v1/Notices"],
};
const workingEndpoint = new Map<string, string>();

/**
 * Parameter styles to try. The documented form comes first; if the API answers
 * with a server error (HTTP 500) the next variant is tried, and the one that
 * works is remembered for the rest of the search.
 */
type Variant = "documented" | "noLocale" | "minimal" | "tedOutput";
const VARIANTS: Variant[] = ["documented", "noLocale", "minimal", "tedOutput"];
const workingVariant = new Map<string, Variant>();

function buildUrl(endpoint: string, id: string, month: string, type: number, variant: Variant): string {
  const u = new URL(endpoint);
  u.searchParams.set("dateFrom", month);
  u.searchParams.set("noticeType", String(type));
  if (variant !== "minimal") u.searchParams.set("outputType", variant === "tedOutput" ? "1" : "0");
  if (variant === "documented" && id === "sell2wales") u.searchParams.set("locale", "2057");
  return u.toString();
}

async function fetchWithFallback(id: string, month: string, type: number, hosts: string[]): Promise<any> {
  const list = PROACTIS_ENDPOINTS[id];
  const preferred = workingEndpoint.get(id);
  const order = preferred ? [preferred, ...list.filter((x) => x !== preferred)] : list;
  const pv = workingVariant.get(id);
  const variants = pv ? [pv] : VARIANTS;
  let lastErr: unknown;
  for (const ep of order) {
    for (const v of variants) {
      try {
        const json = await fetchJson(buildUrl(ep, id, month, type, v), 40000, hosts);
        workingEndpoint.set(id, ep);
        workingVariant.set(id, v);
        return json;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        // connection-level problems: move to the next host; server errors: try the next parameter style
        if (/Could not connect/.test(msg)) break;
      }
    }
  }
  throw lastErr;
}

function monthsBack(lookbackDays: number): string[] {
  const out: string[] = [];
  const now = new Date();
  const from = new Date(Date.now() - lookbackDays * 86400000);
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  while (d >= new Date(from.getFullYear(), from.getMonth(), 1)) {
    out.push(`${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function releasesFrom(json: any): any[] {
  const std = collectReleases(json);
  if (std.length) return std;
  if (Array.isArray(json)) return json.flatMap((x) => (x?.releases ? x.releases : x?.tender ? [x] : []));
  for (const k of ["notices", "Notices", "data", "items"]) if (Array.isArray(json?.[k])) return json[k].flatMap((x: any) => (x?.releases ? x.releases : x?.tender ? [x] : []));
  return [];
}

export async function runProactisApi(def: SourceDefinition, input: SourceRunInput): Promise<SourceRunResult> {
  if (!PROACTIS_ENDPOINTS[def.id]) throw new Error(`No API endpoint for ${def.id}`);
  const months = monthsBack(input.params.lookbackDays);
  const jobs = months.flatMap((m) => NOTICE_TYPES.map((t) => ({ month: m, ...t })));
  let start = 0;
  if (input.cursor) {
    start = parseInt(input.cursor, 10);
    if (!Number.isFinite(start) || start < 0 || start > jobs.length) throw new Error("Invalid continuation cursor");
  }
  const end = Math.min(jobs.length, start + REQUESTS_PER_CALL);
  const since = Date.now() - input.params.lookbackDays * 86400000;
  let checked = 0;
  const candidates: RawNotice[] = [];
  const failures: string[] = [];

  for (let i = start; i < end; i++) {
    const job = jobs[i];
    let json: any;
    try {
      json = await fetchWithFallback(def.id, job.month, job.type, def.allowedHosts);
    } catch (e) {
      failures.push(`${job.label} ${job.month}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const releases = releasesFrom(json);
    if (!releases.length && json && (Array.isArray(json) ? json.length : Object.keys(json).length)) {
      const shape = Array.isArray(json) ? `array of ${json.length}, first keys: ${Object.keys(json[0] || {}).slice(0, 6).join(", ")}` : `keys: ${Object.keys(json).slice(0, 8).join(", ")}`;
      failures.push(`${job.label} ${job.month}: response not recognised as OCDS (${shape})`);
    }
    for (const r of releases) {
      checked++;
      const n = normaliseRelease(r, def.id, def.label, () => null, job.stage);
      if (!n) continue;
      if (n.published && Date.parse(n.published) < since) continue;
      if (n.stage !== "award" && isCandidate(n, input.settings)) candidates.push(n);
    }
  }

  const done = end >= jobs.length;
  if (failures.length === end - start) {
    return { status: "ERROR", message: failures[0], checked, candidates, nextCursor: null, pages: end - start };
  }
  return {
    status: "CONNECTED",
    message: done ? (failures.length ? `Search complete (${failures.length} request(s) failed: ${failures[0]})` : "Search complete") : `Fetched ${end} of ${jobs.length} month/type batches…`,
    checked,
    candidates,
    nextCursor: done ? null : String(end),
    pages: end - start,
  };
}
