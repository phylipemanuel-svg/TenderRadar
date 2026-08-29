import { collectReleases, normaliseRelease } from "./ocds";
import { fetchJson, dateWindow, isoNoMs, SourceRunInput, SourceRunResult } from "./common";
import { isCandidate } from "../scoring";
import { isAllowedFetchUrl } from "../urls";
import type { RawNotice } from "../types";

/**
 * Find a Tender Service — official OCDS release package API (no key required).
 * Docs: https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages
 * Parameters: updatedFrom, updatedTo (YYYY-MM-DDTHH:MM:SS), stages, limit (max 100), cursor.
 *
 * Each stage is queried separately. The cursor handed back to the browser is
 * "<stageIndex>|<nextUrl>" so a long search continues across several calls.
 */
export const FTS_ENDPOINT = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages";
const STAGES = ["tender", "planning"];
const PAGES_PER_CALL = 12;

/* eslint-disable @typescript-eslint/no-explicit-any */
function noticeUrl(r: any): string | null {
  const id = String(r.id || "");
  const m = id.match(/(\d{6}-\d{4})$/);
  if (m) return `https://www.find-tender.service.gov.uk/Notice/${m[1]}`;
  return null;
}

function firstUrl(stage: string, lookbackDays: number): string {
  const { from, to } = dateWindow(lookbackDays);
  const u = new URL(FTS_ENDPOINT);
  u.searchParams.set("updatedFrom", isoNoMs(from));
  u.searchParams.set("updatedTo", isoNoMs(to));
  u.searchParams.set("stages", stage);
  u.searchParams.set("limit", "100");
  return u.toString();
}

function nextLink(json: any, current: string): string | null {
  const link = json?.links?.next;
  if (typeof link === "string" && isAllowedFetchUrl(link)) return link;
  // Some deployments return a bare cursor token instead of a link
  const token = json?.links?.nextCursor || json?.nextCursor || json?.cursor;
  if (typeof token === "string" && /^[A-Za-z0-9=]+$/.test(token)) {
    const u = new URL(current);
    u.searchParams.set("cursor", token);
    return u.toString();
  }
  return null;
}

function describe(json: any): string {
  if (json == null) return "empty body";
  if (Array.isArray(json)) return `array of ${json.length}`;
  const keys = Object.keys(json).slice(0, 8).join(", ");
  const rel = Array.isArray(json.releases) ? json.releases.length : "n/a";
  return `keys: ${keys}; releases: ${rel}`;
}

export async function runFindATender(input: SourceRunInput): Promise<SourceRunResult> {
  const { settings, params } = input;
  let stageIdx = 0;
  let url: string;
  if (input.cursor) {
    const bar = input.cursor.indexOf("|");
    stageIdx = parseInt(input.cursor.slice(0, bar), 10);
    url = input.cursor.slice(bar + 1);
    if (!Number.isFinite(stageIdx) || stageIdx < 0 || stageIdx >= STAGES.length || !isAllowedFetchUrl(url)) throw new Error("Invalid continuation cursor");
  } else {
    url = firstUrl(STAGES[0], params.lookbackDays);
  }

  let checked = 0;
  let pages = 0;
  const candidates: RawNotice[] = [];
  const diagnostics: string[] = [];
  let next: string | null = url;

  while (pages < PAGES_PER_CALL) {
    if (!next) {
      // move to the next stage
      stageIdx++;
      if (stageIdx >= STAGES.length) break;
      next = firstUrl(STAGES[stageIdx], params.lookbackDays);
    }
    const current: string = next;
    const json: any = await fetchJson(current);
    pages++;
    const releases = collectReleases(json);
    if (releases.length === 0 && !current.includes("cursor=")) {
      diagnostics.push(`${STAGES[stageIdx]}: 200 OK but no releases (${describe(json)})`);
    }
    checked += releases.length;
    for (const r of releases) {
      const n = normaliseRelease(r, "fts", "Find a Tender", noticeUrl);
      if (n && n.stage !== "award" && isCandidate(n, settings)) candidates.push(n);
    }
    next = releases.length > 0 ? nextLink(json, current) : null;
  }

  const finished = !next && stageIdx >= STAGES.length - 1;
  const cursor = finished ? null : `${stageIdx}|${next || firstUrl(STAGES[Math.min(stageIdx + 1, STAGES.length - 1)], params.lookbackDays)}`;
  return {
    status: "CONNECTED",
    message: finished ? (diagnostics.length ? `Search complete — ${diagnostics.join("; ")}` : "Search complete") : `Fetched ${pages} page(s) of ${STAGES[stageIdx]} notices, continuing…`,
    checked,
    candidates,
    nextCursor: cursor,
    pages,
  };
}
