import { query } from "./db";
import type { Decision, ExternalAnalysis, Opportunity } from "./types";
import { refresh } from "./pipeline";

interface Row {
  id: string;
  data: Opportunity;
  first_seen_at: string;
  last_seen_at: string;
  decision: Decision | null;
  selected: boolean | null;
  notes: string | null;
  analysis: ExternalAnalysis | null;
}

function join(r: Row): Opportunity {
  const o = refresh(r.data);
  return {
    ...o,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    decision: r.decision || "NONE",
    selected: !!r.selected,
    notes: r.notes || "",
    analysis: r.analysis || null,
  };
}

const SELECT = `SELECT o.id, o.data, o.first_seen_at, o.last_seen_at, d.decision, d.selected, d.notes, d.analysis
  FROM opportunities o LEFT JOIN decisions d ON d.opportunity_id = o.id`;

export async function listOpportunities(opts: { includeClosed?: boolean } = {}): Promise<Opportunity[]> {
  const rows = await query<Row>(`${SELECT} ORDER BY o.score DESC, o.deadline ASC NULLS LAST`);
  const all = rows.map(join);
  return opts.includeClosed ? all : all.filter((o) => o.liveStatus !== "CLOSED" && o.changeStatus !== "CLOSED");
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const rows = await query<Row>(`${SELECT} WHERE o.id = $1`, [id]);
  return rows.length ? join(rows[0]) : null;
}

export async function getSelectedOpportunities(): Promise<Opportunity[]> {
  const rows = await query<Row>(`${SELECT} WHERE d.selected = true ORDER BY o.score DESC`);
  return rows.map(join);
}

export async function saveDecision(id: string, patch: { decision?: Decision; selected?: boolean; notes?: string }) {
  const allowed: Decision[] = ["NONE", "SHORTLIST", "IGNORE", "BID", "NO BID", "REVIEW"];
  const decision = patch.decision && allowed.includes(patch.decision) ? patch.decision : null;
  const notes = typeof patch.notes === "string" ? patch.notes.slice(0, 5000) : null;
  const selected = typeof patch.selected === "boolean" ? patch.selected : null;
  await query(
    `INSERT INTO decisions (opportunity_id, decision, selected, notes, updated_at)
     VALUES ($1, COALESCE($2, 'NONE'), COALESCE($3, false), COALESCE($4, ''), now())
     ON CONFLICT (opportunity_id) DO UPDATE SET
       decision = COALESCE($2, decisions.decision),
       selected = COALESCE($3, decisions.selected),
       notes = COALESCE($4, decisions.notes),
       updated_at = now()`,
    [id, decision, selected, notes],
  );
}

export async function saveAnalysis(id: string, analysis: ExternalAnalysis) {
  await query(
    `INSERT INTO decisions (opportunity_id, analysis, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (opportunity_id) DO UPDATE SET analysis = EXCLUDED.analysis, updated_at = now()`,
    [id, JSON.stringify(analysis)],
  );
}

export async function getChanges(id: string) {
  return query<{ field: string; old_value: string; new_value: string; changed_at: string; run_id: number }>(
    `SELECT field, old_value, new_value, changed_at, run_id FROM opportunity_changes WHERE opportunity_id = $1 ORDER BY changed_at DESC LIMIT 50`,
    [id],
  );
}
