/**
 * External URL validation. Only http(s) links are ever rendered, and the
 * server-side fetchers only talk to the allowlisted procurement hosts below.
 */
export const PROCUREMENT_HOSTS = [
  "www.find-tender.service.gov.uk",
  "find-tender.service.gov.uk",
  "www.contractsfinder.service.gov.uk",
  "contractsfinder.service.gov.uk",
  "www.sell2wales.gov.wales",
  "sell2wales.gov.wales",
  "api.sell2wales.gov.wales",
  "www.publiccontractsscotland.gov.uk",
  "publiccontractsscotland.gov.uk",
  "api.publiccontractsscotland.gov.uk",
  "etendersni.gov.uk",
  "www.etendersni.gov.uk",
];

export function isAllowedFetchUrl(url: string, extraHosts: string[] = []): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return [...PROCUREMENT_HOSTS, ...extraHosts].some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

/** Returns the URL if it is a plain http(s) link, otherwise null. */
export function safeExternalUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const t = url.trim();
  if (t.length > 2000) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function hostOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
