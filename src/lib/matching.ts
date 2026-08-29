import type { KeywordGroup, CpvEntry } from "./types";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const reCache = new Map<string, RegExp>();
export function termRegex(term: string): RegExp {
  let re = reCache.get(term);
  if (!re) {
    // Word-boundary match; allow flexible whitespace/hyphen between words
    const body = term
      .trim()
      .split(/[\s-]+/)
      .map(escapeRe)
      .join("[\\s-]*");
    // \b does not work after symbols like "365" in some cases so use lookarounds
    re = new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, "i");
    reCache.set(term, re);
  }
  return re;
}

export interface GroupMatch {
  groupId: string;
  label: string;
  titleHits: string[];
  bodyHits: string[];
}

/** Find keyword matches per group in a notice's title and body. */
export function matchKeywords(groups: KeywordGroup[], title: string, body: string): GroupMatch[] {
  const out: GroupMatch[] = [];
  for (const g of groups) {
    const titleHits: string[] = [];
    const bodyHits: string[] = [];
    for (const term of g.terms) {
      if (!term || term.trim().length < 2) continue;
      const re = termRegex(term);
      if (re.test(title)) titleHits.push(term);
      else if (re.test(body)) bodyHits.push(term);
    }
    if (titleHits.length || bodyHits.length) out.push({ groupId: g.id, label: g.label, titleHits, bodyHits });
  }
  return out;
}

export function matchesAnyTerm(terms: string[], text: string): string | null {
  for (const t of terms) if (t.trim().length >= 2 && termRegex(t).test(text)) return t;
  return null;
}

export interface CpvMatch {
  code: string;
  level: "exact" | "class" | "category" | "division";
  entry: CpvEntry;
}

/** Best CPV match for each notice code against the library. */
export function matchCpv(library: CpvEntry[], codes: string[]): CpvMatch[] {
  const byExact = new Map(library.map((e) => [e.code, e]));
  const byClass = new Map<string, CpvEntry>();
  const byCat = new Map<string, CpvEntry>();
  const byDiv = new Map<string, CpvEntry>();
  for (const e of library) {
    if (!byClass.has(e.code.slice(0, 5))) byClass.set(e.code.slice(0, 5), e);
    if (!byCat.has(e.code.slice(0, 4))) byCat.set(e.code.slice(0, 4), e);
    if (!byDiv.has(e.code.slice(0, 2))) byDiv.set(e.code.slice(0, 2), e);
  }
  const out: CpvMatch[] = [];
  for (const raw of codes) {
    const c = String(raw).replace(/\D/g, "").slice(0, 8);
    if (c.length < 8) continue;
    const exact = byExact.get(c);
    if (exact) {
      out.push({ code: c, level: "exact", entry: exact });
      continue;
    }
    const cls = byClass.get(c.slice(0, 5));
    if (cls) {
      out.push({ code: c, level: "class", entry: cls });
      continue;
    }
    const cat = byCat.get(c.slice(0, 4));
    if (cat) {
      out.push({ code: c, level: "category", entry: cat });
      continue;
    }
    // Division-level only counts for the IT/telecoms divisions
    if (["72", "32", "64"].includes(c.slice(0, 2))) {
      const div = byDiv.get(c.slice(0, 2));
      if (div) out.push({ code: c, level: "division", entry: div });
    }
  }
  return out;
}
