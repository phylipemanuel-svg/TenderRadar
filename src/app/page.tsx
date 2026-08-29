"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import SearchPanel from "@/components/SearchPanel";
import OpportunityCard from "@/components/OpportunityCard";
import type { Opportunity, RegionId, Settings } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { LIVE_STATUSES } from "@/lib/status";
import { fmtDate, fmtMoney } from "@/components/ui";
import { CHATGPT_PROMPT } from "@/lib/chatgpt";

type SortKey = "score" | "deadline" | "value" | "new";

export default function Dashboard() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [minScore, setMinScore] = useState(60);
  const [lastRun, setLastRun] = useState<{ finished_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>(["OPEN", "CLOSING SOON", "PIPELINE", "MARKET ENGAGEMENT"]);
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [changeFilter, setChangeFilter] = useState<string>("");
  const [decisionFilter, setDecisionFilter] = useState<string>("");
  const [text, setText] = useState("");
  const [sort, setSort] = useState<SortKey>("score");
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [a, b] = await Promise.all([fetch(`/api/opportunities?closed=${showClosed ? 1 : 0}`), fetch("/api/settings")]);
      const ja = await a.json();
      const jb = await b.json();
      if (!a.ok) throw new Error(ja.error || "Could not load opportunities");
      setOpps(ja.opportunities);
      setMinScore(ja.minScore);
      setLastRun(ja.lastRun);
      if (b.ok) setSettings(jb.settings);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [showClosed]);

  useEffect(() => {
    load();
  }, [load]);

  async function select(o: Opportunity, selected: boolean) {
    setBusyId(o.id);
    try {
      await fetch(`/api/opportunities/${encodeURIComponent(o.id)}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected }) });
      setOpps((list) => list.map((x) => (x.id === o.id ? { ...x, selected } : x)));
    } finally {
      setBusyId(null);
    }
  }

  const live = useMemo(() => opps.filter((o) => o.liveStatus !== "CLOSED"), [opps]);
  const weekAgo = Date.now() - 7 * 86400000;
  const kpis = useMemo(() => {
    const scored = live.filter((o) => o.fit.score >= minScore);
    return {
      live: scored.length,
      newWeek: scored.filter((o) => o.changeStatus === "NEW" || (o.firstSeenAt && Date.parse(o.firstSeenAt) > weekAgo)).length,
      closing: scored.filter((o) => o.daysRemaining != null && o.daysRemaining >= 0 && o.daysRemaining <= 7).length,
      value: scored.reduce((s, o) => s + (o.value || 0), 0),
      highFit: scored.filter((o) => o.fit.score >= 80).length,
      pipeline: scored.filter((o) => o.liveStatus === "PIPELINE" || o.liveStatus === "MARKET ENGAGEMENT").length,
    };
  }, [live, minScore, weekAgo]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    let list = opps.filter((o) => o.fit.score >= minScore || o.selected);
    list = list.filter((o) => statusFilter.includes(o.liveStatus));
    if (regionFilter.length) list = list.filter((o) => regionFilter.includes(o.region));
    if (changeFilter) list = list.filter((o) => o.changeStatus === changeFilter);
    if (decisionFilter) list = list.filter((o) => decisionFilter === "SELECTED" ? o.selected : o.decision === decisionFilter);
    if (q) list = list.filter((o) => `${o.title} ${o.buyer} ${o.description} ${o.cpv.join(" ")} ${o.reference}`.toLowerCase().includes(q));
    const dl = (o: Opportunity) => (o.deadline ? Date.parse(o.deadline) : Infinity);
    list.sort((a, b) => {
      if (sort === "deadline") return dl(a) - dl(b);
      if (sort === "value") return (b.value || 0) - (a.value || 0);
      if (sort === "new") return (b.changeStatus === "NEW" ? 1 : 0) - (a.changeStatus === "NEW" ? 1 : 0) || b.fit.score - a.fit.score;
      return b.fit.score - a.fit.score || dl(a) - dl(b);
    });
    return list;
  }, [opps, minScore, statusFilter, regionFilter, changeFilter, decisionFilter, text, sort]);

  const selectedCount = opps.filter((o) => o.selected).length;

  async function copyPrompt() {
    await navigator.clipboard.writeText(CHATGPT_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function doImport() {
    setImportMsg(null);
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: importText }) });
    const j = await res.json();
    if (!res.ok) {
      setImportMsg(`Import failed: ${j.error}`);
      return;
    }
    setImportMsg(`Imported analysis for ${j.imported} opportunit${j.imported === 1 ? "y" : "ies"}${j.unmatched.length ? `; ${j.unmatched.length} could not be matched (${j.unmatched.slice(0, 3).join(", ")})` : ""}.`);
    setImportText("");
    load();
  }

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <Shell>
      <div className="hero">
        <div className="eyebrow">Flotek Tender Intelligence</div>
        <h1>
          Live public sector opportunities<span className="dot">.</span>
        </h1>
        <p>
          {lastRun ? `Last search ${fmtDate(lastRun.finished_at, true)}.` : "No search has been run yet."} Showing opportunities scoring {minScore}+ (change in Settings).
        </p>
      </div>

      {settings && <SearchPanel defaultRegions={settings.defaultRegions} defaultLookback={settings.lookbackDays} onComplete={load} />}
      {loadError && <div className="note">{loadError} — check that DATABASE_URL is configured in Vercel.</div>}

      <div className="grid6" style={{ margin: "18px 0" }}>
        <div className="stat"><b>{kpis.live}</b><span>Live opportunities</span></div>
        <div className="stat plum"><b>{kpis.newWeek}</b><span>New this week</span></div>
        <div className="stat"><b>{kpis.closing}</b><span>Closing within 7 days</span></div>
        <div className="stat green"><b>{fmtMoney(kpis.value)}</b><span>Total potential value</span></div>
        <div className="stat plum"><b>{kpis.highFit}</b><span>High fit (80+)</span></div>
        <div className="stat violet"><b>{kpis.pipeline}</b><span>Pipeline</span></div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2 className="sec">
            Shortlist tools<span className="dot">.</span>
          </h2>
          <span className="small muted">{selectedCount} selected for report / export</span>
        </div>
        <div className="toolbar">
          <a className={`btn btn-violet${selectedCount ? "" : " disabled"}`} href="/api/export?format=json" aria-disabled={!selectedCount}>Analyse with ChatGPT (JSON)</a>
          <a className="btn btn-ghost" href="/api/export?format=csv">Export CSV</a>
          <button className="btn btn-ghost" onClick={copyPrompt}>{copied ? "Prompt copied ✓" : "Copy ChatGPT prompt"}</button>
          <button className="btn btn-ghost" onClick={() => setShowImport((s) => !s)}>Import ChatGPT analysis</button>
          <a className="btn btn-primary" href="/report">Build weekly report</a>
        </div>
        {showImport && (
          <div style={{ marginTop: 14 }}>
            <p className="small muted">Paste the JSON array ChatGPT returned. Each item must keep the <code>opportunity_id</code> from the export so it can be matched.</p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='[{"opportunity_id": "ocid:...", "strategic_fit": 85, ...}]' />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn-violet btn-sm" onClick={doImport} disabled={!importText.trim()}>Import</button>
              {importMsg && <span className="small">{importMsg}</span>}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="sec">
            Opportunities<span className="dot">.</span> <span className="small muted" style={{ fontWeight: 400 }}>{filtered.length} shown</span>
          </h2>
          <div className="row">
            <input type="text" placeholder="Search title, buyer, CPV…" value={text} onChange={(e) => setText(e.target.value)} style={{ width: 240 }} />
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ width: "auto" }}>
              <option value="score">Sort: fit score</option>
              <option value="deadline">Sort: deadline</option>
              <option value="value">Sort: value</option>
              <option value="new">Sort: new first</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="eyebrow">Status</span>
          <div className="chips">
            {LIVE_STATUSES.map((s) => (
              <button key={s} className="chip" aria-pressed={statusFilter.includes(s)} onClick={() => { toggle(statusFilter, s, setStatusFilter); if (s === "CLOSED") setShowClosed(!statusFilter.includes(s)); }}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="eyebrow">Region</span>
          <div className="chips">
            {REGIONS.map((r) => (
              <button key={r.id} className="chip" aria-pressed={regionFilter.includes(r.id)} onClick={() => toggle(regionFilter, r.id, setRegionFilter)}>
                {r.label}
              </button>
            ))}
            <button className="chip" aria-pressed={regionFilter.includes("unknown")} onClick={() => toggle(regionFilter, "unknown", setRegionFilter)}>Not stated</button>
          </div>
        </div>
        <div className="row">
          <span className="eyebrow">Change</span>
          <select value={changeFilter} onChange={(e) => setChangeFilter(e.target.value)} style={{ width: "auto" }}>
            <option value="">All</option>
            <option>NEW</option>
            <option>UPDATED</option>
            <option>UNCHANGED</option>
            <option>CLOSED</option>
          </select>
          <span className="eyebrow">Decision</span>
          <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} style={{ width: "auto" }}>
            <option value="">All</option>
            <option value="SELECTED">Selected for report</option>
            <option>SHORTLIST</option>
            <option>REVIEW</option>
            <option>BID</option>
            <option>NO BID</option>
            <option>IGNORE</option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          {opps.length === 0 ? "No opportunities stored yet. Press Run tender search." : "Nothing matches the current filters. Lower the minimum score in Settings or widen the filters."}
        </div>
      ) : (
        filtered.map((o) => <OpportunityCard key={o.id} o={o} onSelect={select} busy={busyId === o.id} />)
      )}
    </Shell>
  );
}
