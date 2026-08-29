"use client";
import { useState } from "react";
import type { RegionId, SearchStats } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { Spinner } from "./ui";

interface Step {
  id: string;
  label: string;
  state: "pending" | "active" | "done" | "error" | "skipped";
  detail?: string;
}

interface Props {
  defaultRegions: RegionId[];
  defaultLookback: number;
  onComplete: () => void;
}

export default function SearchPanel({ defaultRegions, defaultLookback, onComplete }: Props) {
  const [regions, setRegions] = useState<RegionId[]>(defaultRegions);
  const [lookback, setLookback] = useState(defaultLookback);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleRegion = (id: RegionId) => setRegions((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const setStep = (id: string, patch: Partial<Step>) => setSteps((s) => s.map((st) => (st.id === id ? { ...st, ...patch } : st)));

  async function run() {
    setRunning(true);
    setError(null);
    setStats(null);
    try {
      const startRes = await fetch("/api/search/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regions, lookbackDays: lookback }) });
      const start = await startRes.json();
      if (!startRes.ok) throw new Error(start.error || "Could not start search");
      const runId: number = start.runId;
      const sources: { id: string; label: string; kind: string }[] = start.sources;

      const initial: Step[] = [
        ...sources.map((s) => ({ id: s.id, label: `${s.kind === "feed" ? "Checking" : "Searching"} ${s.label}…`, state: "pending" as const })),
        { id: "dedupe", label: "Removing duplicates…", state: "pending" },
        { id: "deadlines", label: "Checking deadlines…", state: "pending" },
        { id: "filters", label: "Applying Flotek filters…", state: "pending" },
        { id: "scores", label: "Calculating fit scores…", state: "pending" },
        { id: "done", label: "Search complete", state: "pending" },
      ];
      setSteps(initial);

      for (const s of sources) {
        setStep(s.id, { state: "active" });
        let cursor: string | null = null;
        let checked = 0;
        let relevant = 0;
        let status = "";
        let message = "";
        let guard = 0;
        do {
          const res: Response = await fetch(`/api/search/source/${s.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, cursor }) });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `${s.label} failed`);
          checked += j.checked || 0;
          relevant += j.relevant || 0;
          status = j.status;
          message = j.message || "";
          cursor = j.nextCursor || null;
          setStep(s.id, { detail: `${checked.toLocaleString()} notices checked, ${relevant} relevant${cursor ? " — fetching more…" : ""}` });
          guard++;
        } while (cursor && guard < 40);
        if (status === "CONNECTED") setStep(s.id, { state: "done", label: `${s.label}`, detail: `${checked.toLocaleString()} notices checked, ${relevant} relevant` });
        else if (status === "NOT CONNECTED") setStep(s.id, { state: "skipped", label: `${s.label} — not connected`, detail: message });
        else setStep(s.id, { state: "error", label: `${s.label} — error`, detail: message });
      }

      for (const id of ["dedupe", "deadlines", "filters", "scores"]) setStep(id, { state: "active" });
      const finRes = await fetch("/api/search/finalise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId }) });
      const fin = await finRes.json();
      if (!finRes.ok) throw new Error(fin.error || "Could not finalise search");
      const st: SearchStats = fin.stats;
      setStep("dedupe", { state: "done", label: "Duplicates removed", detail: `${st.relevant} unique relevant notices` });
      setStep("deadlines", { state: "done", label: "Deadlines checked", detail: `${st.closedCount} closed since last search` });
      setStep("filters", { state: "done", label: "Flotek filters applied" });
      setStep("scores", { state: "done", label: "Fit scores calculated", detail: `${st.scoredAboveMin} scored above your minimum` });
      setStep("done", { state: "done" });
      setStats(st);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSteps((s) => s.map((st) => (st.state === "active" ? { ...st, state: "error" } : st)));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">Search</div>
          <h2 className="sec">
            Run a live search across the connected procurement sources<span className="dot">.</span>
          </h2>
        </div>
        <button className="btn btn-primary btn-lg" onClick={run} disabled={running}>
          {running ? <Spinner /> : <span className="tri" />} {running ? "Searching…" : "Run tender search"}
        </button>
      </div>
      <div className="grid2">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Preferred regions (used for scoring, nothing outside them is excluded)</div>
          <div className="chips">
            {REGIONS.map((r) => (
              <button key={r.id} className="chip" aria-pressed={regions.includes(r.id)} onClick={() => toggleRegion(r.id)} disabled={running}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="fld" style={{ maxWidth: 260 }}>
            <span className="eyebrow">Look back (days of notices to check)</span>
            <input type="number" min={7} max={365} value={lookback} onChange={(e) => setLookback(Number(e.target.value))} disabled={running} />
          </label>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="progress" style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ color: "var(--plum-lighter)" }}>Progress</div>
          <div className="steps">
            {steps.map((s) => (
              <div key={s.id} className={`step ${s.state}`}>
                <span className="ic">{s.state === "done" ? "✓" : s.state === "error" ? "!" : s.state === "skipped" ? "–" : s.state === "active" ? <Spinner /> : ""}</span>
                <span>{s.label}</span>
                {s.detail && <small>— {s.detail}</small>}
              </div>
            ))}
          </div>
          {stats && (
            <div className="summary-nums">
              <div><b>{stats.checked.toLocaleString()}</b><span>notices checked</span></div>
              <div><b>{stats.relevant}</b><span>relevant</span></div>
              <div><b>{stats.scoredAboveMin}</b><span>scored above minimum</span></div>
              <div><b>{stats.strong}</b><span>strong opportunities (70+)</span></div>
              <div><b>{stats.newCount}</b><span>new</span></div>
              <div><b>{stats.updatedCount}</b><span>updated</span></div>
            </div>
          )}
          {error && <p className="error" style={{ color: "#ffb4a8", marginBottom: 0 }}>{error}</p>}
        </div>
      )}
    </section>
  );
}
