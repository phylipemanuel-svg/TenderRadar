import type { LiveStatus, Priority, RawNotice } from "./types";

export function daysRemaining(deadline: string | null, now = new Date()): number | null {
  if (!deadline) return null;
  const t = Date.parse(deadline);
  if (isNaN(t)) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dl = new Date(t);
  const startOfDl = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate()).getTime();
  return Math.round((startOfDl - startOfToday) / 86400000);
}

const MARKET_ENGAGEMENT_RE =
  /\b(market engagement|soft market|market sounding|market testing|prior information notice|\bpin\b|early engagement|supplier engagement|request for information|\brfi\b|preliminary market|pre-?market|market consultation|planned procurement|future opportunity)\b/i;

export function liveStatus(n: RawNotice, days: number | null, now = new Date()): LiveStatus {
  const text = `${n.title} ${n.procurementMethodDetails || ""} ${n.rawStatus || ""}`;
  if (n.stage === "planning") {
    if (MARKET_ENGAGEMENT_RE.test(text) || MARKET_ENGAGEMENT_RE.test(n.description.slice(0, 600))) return "MARKET ENGAGEMENT";
    return "PIPELINE";
  }
  if (n.stage === "award") return "CLOSED";
  if (/\b(cancelled|withdrawn|complete|unsuccessful)\b/i.test(n.rawStatus || "")) return "CLOSED";
  if (days == null) {
    if (MARKET_ENGAGEMENT_RE.test(text)) return "MARKET ENGAGEMENT";
    return "OPEN";
  }
  if (n.deadline && Date.parse(n.deadline) < now.getTime()) return "CLOSED";
  if (days <= 7) return "CLOSING SOON";
  return "OPEN";
}

export function priorityFor(days: number | null, status: LiveStatus): Priority {
  if (status === "CLOSED") return "NORMAL";
  if (days == null) return "NORMAL";
  if (days <= 7) return "CRITICAL";
  if (days <= 14) return "HIGH";
  if (days <= 30) return "MEDIUM";
  return "NORMAL";
}

export const LIVE_STATUSES: LiveStatus[] = ["OPEN", "CLOSING SOON", "PIPELINE", "MARKET ENGAGEMENT", "CLOSED"];
