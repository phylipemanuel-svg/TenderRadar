"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import type { Settings, RegionId } from "@/lib/types";
import { REGIONS, BUYER_TYPE_LABEL } from "@/lib/regions";
import { SOURCES } from "@/lib/sources/registry";

const WEIGHT_LABELS: Record<string, string> = {
  service: "Service / category match",
  cpv: "CPV code match",
  keyword: "Keyword strength",
  buyer: "Preferred buyer type",
  geography: "Preferred geography",
  value: "Contract value suitability",
  framework: "Framework / recurring potential",
  multiService: "Multiple Flotek services",
};

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cpvText, setCpvText] = useState("");
  const [groupText, setGroupText] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((j) => apply(j.settings));
  }, []);

  function apply(settings: Settings) {
    setS(settings);
    setCpvText(settings.cpvLibrary.map((e) => `${e.code}\t${e.label}\t${e.group}`).join("\n"));
    setGroupText(Object.fromEntries(settings.keywordGroups.map((g) => [g.id, g.terms.join(", ")])));
  }

  async function save(reset = false) {
    if (!s) return;
    setBusy(true);
    setMsg(null);
    try {
      const settings: Settings = {
        ...s,
        keywordGroups: s.keywordGroups.map((g) => ({ ...g, terms: (groupText[g.id] || "").split(/[,\n]/).map((t) => t.trim()).filter(Boolean) })),
        cpvLibrary: cpvText
          .split("\n")
          .map((line) => {
            const [code, label = "", group = "managedit"] = line.split(/\t|\s{2,}|\s*\|\s*/);
            return { code: (code || "").replace(/\D/g, "").slice(0, 8), label: label.trim(), group: group.trim() || "managedit" };
          })
          .filter((e) => e.code.length === 8),
      };
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings, reset }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save");
      apply(j.settings);
      setMsg(reset ? "Settings reset to Flotek defaults." : "Settings saved. They apply to the next search.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!s) return <Shell><div className="empty">Loading…</div></Shell>;
  const totalWeight = Object.values(s.weights).reduce((a, b) => a + b, 0);

  return (
    <Shell>
      <div className="hero">
        <div className="eyebrow">Settings</div>
        <h1>Tune the matching engine<span className="dot">.</span></h1>
        <p>All matching is rules-based and transparent. Changes apply to the next search you run.</p>
      </div>

      <div className="row" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--paper)", padding: "10px 0" }}>
        <button className="btn btn-primary" onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        <button className="btn btn-ghost" onClick={() => { if (confirm("Reset every setting to the Flotek defaults?")) save(true); }} disabled={busy}>Reset to defaults</button>
        {msg && <span className="small">{msg}</span>}
      </div>

      <section className="panel">
        <h2 className="sec">General<span className="dot">.</span></h2>
        <div className="grid3">
          <label className="fld"><span className="eyebrow">Minimum fit score shown (default 60)</span><input type="number" min={0} max={100} value={s.minScore} onChange={(e) => setS({ ...s, minScore: Number(e.target.value) })} /></label>
          <label className="fld"><span className="eyebrow">Default look-back (days)</span><input type="number" min={7} max={365} value={s.lookbackDays} onChange={(e) => setS({ ...s, lookbackDays: Number(e.target.value) })} /></label>
          <div className="fld">
            <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>Default preferred regions</span>
            <div className="chips">
              {REGIONS.map((r) => (
                <button key={r.id} className="chip" aria-pressed={s.defaultRegions.includes(r.id)} onClick={() => setS({ ...s, defaultRegions: s.defaultRegions.includes(r.id) ? s.defaultRegions.filter((x) => x !== r.id) : [...s.defaultRegions, r.id as RegionId] })}>{r.label}</button>
              ))}
            </div>
          </div>
          <label className="fld"><span className="eyebrow">Ideal contract value — from (£)</span><input type="number" min={0} value={s.valueIdealMin} onChange={(e) => setS({ ...s, valueIdealMin: Number(e.target.value) })} /></label>
          <label className="fld"><span className="eyebrow">Ideal contract value — to (£)</span><input type="number" min={0} value={s.valueIdealMax} onChange={(e) => setS({ ...s, valueIdealMax: Number(e.target.value) })} /></label>
        </div>
      </section>

      <section className="panel">
        <h2 className="sec">Score weights<span className="dot">.</span> <span className="small muted" style={{ fontWeight: 400 }}>total {totalWeight}{totalWeight !== 100 ? " — scores are capped at 100" : ""}</span></h2>
        <div className="grid4">
          {Object.keys(s.weights).map((k) => (
            <label className="fld" key={k}><span className="eyebrow">{WEIGHT_LABELS[k] || k}</span><input type="number" min={0} max={100} value={s.weights[k as keyof Settings["weights"]]} onChange={(e) => setS({ ...s, weights: { ...s.weights, [k]: Number(e.target.value) } })} /></label>
          ))}
        </div>
        <h3 className="sub" style={{ marginTop: 6 }}>Buyer type points (out of 10)</h3>
        <div className="grid4">
          {Object.keys(s.buyerPoints).map((k) => (
            <label className="fld" key={k}><span className="eyebrow">{BUYER_TYPE_LABEL[k] || k}</span><input type="number" min={0} max={10} value={s.buyerPoints[k]} onChange={(e) => setS({ ...s, buyerPoints: { ...s.buyerPoints, [k]: Number(e.target.value) } })} /></label>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="sec">Keyword groups<span className="dot">.</span></h2>
        <p className="small muted">One group per Flotek service. Separate terms with commas. Matching ignores case and treats hyphens and spaces the same, so &quot;Wi-Fi&quot; also matches &quot;wifi&quot;.</p>
        {s.keywordGroups.map((g) => (
          <label className="fld" key={g.id}>
            <span className="eyebrow">{g.label} <span className="muted">({(groupText[g.id] || "").split(",").filter((t) => t.trim()).length} terms)</span></span>
            <textarea value={groupText[g.id] || ""} onChange={(e) => setGroupText({ ...groupText, [g.id]: e.target.value })} style={{ minHeight: 64 }} />
          </label>
        ))}
        <details>
          <summary>Add a new group</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <input type="text" placeholder="Group name, e.g. Printing" id="newgroup" style={{ width: 260 }} />
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const el = document.getElementById("newgroup") as HTMLInputElement;
              const label = el.value.trim();
              if (!label) return;
              const id = label.toLowerCase().replace(/[^a-z0-9]/g, "") || `group${s.keywordGroups.length + 1}`;
              if (s.keywordGroups.some((g) => g.id === id)) return;
              setS({ ...s, keywordGroups: [...s.keywordGroups, { id, label, terms: [] }] });
              setGroupText({ ...groupText, [id]: "" });
              el.value = "";
            }}>Add group</button>
          </div>
        </details>
      </section>

      <section className="panel">
        <h2 className="sec">Exclusion keywords<span className="dot">.</span></h2>
        <p className="small muted">If a notice <b>title</b> contains any of these, it scores 0 and is shown as excluded. Comma separated.</p>
        <textarea value={s.excludeKeywords.join(", ")} onChange={(e) => setS({ ...s, excludeKeywords: e.target.value.split(/[,\n]/).map((t) => t.trim()).filter(Boolean) })} />
      </section>

      <section className="panel">
        <h2 className="sec">CPV library<span className="dot">.</span> <span className="small muted" style={{ fontWeight: 400 }}>{cpvText.split("\n").filter((l) => /^\d{8}/.test(l)).length} codes</span></h2>
        <p className="small muted">One code per line: <code>8-digit code</code> TAB <code>label</code> TAB <code>group id</code>. Group ids: {s.keywordGroups.map((g) => g.id).join(", ")}. Exact matches score highest; codes sharing the first 5 or 4 digits score less.</p>
        <textarea className="mono" value={cpvText} onChange={(e) => setCpvText(e.target.value)} style={{ minHeight: 320 }} />
      </section>

      <section className="panel" id="feeds">
        <h2 className="sec">Feed sources<span className="dot">.</span></h2>
        <p className="small muted">Paste the public RSS/Atom notice feed URL from each portal. Only https links on the portal&apos;s own domain are accepted; nothing else is ever fetched. Leave blank to keep a source as NOT CONNECTED.</p>
        {SOURCES.filter((src) => src.kind === "feed").map((src) => (
          <label className="fld" key={src.id}>
            <span className="eyebrow">{src.label} — must be on {src.allowedHosts[0]}</span>
            <input type="url" placeholder={`https://www.${src.allowedHosts[0]}/…rss…`} value={s.feedUrls[src.id] || ""} onChange={(e) => setS({ ...s, feedUrls: { ...s.feedUrls, [src.id]: e.target.value } })} />
          </label>
        ))}
      </section>
    </Shell>
  );
}
