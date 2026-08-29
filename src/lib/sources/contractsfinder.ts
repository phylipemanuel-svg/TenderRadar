import { collectReleases, normaliseRelease } from "./ocds";
import { fetchJson, dateWindow, isoNoMs, SourceRunInput, SourceRunResult } from "./common";
import { isCandidate } from "../scoring";
import { isAllowedFetchUrl } from "../urls";

/**
 * Contracts Finder — official OCDS search API (no key required).
 * Docs: https://www.contractsfinder.service.gov.uk/apidocumentation/home
 */
export const CF_ENDPOINT = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";
const PAGES_PER_CALL = 12;

/* eslint-disable @typescript-eslint/no-explicit-any */
function noticeUrl(r: any): string | null {
  const candidates = [String(r.id || ""), String(r.ocid || "")];
  for (const c of candidates) {
    const m = c.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (m) return `https://www.contractsfinder.service.gov.uk/Notice/${m[1]}`;
  }
  return null;
}

export async function runContractsFinder(input: SourceRunInput): Promise<SourceRunResult> {
  const { settings, params } = input;
  let url: string;
  if (input.cursor) {
    if (!isAllowedFetchUrl(input.cursor)) throw new Error("Invalid continuation cursor");
    url = input.cursor;
  } else {
    const { from, to } = dateWindow(params.lookbackDays);
    const u = new URL(CF_ENDPOINT);
    u.searchParams.set("publishedFrom", isoNoMs(from));
    u.searchParams.set("publishedTo", isoNoMs(to));
    u.searchParams.set("stages", "planning,tender");
    u.searchParams.set("limit", "100");
    url = u.toString();
  }

  let checked = 0;
  let pages = 0;
  const candidates = [];
  let diagnostics = "";
  let next: string | null = url;
  while (next && pages < PAGES_PER_CALL) {
    const json: any = await fetchJson(next);
    pages++;
    const releases = collectReleases(json);
    checked += releases.length;
    for (const r of releases) {
      const n = normaliseRelease(r, "contractsfinder", "Contracts Finder", noticeUrl);
      if (n && n.stage !== "award" && isCandidate(n, settings)) candidates.push(n);
    }
    if (releases.length === 0 && pages === 1 && !input.cursor) diagnostics = `200 OK but no releases (keys: ${Object.keys(json || {}).slice(0, 8).join(", ")})`;
    const link = json?.links?.next;
    next = typeof link === "string" && releases.length > 0 && isAllowedFetchUrl(link) ? link : null;
  }

  return {
    status: "CONNECTED",
    message: next ? `Fetched ${pages} page(s), continuing…` : diagnostics ? `Search complete — ${diagnostics}` : `Search complete`,
    checked,
    candidates,
    nextCursor: next,
    pages,
  };
}
