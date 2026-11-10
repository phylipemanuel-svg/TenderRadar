"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import type { Decision, Opportunity } from "@/lib/types";
import { Tag, fmtDate, fmtMoney, daysLabel } from "@/components/ui";
import { BUYER_TYPE_LABEL } from "@/lib/regions";

interface Change {
  field: string;
  old_value: string;
  new_value: string;
  changed_at: string;
}

const DECISIONS: Decision[] = ["SHORTLIST", "REVIEW", "BID", "NO BID", "IGNORE"];

export default function OpportunityPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [o, setO] = useState<Opportunity | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/opportunities/${encodeURIComponent(id)}`);
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Not found");
      return;
    }
    setO(j.opportunity);
    setNotes(j.opportunity.notes || "");
    setChanges(j.changes || []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: { decision?: Decision; selected?: boolean; notes?: string }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/opportunities/${encodeURIComponent(id)}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (res.ok) {
        setO(j.opportunity);
        setSavedAt(new Date().toLocaleTimeString("en-GB"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <Shell>
        <div className="empty">{error}. <Link href="/">Back to dashboard</Link></div>
      </Shell>
    );
  }
  if (!o) {
    return (
      <Shell>
        <div className="empty">Loading…</div>
      </Shell>
    );
  }
  const days = daysLabel(o);
  const a = o.analysis;

  return (
    <Shell>
      <p style={{ margin: "18px 0 0" }}>
        <Link href="/">← Dashboard</Link>
      </p>
      <div className="panel">
        <div className="detail-head">
          <div>
            <div className="row" style={{ gap: 6, marginBottom: 8 }}>
              <Tag text={o.changeStatus} />
              <Tag text={o.liveStatus} />
              <Tag text={o.priority} />
              {o.decision && o.decision !== "NONE" && <Tag text={o.decision} kind="decision" />}
            </div>
            <h1>{o.title}</h1>
            <div className="buyer" style={{ color: "var(--plum)", fontSize: 15, fontWeight: 500, marginTop: 4 }}>
              {o.buyer} <span className="small muted">· {BUYER_TYPE_LABEL[o.buyerType] || o.buyerType}</span>
            </div>
          </div>
          <div className="bigscore">
            <b>{o.fit.score}</b>
            <span>{o.fit.category}</span>
            {a?.strategic_fit != null && (
              <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,.2)", paddingTop: 6 }}>
                <span>ChatGPT fit {a.strategic_fit}/100 · {a.confidence || "—"}</span>
              </div>
            )}
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: 16 }}>
          {o.url && (
            <a href={o.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">View original notice ↗</a>
          )}
          <button className={`btn ${o.selected ? "btn-outline" : "btn-violet"}`} disabled={saving} onClick={() => patch({ selected: !o.selected })}>
            {o.selected ? "Remove from report" : "Select for report"}
          </button>
          {DECISIONS.map((d) => (
            <button key={d} className={`btn btn-ghost btn-sm${o.decision === d ? " on" : ""}`} disabled={saving} onClick={() => patch({ decision: o.decision === d ? "NONE" : d })}>
              {d}
            </button>
          ))}
          {savedAt && <span className="small muted">Saved {savedAt}</span>}
        </div>
      </div>

      <div className="grid2">
        <section className="panel" style={{ margin: 0 }}>
          <h3 className="sub">Why this score<span className="dot">.</span></h3>
          <ul className="reasons">
            {o.fit.reasons.map((r, i) => (
              <li key={i}>
                <b className={r.points === 0 ? "zero" : ""}>{r.points > 0 ? `+${r.points}` : "0"}</b>
                <span>{r.label}</span>
              </li>
            ))}
          </ul>
          <h3 className="sub" style={{ marginTop: 16 }}>Matched Flotek services</h3>
          <div className="chips">
            {o.fit.matchedServices.length ? o.fit.matchedServices.map((s) => <span key={s} className="tag t-service">{s}</span>) : <span className="unknown">No service keyword matched (CPV-only match)</span>}
          </div>
          {o.fit.matchedKeywords.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>Keywords: {o.fit.matchedKeywords.slice(0, 20).join(", ")}</p>}
        </section>

        <section className="panel" style={{ margin: 0 }}>
          <h3 className="sub">Key facts<span className="dot">.</span></h3>
          <div className="kv">
            <div><span>Status</span><b>{o.liveStatus}</b></div>
            <div><span>Priority</span><b>{o.priority}</b></div>
            <div><span>Value</span><b>{fmtMoney(o.value, o.currency)}{o.valueMin != null || o.valueMax != null ? ` (range ${fmtMoney(o.valueMin)} – ${fmtMoney(o.valueMax)})` : ""}</b></div>
            <div><span>VAT basis</span><b className={o.vatBasis ? "" : "unknown"}>{o.vatBasis || "Not stated"}</b></div>
            <div><span>Published</span><b>{fmtDate(o.published)}</b></div>
            <div><span>Deadline</span><b>{fmtDate(o.deadline)}</b></div>
            <div><span>Exact deadline time</span><b>{o.deadline && /T\d{2}:\d{2}/.test(o.deadline) && !/T00:00/.test(o.deadline) ? new Date(o.deadline).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : <span className="unknown">Not stated</span>}</b></div>
            <div><span>Days remaining</span><b className={days.warn ? "warn" : ""} style={days.warn ? { color: "var(--orange-dark)" } : {}}>{days.text}</b></div>
            <div><span>Contract duration</span><b className={o.durationText || o.contractStart ? "" : "unknown"}>{o.durationText || (o.contractStart ? `${fmtDate(o.contractStart)} – ${fmtDate(o.contractEnd)}` : "Not stated")}</b></div>
            <div><span>Extensions</span><b className={o.extensionsText ? "" : "unknown"}>{o.extensionsText || "Not stated"}</b></div>
            <div><span>Procurement method</span><b className={o.procurementMethod ? "" : "unknown"}>{o.procurementMethodDetails || o.procurementMethod || "Not stated"}</b></div>
            <div><span>Framework / DPS</span><b>{o.isFramework ? "Framework" : o.isDps ? "Dynamic purchasing system / market" : "Not indicated"}</b></div>
            <div><span>Stage</span><b>{o.stage}{o.rawStatus ? ` (${o.rawStatus})` : ""}</b></div>
            <div><span>Region</span><b>{o.regionLabel}</b></div>
            <div><span>Location text</span><b className={o.locationText ? "" : "unknown"}>{o.locationText || "Not stated"}</b></div>
            <div><span>Original source</span><b>{o.sources.join(", ")}</b></div>
            <div><span>Procurement reference</span><b className="mono">{o.reference || "—"}</b></div>
            <div><span>OCID</span><b className="mono">{o.ocid || "—"}</b></div>
            <div><span>First seen</span><b>{fmtDate(o.firstSeenAt)}</b></div>
            <div><span>Last seen</span><b>{fmtDate(o.lastSeenAt)}</b></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <span className="eyebrow">CPV codes</span>
            <div className="chips" style={{ marginTop: 4 }}>
              {o.cpv.length ? o.cpv.map((c) => <span key={c} className={`tag ${o.fit.matchedCpv.includes(c) ? "t-cpv" : "t-normal"}`}>{c}</span>) : <span className="unknown">None published</span>}
            </div>
          </div>
        </section>
      </div>

      {o.lots.length > 0 && (
        <section className="panel">
          <h3 className="sub">Lots ({o.lots.length})</h3>
          <table className="tbl">
            <thead><tr><th>Lot</th><th>Title</th><th>Value</th><th>Description</th></tr></thead>
            <tbody>
              {o.lots.map((l, i) => (
                <tr key={i}><td>{l.id || i + 1}</td><td>{l.title}</td><td>{fmtMoney(l.value)}</td><td>{l.description}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel">
        <h3 className="sub">Full description<span className="dot">.</span></h3>
        <div className="prose">{o.description || <span className="unknown">No description published in the notice.</span>}</div>
        {o.documents.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <span className="eyebrow">Documents and links</span>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {o.documents.map((d, i) => (
                <li key={i}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.title}</a> <span className="small muted">{d.type}</span></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {a && (
        <section className="panel">
          <div className="panel-head">
            <h3 className="sub">Imported ChatGPT analysis<span className="dot">.</span></h3>
            <span className="small muted">Imported {fmtDate(a.imported_at, true)} · Confidence {a.confidence || "—"} · Recommendation {a.bid_recommendation || "—"}</span>
          </div>
          <div className="kv" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {[
              ["What the buyer is procuring", a.what_buyer_is_procuring],
              ["Why Flotek matches", a.why_flotek_matches],
              ["Qualification requirements", a.qualification_requirements],
              ["Capability gaps", a.capability_gaps],
              ["Commercial attractiveness", a.commercial_attractiveness],
              ["Mandatory accreditations", a.mandatory_accreditations],
              ["Recommended next action", a.recommended_next_action],
            ].map(([k, v]) => (
              <div key={k as string}><span>{k}</span><b style={{ fontWeight: 400 }}>{v || <span className="unknown">Not provided</span>}</b></div>
            ))}
          </div>
        </section>
      )}

      <div className="grid2">
        <section className="panel" style={{ margin: 0 }}>
          <h3 className="sub">Notes<span className="dot">.</span></h3>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes — who is looking at this, questions for the buyer, partners…" />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-violet btn-sm" disabled={saving || notes === (o.notes || "")} onClick={() => patch({ notes })}>Save notes</button>
          </div>
        </section>
        <section className="panel" style={{ margin: 0 }}>
          <h3 className="sub">Change history<span className="dot">.</span></h3>
          {changes.length === 0 ? (
            <p className="small muted">No changes detected since this notice was first seen.</p>
          ) : (
            <table className="tbl">
              <thead><tr><th>When</th><th>Field</th><th>From</th><th>To</th></tr></thead>
              <tbody>
                {changes.map((c, i) => (
                  <tr key={i}><td>{fmtDate(c.changed_at, true)}</td><td>{c.field}</td><td>{c.old_value}</td><td>{c.new_value}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Shell>
  );
}
