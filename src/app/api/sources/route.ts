import { query } from "@/lib/db";
import { SOURCES } from "@/lib/sources/registry";
import { loadSettings } from "@/lib/settings";
import { json, errorResponse } from "../_util";
import type { SourceStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [rows, settings] = await Promise.all([
      query<{ source_id: string; status: SourceStatus; message: string; notices_checked: number; checked_at: string }>(`SELECT * FROM source_status`),
      loadSettings(),
    ]);
    const byId = new Map(rows.map((r) => [r.source_id, r]));
    const sources = SOURCES.map((s) => {
      const r = byId.get(s.id);
      let status: SourceStatus;
      let message: string;
      if (s.kind === "manual") {
        status = "MANUAL SEARCH REQUIRED";
        message = s.description;
      } else if (s.kind === "feed" && !settings.feedUrls[s.id]) {
        status = "NOT CONNECTED";
        message = "No feed URL configured in Settings";
      } else if (r && !(s.kind === "api" && r.status === "NOT CONNECTED")) {
        status = r.status;
        message = r.message || "";
      } else {
        status = s.kind === "api" ? "CONNECTED" : "NOT CONNECTED";
        message = s.kind === "api" ? "Ready — not searched yet" : "Feed configured — not searched yet";
      }
      return { ...s, status, message, noticesChecked: r?.notices_checked ?? 0, checkedAt: r?.checked_at ?? null, feedUrl: settings.feedUrls[s.id] || "" };
    });
    return json({ sources });
  } catch (e) {
    return errorResponse(e);
  }
}
