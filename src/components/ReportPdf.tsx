"use client";
import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, Svg, Path, Link } from "@react-pdf/renderer";
import type { ReportData, ReportOpportunity } from "@/lib/report";
import { LOGO_MARK, LOGO_WORD, LOGO_VIEWBOX } from "@/lib/logoPaths";

const VIOLET = "#4b1c4b";
const PLUM = "#8a3b8e";
const PLUM_LIGHTER = "#c4aacf";
const ORANGE = "#ee792c";
const GREEN = "#99bfaa";
const MUTED = "#704a70";
const MUTED_SOFT = "#947793";
const RULE = "#ede8ed";

let registered = false;
export function registerFonts(origin: string) {
  if (registered) return;
  Font.register({
    family: "Space Grotesk",
    fonts: [
      { src: `${origin}/fonts/SpaceGrotesk-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/SpaceGrotesk-Medium.ttf`, fontWeight: 500 },
      { src: `${origin}/fonts/SpaceGrotesk-Bold.ttf`, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

const s = StyleSheet.create({
  page: { fontFamily: "Space Grotesk", fontSize: 10, color: VIOLET, paddingTop: 40, paddingBottom: 46, paddingHorizontal: 44, backgroundColor: "#fff" },
  cover: { backgroundColor: PLUM, color: "#fff", paddingTop: 44, paddingHorizontal: 48, paddingBottom: 40 },
  kicker: { fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: ORANGE, fontWeight: 500 },
  eyebrow: { fontSize: 7, letterSpacing: 1.6, textTransform: "uppercase", color: MUTED_SOFT, fontWeight: 500 },
  coverTitle: { fontSize: 34, fontWeight: 700, lineHeight: 1.05, marginTop: 26, maxWidth: 380, letterSpacing: -0.8 },
  coverLead: { fontSize: 10.5, color: "#efe4f2", marginTop: 12, maxWidth: 380, lineHeight: 1.45 },
  statRow: { flexDirection: "row", marginTop: 34, gap: 22 },
  stat: { flex: 1, borderTopWidth: 2, borderTopColor: ORANGE, paddingTop: 8 },
  statNum: { fontSize: 24, fontWeight: 700, lineHeight: 1.1 },
  statLab: { fontSize: 8.5, color: "#efe4f2", marginTop: 2 },
  metaRow: { flexDirection: "row", marginTop: 40, gap: 22 },
  metaLab: { fontSize: 7, letterSpacing: 1.6, textTransform: "uppercase", color: ORANGE, fontWeight: 500, marginBottom: 3 },
  metaVal: { fontSize: 9.5 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 22, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED_SOFT, borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 6 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  h2: { fontSize: 20, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.15 },
  glance: { flexDirection: "row", paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: RULE, gap: 12 },
  glanceNum: { width: 26, fontSize: 18, fontWeight: 700, color: PLUM_LIGHTER, lineHeight: 1 },
  glanceName: { fontSize: 11, fontWeight: 700 },
  glanceBuyer: { fontSize: 9, color: PLUM, marginTop: 1 },
  glanceRec: { fontSize: 8.5, color: MUTED, marginTop: 4, lineHeight: 1.4 },
  glanceCol: { width: 150 },
  small: { fontSize: 7, letterSpacing: 1.4, textTransform: "uppercase", color: MUTED_SOFT, fontWeight: 500 },
  tags: { fontSize: 7, letterSpacing: 1.6, textTransform: "uppercase", color: PLUM, fontWeight: 500, marginBottom: 8 },
  oppTitle: { fontSize: 19, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.4 },
  oppBuyer: { fontSize: 10, color: PLUM, fontWeight: 500, marginTop: 4 },
  scoreRow: { flexDirection: "row", gap: 18, marginTop: 14, alignItems: "flex-start" },
  scoreBox: { width: 120, backgroundColor: VIOLET, color: "#fff", borderRadius: 4, padding: 10, alignItems: "center" },
  scoreNum: { fontSize: 30, fontWeight: 700, lineHeight: 1 },
  scoreLab: { fontSize: 6.5, letterSpacing: 1.4, textTransform: "uppercase", color: PLUM_LIGHTER, marginTop: 3 },
  scorePri: { fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", color: ORANGE, marginTop: 7, fontWeight: 500 },
  summary: { fontSize: 9.5, lineHeight: 1.5, color: MUTED, flex: 1 },
  facts: { flexDirection: "row", gap: 12, marginTop: 14, paddingVertical: 10, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: RULE },
  fact: { flex: 1 },
  factVal: { fontSize: 12.5, fontWeight: 700, marginTop: 2 },
  factNote: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  cols: { flexDirection: "row", gap: 20, marginTop: 14 },
  col: { flex: 1 },
  colHead: { fontSize: 7, letterSpacing: 1.6, textTransform: "uppercase", color: ORANGE, fontWeight: 500, marginBottom: 7 },
  ptTitle: { fontSize: 9.5, fontWeight: 700 },
  ptBody: { fontSize: 8.5, color: MUTED, lineHeight: 1.45, marginTop: 1, marginBottom: 7 },
  rec: { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: "#f6f4f6", borderRadius: 4, padding: 12, marginTop: 14 },
  recLab: { width: 110, fontSize: 7, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 500 },
  recBody: { flex: 1, fontSize: 9, lineHeight: 1.45 },
  btn: { backgroundColor: ORANGE, color: "#fff", fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 500, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 3, textDecoration: "none" },
  src: { fontSize: 7.5, color: MUTED_SOFT, marginTop: 10 },
});

function Logo({ height = 16, white = false }: { height?: number; white?: boolean }) {
  const w = (980.75 / 212.71) * height;
  return (
    <Svg viewBox={LOGO_VIEWBOX} width={w} height={height}>
      {LOGO_MARK.map((p, i) => (
        <Path key={i} d={p.d} fill={white ? (i === 0 ? VIOLET : i === 1 ? "#5cba9e" : PLUM_LIGHTER) : p.fill} />
      ))}
      {LOGO_WORD.map((d, i) => (
        <Path key={"w" + i} d={d} fill={white ? "#fff" : VIOLET} />
      ))}
    </Svg>
  );
}

function Footer({ report, page, white = false }: { report: ReportData; page: string; white?: boolean }) {
  return (
    <View style={[s.footer, white ? { color: "#e6d6ea", borderTopColor: "#a565a8" } : {}]} fixed>
      <Text>Flotek Tender Radar · Weekly opportunity report · {report.weekEnding}</Text>
      <Text>{page}</Text>
    </View>
  );
}

function OppPage({ o, report }: { o: ReportOpportunity; report: ReportData }) {
  const n = String(o.rank).padStart(2, "0");
  return (
    <Page size="A4" style={s.page}>
      <View style={s.head}>
        <Logo />
        <Text style={s.small}>Opportunity {n} of {String(report.opportunities.length).padStart(2, "0")}</Text>
      </View>
      <Text style={s.tags}>{o.tags.join("  ·  ")}</Text>
      <Text style={s.oppTitle}>{o.title}</Text>
      <Text style={s.oppBuyer}>{o.buyer}</Text>

      <View style={s.scoreRow}>
        <View style={s.scoreBox}>
          <Text style={s.scoreNum}>{o.score}<Text style={{ fontSize: 10, color: PLUM_LIGHTER }}>/100</Text></Text>
          <Text style={s.scoreLab}>Fit score · {o.fitCategory}</Text>
          <Text style={s.scorePri}>{o.priorityLabel}</Text>
          <Text style={[s.scoreLab, { color: GREEN }]}>{o.confidence}</Text>
        </View>
        <Text style={s.summary}>{o.summary}</Text>
      </View>

      <View style={s.facts}>
        <View style={s.fact}><Text style={s.small}>Estimated value</Text><Text style={s.factVal}>{o.valueLabel}</Text><Text style={s.factNote}>{o.valueNote}</Text></View>
        <View style={s.fact}><Text style={s.small}>Deadline</Text><Text style={s.factVal}>{o.deadlineLabel}</Text><Text style={s.factNote}>{o.deadlineNote}</Text></View>
        <View style={s.fact}><Text style={s.small}>Term</Text><Text style={s.factVal}>{o.term}</Text><Text style={s.factNote}>{o.termNote}</Text></View>
        <View style={s.fact}><Text style={s.small}>Evaluation</Text><Text style={s.factVal}>{o.evaluation}</Text><Text style={s.factNote}>{o.evaluationNote}</Text></View>
      </View>

      <View style={s.cols}>
        <View style={s.col}>
          <Text style={s.colHead}>Why Flotek is a strong match</Text>
          {o.whyMatch.map((p, i) => (
            <View key={i}>
              {p.title ? <Text style={s.ptTitle}>{p.title}</Text> : null}
              <Text style={s.ptBody}>{p.body}</Text>
            </View>
          ))}
        </View>
        <View style={s.col}>
          <Text style={s.colHead}>Qualify before committing</Text>
          {o.qualify.map((p, i) => (
            <View key={i}>
              <Text style={s.ptTitle}>{p.title}</Text>
              <Text style={s.ptBody}>{p.body}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.rec}>
        <Text style={s.recLab}>Recommended action</Text>
        <Text style={s.recBody}>{o.recommendedAction}</Text>
        {o.url ? (
          <Link src={o.url} style={s.btn}>View notice</Link>
        ) : null}
      </View>
      <Text style={s.src}>Source: {o.source}{o.region ? ` · ${o.region}` : ""}. Figures are as published in the notice; nothing has been estimated.</Text>
      <Footer report={report} page={`Opportunity ${n}`} />
    </Page>
  );
}

export default function ReportPdf({ report }: { report: ReportData }) {
  const count = report.opportunities.length;
  const reportingDate = new Date(report.reportingDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <Document title={report.title} author="Flotek" subject="Weekly tender opportunities">
      {/* Cover */}
      <Page size="A4" style={[s.page, s.cover]}>
        <Logo height={22} white />
        <Text style={[s.kicker, { marginTop: 10 }]}>Tender intelligence</Text>
        <Text style={s.coverTitle}>Weekly Opportunity Report</Text>
        <Text style={[s.coverLead, { fontSize: 16, color: "#fff", fontWeight: 500, marginTop: 6 }]}>
          {count} opportunit{count === 1 ? "y" : "ies"} worth a closer look<Text style={{ color: ORANGE }}>.</Text>
        </Text>
        <Text style={s.coverLead}>{report.intro}</Text>
        <View style={s.statRow}>
          <View style={s.stat}><Text style={s.statNum}>{report.combinedValueLabel}</Text><Text style={s.statLab}>combined published value</Text></View>
          <View style={s.stat}><Text style={s.statNum}>{report.strongMatches}</Text><Text style={s.statLab}>strong matches (70+)</Text></View>
          <View style={s.stat}><Text style={s.statNum}>{report.needingAction}</Text><Text style={s.statLab}>needing action within 14 days</Text></View>
        </View>
        <View style={s.metaRow}>
          <View><Text style={s.metaLab}>Reporting date</Text><Text style={s.metaVal}>{reportingDate}</Text></View>
          <View><Text style={s.metaLab}>Prepared by</Text><Text style={s.metaVal}>Flotek Tender Radar</Text></View>
          <View><Text style={s.metaLab}>Classification</Text><Text style={s.metaVal}>Internal — commercial in confidence</Text></View>
        </View>
        <Text style={{ position: "absolute", left: 48, right: 48, bottom: 48, fontSize: 7.5, color: "#efe4f2", lineHeight: 1.4 }}>* {report.valueFootnote}</Text>
        <Footer report={report} page="Cover" white />
      </Page>

      {/* At a glance */}
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <Logo />
          <Text style={s.small}>Week ending {report.weekEnding}</Text>
        </View>
        <Text style={s.eyebrow}>At a glance</Text>
        <Text style={[s.h2, { marginTop: 4, marginBottom: 6 }]}>Weekly tender shortlist<Text style={{ color: ORANGE }}>.</Text></Text>
        <Text style={{ fontSize: 9, color: MUTED, marginBottom: 6 }}>Ranked by Flotek fit score. Each opportunity is detailed on the pages that follow.</Text>
        {report.opportunities.map((o) => (
          <View key={o.id} style={s.glance} wrap={false}>
            <Text style={s.glanceNum}>{String(o.rank).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.glanceName}>{o.title}</Text>
              <Text style={s.glanceBuyer}>{o.buyer}</Text>
              <Text style={s.glanceRec}>Recommended: {o.shortAction}</Text>
            </View>
            <View style={s.glanceCol}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Text style={s.small}>Priority</Text><Text style={{ fontSize: 9, fontWeight: 700, color: o.priority === "CRITICAL" ? ORANGE : VIOLET }}>{o.priority}</Text></View>
                <View style={{ flex: 1 }}><Text style={s.small}>Fit</Text><Text style={{ fontSize: 9, fontWeight: 700 }}>{o.score}/100</Text></View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 5 }}>
                <View style={{ flex: 1 }}><Text style={s.small}>Value</Text><Text style={{ fontSize: 9 }}>{o.valueLabel}</Text></View>
                <View style={{ flex: 1 }}><Text style={s.small}>Deadline</Text><Text style={{ fontSize: 9 }}>{o.deadlineLabel}</Text></View>
              </View>
            </View>
          </View>
        ))}
        <Footer report={report} page="Shortlist" />
      </Page>

      {report.opportunities.map((o) => (
        <OppPage key={o.id} o={o} report={report} />
      ))}
    </Document>
  );
}
