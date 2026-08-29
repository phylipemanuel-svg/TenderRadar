import { query } from "./db";
import type { Settings } from "./types";
import { DEFAULT_KEYWORD_GROUPS, DEFAULT_EXCLUDE_KEYWORDS } from "./keywords";
import { DEFAULT_CPV_LIBRARY } from "./cpv";
import { DEFAULT_WEIGHTS } from "./scoring";
import { DEFAULT_BUYER_POINTS } from "./regions";

export const DEFAULT_SETTINGS: Settings = {
  keywordGroups: DEFAULT_KEYWORD_GROUPS,
  cpvLibrary: DEFAULT_CPV_LIBRARY,
  excludeKeywords: DEFAULT_EXCLUDE_KEYWORDS,
  weights: DEFAULT_WEIGHTS,
  minScore: 60,
  defaultRegions: ["wales", "uk"],
  lookbackDays: 60,
  valueIdealMin: 50_000,
  valueIdealMax: 5_000_000,
  buyerPoints: DEFAULT_BUYER_POINTS,
  feedUrls: {},
};

export async function loadSettings(): Promise<Settings> {
  const rows = await query<{ value: Partial<Settings> }>(`SELECT value FROM settings WHERE key = 'app'`);
  if (!rows.length) return DEFAULT_SETTINGS;
  return sanitiseSettings({ ...DEFAULT_SETTINGS, ...rows[0].value });
}

export async function saveSettings(s: Settings): Promise<Settings> {
  const clean = sanitiseSettings(s);
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('app', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(clean)],
  );
  return clean;
}

function num(v: unknown, d: number, min = 0, max = 1e12): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
}

const str = (v: unknown, max = 200) => String(v ?? "").replace(/[<>]/g, "").slice(0, max).trim();

/** Validate anything coming from the settings form before it is stored. */
export function sanitiseSettings(input: Partial<Settings>): Settings {
  const d = DEFAULT_SETTINGS;
  const keywordGroups = Array.isArray(input.keywordGroups)
    ? input.keywordGroups
        .map((g) => ({
          id: str(g.id, 40).toLowerCase().replace(/[^a-z0-9]/g, "") || "group",
          label: str(g.label, 60) || "Group",
          terms: (Array.isArray(g.terms) ? g.terms : []).map((t) => str(t, 60)).filter(Boolean).slice(0, 400),
        }))
        .slice(0, 40)
    : d.keywordGroups;
  const cpvLibrary = Array.isArray(input.cpvLibrary)
    ? input.cpvLibrary
        .map((e) => ({ code: String(e.code ?? "").replace(/\D/g, "").slice(0, 8), label: str(e.label, 120), group: str(e.group, 40) }))
        .filter((e) => e.code.length === 8)
        .slice(0, 2000)
    : d.cpvLibrary;
  const weights = { ...d.weights } as Record<string, number>;
  for (const k of Object.keys(weights)) weights[k] = num((input.weights as Record<string, unknown> | undefined)?.[k], weights[k], 0, 100);
  const buyerPoints = { ...d.buyerPoints };
  for (const k of Object.keys(buyerPoints)) buyerPoints[k] = num(input.buyerPoints?.[k], buyerPoints[k], 0, 10);
  const allowedRegions = ["wales", "southwest", "midlands", "northwest", "england", "scotland", "northernireland", "uk"];
  const feedUrls: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.feedUrls || {})) if (typeof v === "string") feedUrls[str(k, 30)] = v.trim().slice(0, 500);
  return {
    keywordGroups,
    cpvLibrary,
    excludeKeywords: Array.isArray(input.excludeKeywords) ? input.excludeKeywords.map((t) => str(t, 60)).filter(Boolean).slice(0, 200) : d.excludeKeywords,
    weights: weights as unknown as Settings["weights"],
    minScore: num(input.minScore, d.minScore, 0, 100),
    defaultRegions: (Array.isArray(input.defaultRegions) ? input.defaultRegions.filter((r) => allowedRegions.includes(r)) : d.defaultRegions) as Settings["defaultRegions"],
    lookbackDays: num(input.lookbackDays, d.lookbackDays, 7, 365),
    valueIdealMin: num(input.valueIdealMin, d.valueIdealMin),
    valueIdealMax: num(input.valueIdealMax, d.valueIdealMax),
    buyerPoints,
    feedUrls,
  };
}
