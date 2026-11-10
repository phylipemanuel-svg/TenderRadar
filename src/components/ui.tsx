"use client";
import type { Opportunity } from "@/lib/types";

export const cls = (s: string) => "t-" + s.toLowerCase().replace(/[^a-z]/g, "");

export function Tag({ text, kind }: { text: string; kind?: string }) {
  return <span className={`tag ${cls(kind || text)}`}>{text}</span>;
}

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "Not stated";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Not stated";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (!withTime) return date;
  const hasTime = /T\d{2}:\d{2}/.test(iso) && !/T00:00(:00)?/.test(iso);
  return hasTime ? `${date}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : date;
}

export function fmtMoney(v: number | null | undefined, currency = "GBP"): string {
  if (v == null || isNaN(v)) return "Not stated";
  const sym = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency + " ";
  return sym + Math.round(v).toLocaleString("en-GB");
}

export function daysLabel(o: Opportunity): { text: string; warn: boolean } {
  if (o.liveStatus === "PIPELINE" || o.liveStatus === "MARKET ENGAGEMENT") return { text: "Pipeline", warn: false };
  if (o.daysRemaining == null) return { text: "Not stated", warn: false };
  if (o.daysRemaining < 0) return { text: "Closed", warn: false };
  if (o.daysRemaining === 0) return { text: "Today", warn: true };
  return { text: `${o.daysRemaining} day${o.daysRemaining === 1 ? "" : "s"}`, warn: o.daysRemaining <= 7 };
}

export function scoreClass(score: number) {
  return score >= 90 ? "s90" : score >= 80 ? "s80" : score >= 60 ? "s60" : "s40";
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}
