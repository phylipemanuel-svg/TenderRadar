import type { RawNotice } from "./types";

/** Authority order: the original publishing platform wins. */
const SOURCE_RANK: Record<string, number> = {
  fts: 1,
  contractsfinder: 2,
  sell2wales: 3,
  pcs: 4,
  etendersni: 5,
};

export function normKey(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function dedupeKey(n: RawNotice): string {
  if (n.ocid) return `ocid:${n.ocid.toLowerCase()}`;
  if (n.reference && n.reference.length > 5) return `ref:${normKey(n.reference)}|${normKey(n.buyer).slice(0, 30)}`;
  return `bt:${normKey(n.buyer)}|${normKey(n.title)}|${(n.deadline || "").slice(0, 10)}`;
}

export interface DedupedNotice extends RawNotice {
  id: string;
  sources: string[];
}

/**
 * Merge notices seen in several sources. Also collapses obvious duplicates where
 * the OCID differs but buyer + title + deadline are identical.
 */
export function dedupe(list: RawNotice[]): DedupedNotice[] {
  const byKey = new Map<string, DedupedNotice>();
  const byBt = new Map<string, string>(); // buyer|title|deadline -> key

  const sorted = [...list].sort((a, b) => (SOURCE_RANK[a.sourceId] ?? 9) - (SOURCE_RANK[b.sourceId] ?? 9));
  for (const n of sorted) {
    let key = dedupeKey(n);
    const bt = `bt:${normKey(n.buyer)}|${normKey(n.title)}|${(n.deadline || "").slice(0, 10)}`;
    if (!byKey.has(key) && byBt.has(bt)) key = byBt.get(bt)!;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...n, id: key, sources: [n.sourceLabel] });
      byBt.set(bt, key);
      continue;
    }
    // merge: keep authoritative record, fill gaps from the duplicate
    if (!existing.sources.includes(n.sourceLabel)) existing.sources.push(n.sourceLabel);
    const fill = <K extends keyof RawNotice>(k: K) => {
      const cur = existing[k];
      if (cur == null || cur === "" || (Array.isArray(cur) && cur.length === 0)) {
        (existing as RawNotice)[k] = n[k];
      }
    };
    (["description", "deadline", "value", "cpv", "url", "regionCodes", "contractStart", "contractEnd", "durationText", "reference", "postcode"] as (keyof RawNotice)[]).forEach(fill);
    if (n.documents.length > existing.documents.length) existing.documents = n.documents;
    if (n.cpv.length) existing.cpv = [...new Set([...existing.cpv, ...n.cpv])];
  }
  return [...byKey.values()];
}
