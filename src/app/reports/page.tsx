"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { fmtDate, fmtMoney } from "@/components/ui";

interface Row { id: number; created_at: string; title: string; reporting_date: string; opportunity_count: number; combined_value: string | null }

export default function ReportHistory() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = () => fetch("/api/reports").then((r) => r.json()).then((j) => setRows(j.reports || []));
  useEffect(() => { load(); }, []);
  async function del(id: number) {
    if (!confirm("Delete this report? This cannot be undone.")) return;
    await fetch(`/api/reports/${id}`, { method: "DELETE" });
    load();
  }
  return (
    <Shell>
      <div className="hero">
        <div className="eyebrow">Report history</div>
        <h1>Previous weekly reports<span className="dot">.</span></h1>
        <p>Every report is stored as a snapshot, so it can be re-downloaded exactly as it was produced.</p>
      </div>
      <section className="panel">
        {rows.length === 0 ? <div className="empty">No reports yet. <Link href="/report">Build the first one.</Link></div> : (
          <table className="tbl">
            <thead><tr><th>Reporting date</th><th>Title</th><th>Opportunities</th><th>Combined value</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.reporting_date)}</td>
                  <td><Link href={`/reports/${r.id}`}>{r.title}</Link></td>
                  <td>{r.opportunity_count}</td>
                  <td>{r.combined_value ? fmtMoney(Number(r.combined_value)) : "—"}</td>
                  <td>{fmtDate(r.created_at, true)}</td>
                  <td className="row" style={{ gap: 6 }}>
                    <Link href={`/reports/${r.id}`} className="btn btn-violet btn-sm">View / download</Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => del(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Shell>
  );
}
