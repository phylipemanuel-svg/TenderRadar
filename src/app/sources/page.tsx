"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Tag, fmtDate } from "@/components/ui";
import type { SourceDefinition, SourceStatus } from "@/lib/types";

type Row = SourceDefinition & { status: SourceStatus; message: string; noticesChecked: number; checkedAt: string | null; feedUrl: string };

export default function SourcesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/sources").then(async (r) => { const j = await r.json(); if (!r.ok) setErr(j.error); else setRows(j.sources); });
  }, []);
  const groups: { title: string; kind: SourceDefinition["kind"]; blurb: string }[] = [
    { title: "Searched automatically (official APIs)", kind: "api", blurb: "Open data APIs (Find a Tender, Contracts Finder, Sell2Wales, Public Contracts Scotland). No registration or key needed. Since the Procurement Act 2023, Find a Tender is the central platform for the whole UK, so notices from the manual portals below are also captured here; Sell2Wales and PCS add the below-threshold Welsh and Scottish notices." },
    { title: "Feed connectors (paste a feed URL in Settings)", kind: "feed", blurb: "This portal publishes a public notice feed but no search API. Once a feed URL on the portal's own domain is saved in Settings, it is read on every search. Feed notices carry less structure, so the app flags them for manual verification of deadline and value." },
    { title: "Manual search required", kind: "manual", blurb: "These portals need a supplier login and offer no public API, so the app never claims to have searched them. Use the links to check them directly. Their above-threshold tenders are legally required to appear on Find a Tender, which is searched." },
  ];
  return (
    <Shell>
      <div className="hero">
        <div className="eyebrow">Sources</div>
        <h1>Where the notices come from<span className="dot">.</span></h1>
        <p>Every source shows its real status from the last search. Nothing is listed as searched unless the app actually queried it.</p>
      </div>
      {err && <div className="note">{err}</div>}
      {groups.map((g) => (
        <section className="panel" key={g.kind}>
          <h2 className="sec">{g.title}<span className="dot">.</span></h2>
          <p className="small muted">{g.blurb}</p>
          <table className="tbl">
            <thead><tr><th>Source</th><th>Status</th><th>Detail</th><th>Last checked</th><th>Notices checked</th><th></th></tr></thead>
            <tbody>
              {rows.filter((r) => r.kind === g.kind).map((r) => (
                <tr key={r.id}>
                  <td><b>{r.label}</b><div className="small muted">{r.description}</div></td>
                  <td><Tag text={r.status} kind={r.status === "MANUAL SEARCH REQUIRED" ? "manual" : r.status} /></td>
                  <td className="small">{r.message}{r.kind === "feed" && r.feedUrl && <div className="mono muted">{r.feedUrl}</div>}</td>
                  <td className="small">{r.checkedAt ? fmtDate(r.checkedAt, true) : "—"}</td>
                  <td>{r.kind === "manual" ? "—" : r.noticesChecked.toLocaleString()}</td>
                  <td><a href={r.website} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Open portal ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {g.kind === "feed" && <p className="small" style={{ marginBottom: 0 }}><Link href="/settings#feeds">Configure feed URLs in Settings →</Link></p>}
        </section>
      ))}
    </Shell>
  );
}
