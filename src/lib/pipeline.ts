import { query } from "./db";
import type { Opportunity, RawNotice, SearchStats, Settings, SourceStatus } from "./types";
import { dedupe } from "./dedupe";
import { detectRegion, classifyBuyer, REGION_LABEL } from "./regions";
import { scoreNotice } from "./scoring";
import { daysRemaining, liveStatus, priorityFor } from "./status";
import { diffOpportunity } from "./diff";

export function enrich(n: RawNotice & { id: string; sources: string[] }, settings: Settings, now = new Date()): Opportunity {
  const region = detectRegion({ regionCodes: n.regionCodes, postcode: n.postcode, buyer: n.buyer, locationText: n.locationText, title: n.title });
  const buyerType = classifyBuyer(n.buyer, n.buyerClassification);
  const fit = scoreNotice(n, region, buyerType, settings);
  const days = daysRemaining(n.deadline, now);
  const status = liveStatus(n, days, now);
  return {
    ...n,
    region,
    regionLabel: REGION_LABEL[region],
    buyerType,
    fit,
    liveStatus: status,
    daysRemaining: days,
    priority: priorityFor(days, status),
    changeStatus: "NEW",
    changes: [],
  };
}

/** Recalculate the time-dependent fields for display without re-fetching. */
export function refresh(o: Opportunity, now = new Date()): Opportunity {
  const days = daysRemaining(o.deadline, now);
  const status = liveStatus(o, days, now);
  return { ...o, daysRemaining: days, liveStatus: status, priority: priorityFor(days, status) };
}

interface StoredRow {
  id: string;
  data: Opportunity;
  first_seen_run: number | null;
  first_seen_at: string;
}

export async function finaliseRun(runId: number, settings: Settings): Promise<SearchStats> {
  const now = new Date();
  const staged = await query<{ source_id: string; data: RawNotice }>(`SELECT source_id, data FROM search_staging WHERE run_id = $1`, [runId]);
  const runRows = await query<{ stats: Partial<SearchStats> | null }>(`SELECT stats FROM search_runs WHERE id = $1`, [runId]);
  const perSource = (runRows[0]?.stats?.perSource || {}) as SearchStats["perSource"];
  const checked = Object.values(perSource).reduce((s, p) => s + (p.checked || 0), 0);

  const raw = staged.map((r) => r.data);
  const merged = dedupe(raw);
  const enriched = merged.map((n) => enrich(n, settings, now));

  const existing = await query<StoredRow>(`SELECT id, data, first_seen_run, first_seen_at FROM opportunities`);
  const existingMap = new Map(existing.map((r) => [r.id, r]));
  const seenIds = new Set<string>();

  let newCount = 0,
    updatedCount = 0,
    unchangedCount = 0,
    closedCount = 0;

  for (const o of enriched) {
    seenIds.add(o.id);
    const prev = existingMap.get(o.id);
    if (!prev) {
      o.changeStatus = "NEW";
      o.firstSeenAt = now.toISOString();
      o.lastSeenAt = now.toISOString();
      newCount++;
      await query(
        `INSERT INTO opportunities (id, data, score, live_status, change_status, deadline, first_seen_run, last_seen_run, first_seen_at, last_seen_at)
         VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $7, now(), now())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, score = EXCLUDED.score, live_status = EXCLUDED.live_status,
           change_status = EXCLUDED.change_status, deadline = EXCLUDED.deadline, last_seen_run = EXCLUDED.last_seen_run, last_seen_at = now()`,
        [o.id, JSON.stringify(o), o.fit.score, o.liveStatus, o.changeStatus, o.deadline && !isNaN(Date.parse(o.deadline)) ? o.deadline : null, runId],
      );
      continue;
    }
    const changes = diffOpportunity(prev.data, o);
    o.firstSeenAt = prev.first_seen_at;
    o.lastSeenAt = now.toISOString();
    if (changes.length) {
      o.changeStatus = "UPDATED";
      o.changes = changes;
      updatedCount++;
      for (const c of changes) {
        await query(`INSERT INTO opportunity_changes (opportunity_id, run_id, field, old_value, new_value) VALUES ($1,$2,$3,$4,$5)`, [o.id, runId, c.field, c.from, c.to]);
      }
    } else {
      o.changeStatus = "UNCHANGED";
      unchangedCount++;
    }
    await query(
      `UPDATE opportunities SET data = $2::jsonb, score = $3, live_status = $4, change_status = $5, deadline = $6, last_seen_run = $7, last_seen_at = now() WHERE id = $1`,
      [o.id, JSON.stringify(o), o.fit.score, o.liveStatus, o.changeStatus, o.deadline && !isNaN(Date.parse(o.deadline)) ? o.deadline : null, runId],
    );
  }

  // Opportunities not seen this run: mark CLOSED if their deadline has passed
  for (const row of existing) {
    if (seenIds.has(row.id)) continue;
    const o = refresh(row.data, now);
    if (o.liveStatus === "CLOSED" && row.data.changeStatus !== "CLOSED") {
      o.changeStatus = "CLOSED";
      closedCount++;
      await query(`UPDATE opportunities SET data = $2::jsonb, live_status = $3, change_status = 'CLOSED' WHERE id = $1`, [row.id, JSON.stringify(o), o.liveStatus]);
    } else if (row.data.changeStatus === "NEW" || row.data.changeStatus === "UPDATED") {
      // Seen in an earlier run but not this one (fell outside the lookback window): no longer "new"
      await query(`UPDATE opportunities SET data = $2::jsonb, change_status = 'UNCHANGED' WHERE id = $1`, [row.id, JSON.stringify({ ...o, changeStatus: "UNCHANGED" })]);
    }
  }

  const live = enriched.filter((o) => o.liveStatus !== "CLOSED");
  const stats: SearchStats = {
    checked,
    relevant: enriched.length,
    scoredAboveMin: live.filter((o) => o.fit.score >= settings.minScore).length,
    strong: live.filter((o) => o.fit.score >= 70).length,
    newCount,
    updatedCount,
    unchangedCount,
    closedCount,
    perSource,
  };
  await query(`UPDATE search_runs SET finished_at = now(), status = 'complete', stats = $2::jsonb WHERE id = $1`, [runId, JSON.stringify(stats)]);
  await query(`DELETE FROM search_staging WHERE run_id = $1`, [runId]);
  return stats;
}

export async function recordSourceProgress(runId: number, sourceId: string, checked: number, relevant: number, status: SourceStatus, message: string, done: boolean) {
  const rows = await query<{ stats: Partial<SearchStats> | null }>(`SELECT stats FROM search_runs WHERE id = $1`, [runId]);
  const stats = rows[0]?.stats || {};
  const perSource = (stats.perSource || {}) as SearchStats["perSource"];
  const cur = perSource[sourceId] || { checked: 0, relevant: 0, status, message };
  perSource[sourceId] = { checked: cur.checked + checked, relevant: cur.relevant + relevant, status, message };
  await query(`UPDATE search_runs SET stats = $2::jsonb WHERE id = $1`, [runId, JSON.stringify({ ...stats, perSource })]);
  if (done || status === "ERROR" || status === "NOT CONNECTED") {
    await query(
      `INSERT INTO source_status (source_id, status, message, notices_checked, checked_at, run_id) VALUES ($1,$2,$3,$4,now(),$5)
       ON CONFLICT (source_id) DO UPDATE SET status = EXCLUDED.status, message = EXCLUDED.message, notices_checked = EXCLUDED.notices_checked, checked_at = now(), run_id = EXCLUDED.run_id`,
      [sourceId, status, message, perSource[sourceId].checked, runId],
    );
  }
}
