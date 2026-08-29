import type { Opportunity } from "./types";

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

const short = (s: unknown) => (s == null ? "" : String(s)).slice(0, 80);

/** Compare a previously stored opportunity with the newly fetched version. */
export function diffOpportunity(prev: Opportunity, next: Opportunity): FieldChange[] {
  const changes: FieldChange[] = [];
  const cmp = (field: string, a: unknown, b: unknown, fmt: (x: unknown) => string = short) => {
    const av = a == null ? "" : String(a);
    const bv = b == null ? "" : String(b);
    if (av !== bv) changes.push({ field, from: fmt(a), to: fmt(b) });
  };
  cmp("deadline", prev.deadline, next.deadline);
  cmp("value", prev.value, next.value, (x) => (x == null ? "not stated" : String(x)));
  if (hash(prev.description || "") !== hash(next.description || "")) {
    changes.push({ field: "description", from: `${(prev.description || "").length} chars`, to: `${(next.description || "").length} chars` });
  }
  cmp("status", prev.rawStatus, next.rawStatus);
  cmp("procurement stage", prev.stage, next.stage);
  cmp("documents", prev.documents.length, next.documents.length, (x) => `${x} document(s)`);
  cmp("title", prev.title, next.title);
  cmp("contract end", prev.contractEnd, next.contractEnd);
  cmp("lots", prev.lots.length, next.lots.length, (x) => `${x} lot(s)`);
  return changes;
}
