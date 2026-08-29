import type { RawNotice, Settings, SearchParams, SourceStatus } from "../types";
import { isAllowedFetchUrl } from "../urls";
import https from "node:https";

/**
 * The Proactis-run portals (Sell2Wales / PCS) serve their API with an
 * incomplete TLS certificate chain, which Node rejects even though browsers
 * accept it. For these hosts only, and only for reading public notice data,
 * chain verification is relaxed. Nothing sensitive is ever sent to them.
 */
const LAX_TLS_HOSTS = ["api.sell2wales.gov.wales", "api-sell2wales.klickstream.com", "api.publiccontractsscotland.gov.uk"];

function nodeGet(url: string, headers: Record<string, string>, timeoutMs: number): Promise<{ status: number; body: string; retryAfter: string | null }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: "GET", headers, rejectUnauthorized: false, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8"), retryAfter: (res.headers["retry-after"] as string) || null }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    req.end();
  });
}

export interface SourceRunInput {
  settings: Settings;
  params: SearchParams;
  cursor: string | null; // opaque continuation token (a next-page URL for the OCDS APIs)
}

export interface SourceRunResult {
  status: SourceStatus;
  message: string;
  checked: number; // notices examined in this call
  candidates: RawNotice[]; // notices that passed the relevance pre-filter
  nextCursor: string | null; // when non-null the client calls again to continue
  pages: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function causeOf(e: unknown): string {
  const err = e as any;
  if (err?.name === "AbortError") return "timed out";
  const c = err?.cause;
  if (c) return [c.code, c.message].filter(Boolean).join(" ") || String(c);
  return err?.message || String(e);
}

export const USER_AGENT = "FlotekTenderRadar/1.0 (+internal procurement monitoring)";

/** Fetch JSON from an allowlisted procurement host with a timeout. Honours Retry-After on 429/503 once. */
export async function fetchJson(url: string, timeoutMs = 25000, extraHosts: string[] = [], attempt = 0): Promise<unknown> {
  if (!isAllowedFetchUrl(url, extraHosts)) throw new Error(`Refusing to fetch non-allowlisted URL host: ${url.slice(0, 80)}`);
  const host = new URL(url).hostname;
  if (LAX_TLS_HOSTS.includes(host)) {
    let r: { status: number; body: string; retryAfter: string | null };
    try {
      r = await nodeGet(url, { Accept: "application/json", "User-Agent": USER_AGENT }, timeoutMs);
    } catch (e) {
      throw new Error(`Could not connect to ${host}: ${causeOf(e)}`);
    }
    if ((r.status === 429 || r.status === 503) && attempt < 2) {
      await new Promise((res) => setTimeout(res, Math.min(20, Number(r.retryAfter) || 5) * 1000));
      return fetchJson(url, timeoutMs, extraHosts, attempt + 1);
    }
    if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status} from ${host}: ${r.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}`);
    try {
      return JSON.parse(r.body);
    } catch {
      throw new Error(`${host} returned non-JSON (${r.body.slice(0, 80).replace(/\s+/g, " ")}…)`);
    }
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: ac.signal, cache: "no-store" });
    } catch (e) {
      throw new Error(`Could not connect to ${host}: ${causeOf(e)}`);
    }
    if ((res.status === 429 || res.status === 503) && attempt < 2) {
      const wait = Math.min(20, Number(res.headers.get("retry-after")) || 5);
      clearTimeout(t);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return fetchJson(url, timeoutMs, extraHosts, attempt + 1);
    }
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).replace(/\s+/g, " ").slice(0, 160);
      } catch {}
      throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}${detail ? `: ${detail}` : ""}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${new URL(url).hostname} returned non-JSON (${text.slice(0, 80).replace(/\s+/g, " ")}…)`);
    }
  } finally {
    clearTimeout(t);
  }
}

export async function fetchText(url: string, timeoutMs = 25000, extraHosts: string[] = []): Promise<string> {
  if (!isAllowedFetchUrl(url, extraHosts)) throw new Error(`Refusing to fetch non-allowlisted URL host: ${url.slice(0, 80)}`);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*", "User-Agent": USER_AGENT }, signal: ac.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function isoNoMs(d: Date): string {
  return d.toISOString().slice(0, 19);
}

export function dateWindow(lookbackDays: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(Date.now() - lookbackDays * 86400000);
  return { from, to };
}
