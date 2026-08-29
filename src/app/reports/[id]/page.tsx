"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import type { ReportData } from "@/lib/report";

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/reports/${id}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) setError(j.error || "Not found");
      else setReport(j.report.data);
    });
  }, [id]);

  async function downloadPdf() {
    if (!report) return;
    setPdfBusy(true);
    try {
      const [{ pdf }, mod] = await Promise.all([import("@react-pdf/renderer"), import("@/components/ReportPdf")]);
      mod.registerFonts(window.location.origin);
      const blob = await pdf(<mod.default report={report} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Flotek_Weekly_Tender_Opportunities_${report.reportingDate}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError(`PDF generation failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPdfBusy(false);
    }
  }

  if (error) return <Shell><div className="empty">{error}. <Link href="/reports">Back to report history</Link></div></Shell>;
  if (!report) return <Shell><div className="empty">Loading…</div></Shell>;

  const reportingDate = new Date(report.reportingDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const count = report.opportunities.length;

  return (
    <Shell>
      <div className="row noprint" style={{ margin: "18px 0", justifyContent: "space-between" }}>
        <div>
          <Link href="/reports">← Report history</Link>
          <h1 style={{ fontSize: 20, marginTop: 4 }}>{report.title}</h1>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={downloadPdf} disabled={pdfBusy}>{pdfBusy ? "Generating PDF…" : "Download PDF"}</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Print report</button>
        </div>
      </div>

      <div className="rpt">
        <section className="rpt-page rpt-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/flotek-logo-white.svg" alt="Flotek" />
          <div className="kicker">Tender intelligence</div>
          <h2>Weekly Opportunity Report</h2>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 8px" }}>{count} opportunit{count === 1 ? "y" : "ies"} worth a closer look<span className="dot">.</span></p>
          <p className="lead">{report.intro}</p>
          <div className="grid3" style={{ marginTop: 34 }}>
            <div className="rpt-stat"><b>{report.combinedValueLabel}</b><span>combined published value</span></div>
            <div className="rpt-stat"><b>{report.strongMatches}</b><span>strong matches (70+)</span></div>
            <div className="rpt-stat"><b>{report.needingAction}</b><span>needing action within 14 days</span></div>
          </div>
          <div className="grid3 rpt-meta" style={{ marginTop: 36 }}>
            <div><b>Reporting date</b><div>{reportingDate}</div></div>
            <div><b>Prepared by</b><div>Flotek Tender Radar</div></div>
            <div><b>Classification</b><div>Internal — commercial in confidence</div></div>
          </div>
          <p style={{ fontSize: 11, color: "#efe4f2", marginTop: 40 }}>* {report.valueFootnote}</p>
          <div className="rpt-foot"><span>Flotek Tender Radar · Weekly opportunity report · {report.weekEnding}</span><span>Cover</span></div>
        </section>

        <section className="rpt-page">
          <div className="rpt-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/flotek-logo.svg" alt="Flotek" />
            <span>Week ending {report.weekEnding}</span>
          </div>
          <div className="eyebrow">At a glance</div>
          <h3 className="big">Weekly tender shortlist<span className="dot">.</span></h3>
          <p className="small muted">Ranked by Flotek fit score. Each opportunity is detailed on the pages that follow.</p>
          {report.opportunities.map((o) => (
            <div className="glance" key={o.id}>
              <div className="num">{String(o.rank).padStart(2, "0")}</div>
              <div>
                <div className="name">{o.title}</div>
                <div className="buyer">{o.buyer}</div>
                <div className="rec">Recommended: {o.shortAction}</div>
              </div>
              <div className="vd">
                <div><span>Priority</span>{o.priority}</div>
                <div><span>Fit</span>{o.score}/100</div>
                <div><span>Value</span>{o.valueLabel}</div>
                <div><span>Deadline</span>{o.deadlineLabel}</div>
              </div>
            </div>
          ))}
          <div className="rpt-foot"><span>Flotek Tender Radar · Weekly opportunity report · {report.weekEnding}</span><span>Shortlist</span></div>
        </section>

        {report.opportunities.map((o) => (
          <section className="rpt-page" key={o.id}>
            <div className="rpt-head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/flotek-logo.svg" alt="Flotek" />
              <span>Opportunity {String(o.rank).padStart(2, "0")} of {String(count).padStart(2, "0")}</span>
            </div>
            <div className="opp-tags">{o.tags.join("  ·  ")}</div>
            <h3 className="big">{o.title}</h3>
            <div style={{ color: "var(--plum)", fontWeight: 500, marginTop: 4 }}>{o.buyer}</div>
            <div className="opp-score">
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5, lineHeight: 1.55 }}>{o.summary}</p>
              <div className="sc">
                <b>{o.score}<small style={{ fontSize: 13, color: "var(--plum-lighter)" }}>/100</small></b>
                <span>Fit score · {o.fitCategory}</span>
                <em>{o.priorityLabel}</em>
                <span style={{ color: "var(--green)" }}>{o.confidence}</span>
              </div>
            </div>
            <div className="opp-facts">
              <div><span>Estimated value</span><b>{o.valueLabel}</b><small>{o.valueNote}</small></div>
              <div><span>Deadline</span><b>{o.deadlineLabel}</b><small>{o.deadlineNote}</small></div>
              <div><span>Term</span><b>{o.term}</b><small>{o.termNote}</small></div>
              <div><span>Evaluation</span><b>{o.evaluation}</b><small>{o.evaluationNote}</small></div>
            </div>
            <div className="opp-cols">
              <div>
                <h4>Why Flotek is a strong match</h4>
                {o.whyMatch.map((p, i) => <div className="pt" key={i}>{p.title && <b>{p.title}</b>}<p>{p.body}</p></div>)}
              </div>
              <div>
                <h4>Qualify before committing</h4>
                {o.qualify.map((p, i) => <div className="pt" key={i}><b>{p.title}</b><p>{p.body}</p></div>)}
              </div>
            </div>
            <div className="opp-rec">
              <b>Recommended action</b>
              <p>{o.recommendedAction}</p>
              {o.url ? <a className="btn btn-primary btn-sm" href={o.url} target="_blank" rel="noopener noreferrer">View notice</a> : <span />}
            </div>
            <div className="opp-src">Source: {o.source}{o.region ? ` · ${o.region}` : ""}. Figures are as published in the notice; nothing has been estimated.</div>
            <div className="rpt-foot"><span>Flotek Tender Radar · Weekly opportunity report · {report.weekEnding}</span><span>Opportunity {String(o.rank).padStart(2, "0")}</span></div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
