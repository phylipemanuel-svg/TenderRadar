/**
 * Tender content comes from third-party feeds. We strip any HTML before it is
 * stored so nothing but plain text is ever rendered. React additionally escapes
 * all output; the app never uses dangerouslySetInnerHTML.
 */
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£", euro: "€", ndash: "–", mdash: "—",
  hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™",
};

export function stripHtml(input: unknown, maxLen = 12000): string {
  if (input == null) return "";
  let s = String(input);
  s = s.replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h\d)\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]*>/g, " ");
  s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 31 ? String.fromCodePoint(code) : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
  // remove control characters
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  s = s.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen) + "…";
  return s;
}

export function cleanText(input: unknown, maxLen = 500): string {
  return stripHtml(input, maxLen).replace(/\s+/g, " ").trim();
}
