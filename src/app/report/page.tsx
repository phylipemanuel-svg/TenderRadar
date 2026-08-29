"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import type { Opportunity } from "@/lib/types";
import { Tag, fmtDate, fmtMoney } from "@/components/ui";

export default function ReportBuilder() {
  const router = useRouter();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [minScore, setMinScore] = useState(60);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/opportunities")
      .then((r) => r.json())
      .then((j) => {
        setOpps(j.opportunities || []);
        setMinScore(j.minScore ?? 60);
        setChosen(new Set((j.opportunities || []).filter((o: Opportunity) => o.selected).map((o: Opportunity) => o.id)));
      });
  }, []);

  useEffect(() => {
    const d = new Date(date);
    if (!isNaN(d.getTime()) && !title) setTitle(`Flotek Weekly Tender Opportunities — ${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const list = useMemo(() => opps.filter((o) => showAll || o.selected || o.fit.score >= minScore).sort((a, b) => b.fit.score - a.fit.score), [opps, showAll, minScore]);
  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const total = opps.filter((o) => chosen.has(o.id)).reduce((s, o) => s + (o.value || 0), 0);

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...chosen], title, reportingDate: date }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not build report");
      router.push(`/reports/${j.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="hero">
        <div className="eyebrow">Weekly report</div>
        <h1>Build the weekly opportunity report<span className="dot">.</span></h1>
        <p>Tick the opportunities to include. Opportunities you selected on the dashboard are pre-ticked. Imported ChatGPT analysis is used automatically where it exists; otherwise the report uses the rules-based scoring explanations.</p>
      </div>
      <section className="panel">
        <div className="grid2">
          <label className="fld"><span className="eyebrow">Report title</span><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="fld"><span className="eyebrow">Reporting date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <div className="row">
          <button className="btn btn-primary btn-lg" onClick={build} disabled={busy || chosen.size === 0}>{busy ? "Building…" : `Build report (${chosen.size} opportunit${chosen.size === 1 ? "y" : "ies"})`}</button>
          <span className="small muted">Combined published value: {fmtMoney(total)}</span>
          <label className="small" style={{ marginLeft: "auto" }}><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show below minimum score</label>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
      <section className="panel">
        <table className="tbl">
          <thead><tr><th></th><th>Score</th><th>Opportunity</th><th>Buyer</th><th>Value</th><th>Deadline</th><th>Status</th><th>Analysis</th></tr></thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} onClick={() => toggle(o.id)} style={{ cursor: "pointer" }}>
                <td><input type="checkbox" checked={chosen.has(o.id)} onChange={() => toggle(o.id)} onClick={(e) => e.stopPropagation()} /></td>
                <td><b>{o.fit.score}</b></td>
                <td>{o.title}</td>
                <td>{o.buyer}</td>
                <td>{fmtMoney(o.value, o.currency)}</td>
                <td>{fmtDate(o.deadline)}</td>
                <td><Tag text={o.liveStatus} /></td>
                <td>{o.analysis ? <Tag text="ChatGPT" kind="cpv" /> : <span className="small muted">rules</span>}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="muted">No opportunities available. Run a search first.</td></tr>}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
