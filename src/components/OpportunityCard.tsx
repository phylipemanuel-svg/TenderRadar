"use client";
import Link from "next/link";
import type { Opportunity } from "@/lib/types";
import { Tag, fmtDate, fmtMoney, daysLabel, scoreClass } from "./ui";

export default function OpportunityCard({ o, onSelect, busy }: { o: Opportunity; onSelect: (o: Opportunity, selected: boolean) => void; busy?: boolean }) {
  const days = daysLabel(o);
  const href = `/opportunity/${encodeURIComponent(o.id)}`;
  return (
    <article className={`card${o.selected ? " selected" : ""}`}>
      <div className={`score ${scoreClass(o.fit.score)}`}>
        <b>
          {o.fit.score}
          <small>/100</small>
        </b>
        <em>{o.fit.category}</em>
        <Tag text={o.priority} />
      </div>
      <div>
        <div className="row" style={{ gap: 6, marginBottom: 6 }}>
          <Tag text={o.changeStatus} />
          <Tag text={o.liveStatus} />
          {o.decision && o.decision !== "NONE" && <Tag text={o.decision} kind="decision" />}
          {o.selected && <Tag text="Selected for report" kind="new" />}
        </div>
        <Link href={href} className="title">
          {o.title}
        </Link>
        <div className="buyer">{o.buyer}</div>
        <p className="desc">{(o.analysis?.what_buyer_is_procuring || o.description || "No description published.").slice(0, 260)}{(o.description || "").length > 260 ? "…" : ""}</p>
        <div className="facts">
          <div className="fact"><span>Value</span><b>{fmtMoney(o.value, o.currency)}</b></div>
          <div className="fact"><span>Deadline</span><b>{fmtDate(o.deadline, true)}</b></div>
          <div className="fact"><span>Days remaining</span><b className={days.warn ? "warn" : ""}>{days.text}</b></div>
          <div className="fact"><span>Region</span><b>{o.regionLabel}</b></div>
          <div className="fact"><span>Category</span><b>{o.fit.matchedServices[0] || "—"}</b></div>
          <div className="fact"><span>CPV</span><b>{o.cpv[0] || "None"}{o.cpv.length > 1 ? ` +${o.cpv.length - 1}` : ""}</b></div>
          <div className="fact"><span>Source</span><b>{o.sources.join(", ")}</b></div>
          <div className="fact"><span>Reference</span><b className="mono">{o.reference || o.ocid || "—"}</b></div>
        </div>
        <div className="actions">
          <Link href={href} className="btn btn-violet btn-sm">View details</Link>
          {o.url ? (
            <a href={o.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">View original notice ↗</a>
          ) : (
            <span className="small muted">No notice link published</span>
          )}
          <button className={`btn btn-sm ${o.selected ? "btn-outline" : "btn-primary"}`} disabled={busy} onClick={() => onSelect(o, !o.selected)}>
            {o.selected ? "Remove from report" : "Select for report"}
          </button>
        </div>
      </div>
    </article>
  );
}
