"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, KeyRound } from "lucide-react";
import type { FeedItem } from "@/lib/types";
import { MODULES, MODULE_MAP } from "@/lib/modules";
import { CopyBtn, Value } from "./ValueView";
import { copyText, prettyJson } from "@/lib/utils";
import { toast } from "@/lib/toast";

function seconds(ms?: number) {
  if (!ms) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function UsernameView({ data }: { data: Record<string, unknown> }) {
  const sites = (data.sites as Record<string, unknown>[]) || [];
  const [onlyFound, setOnlyFound] = useState(true);
  const found = sites.filter((s) => s.verdict === "found");
  const blocked = sites.filter((s) => s.verdict === "blocked");
  const shown = onlyFound ? found : sites;

  const tone: Record<string, string> = {
    found: "#3ddc97",
    not_found: "#3f505d",
    blocked: "#ffb340",
    unknown: "#71879a",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className={`mini-btn ${onlyFound ? "accent" : ""}`} onClick={() => setOnlyFound(true)}>
          Found {found.length}
        </button>
        <button type="button" className={`mini-btn ${!onlyFound ? "accent" : ""}`} onClick={() => setOnlyFound(false)}>
          All {sites.length}
        </button>
        {blocked.length > 0 && <span className="chip amber">{blocked.length} blocked</span>}
        <span className="dim mono" style={{ fontSize: 10, marginLeft: "auto" }}>
          {String(data.checked ?? sites.length)} checked
        </span>
      </div>
      {shown.length === 0 ? (
        <div className="ent-empty">No public profile matched this handle. Try the full sweep to inspect blocked platforms.</div>
      ) : (
        <div className="site-grid">
          {shown.map((s) => (
            <a key={String(s.name)} className="site-row" href={String(s.url)} target="_blank" rel="noreferrer">
              <span className="site-dot" style={{ background: tone[String(s.verdict)] || "#71879a" }} />
              <span className="site-name">{String(s.name)}</span>
              <span className="site-cat">{String(s.category)}</span>
              <ExternalLink size={10} style={{ color: "var(--faint)", flexShrink: 0 }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DorksView({ data }: { data: Record<string, unknown> }) {
  const dorks = (data.dorks as Record<string, string>[]) || [];
  return (
    <div className="blocks">
      {dorks.map((d, i) => (
        <div className="dork-row" key={`${d.query}-${i}`}>
          <span className="dork-label">{d.label}</span>
          <code className="dork-query">{d.query}</code>
          <span className="dork-engine">{d.engine}</span>
          <CopyBtn value={d.query} />
          <a className="mini-btn accent" href={d.url} target="_blank" rel="noreferrer">
            Open
            <ExternalLink size={10} />
          </a>
        </div>
      ))}
    </div>
  );
}

function severityStyle(sev?: string) {
  const s = (sev || "").toUpperCase();
  if (s.includes("CRIT")) return { color: "#ff8a8a", background: "rgba(255,93,93,.14)" };
  if (s.includes("HIGH")) return { color: "#ffb08a", background: "rgba(255,140,90,.13)" };
  if (s.includes("MED")) return { color: "#ffd08a", background: "rgba(255,179,64,.13)" };
  return { color: "#8fe9c0", background: "rgba(61,220,151,.12)" };
}

function CveView({ data }: { data: Record<string, unknown> }) {
  const items = (data.items as Record<string, any>[]) || [];
  if (items.length === 0) return <div className="ent-empty">No matching CVE records.</div>;
  return (
    <div className="blocks">
      {items.map((c) => (
        <div className="block-item" key={c.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontWeight: 700, color: "var(--accent-2)" }}>
              {c.id}
            </span>
            {c.cvss?.severity && (
              <span className="sev" style={severityStyle(c.cvss.severity)}>
                {String(c.cvss.severity).toUpperCase()} {c.cvss.score ?? ""}
              </span>
            )}
            <span className="dim mono" style={{ fontSize: 10, marginLeft: "auto" }}>
              {c.published ? new Date(c.published).toLocaleDateString() : ""}
            </span>
            <a className="mini-btn" href={c.nvd} target="_blank" rel="noreferrer">
              NVD
              <ExternalLink size={10} />
            </a>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, margin: "7px 0 0" }}>{c.description}</p>
          {Array.isArray(c.weaknesses) && c.weaknesses.length > 0 && (
            <div className="chips" style={{ marginTop: 7 }}>
              {c.weaknesses.slice(0, 6).map((w: string) => (
                <span key={w} className="chip violet">
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DnsView({ data }: { data: Record<string, unknown> }) {
  const records = (data.records as Record<string, unknown>[]) || [];
  const rows: { group: string; name: string; ttl: unknown; value: string }[] = [];
  for (const rec of records) {
    const group = String(rec.type || "");
    const answers = (rec.answers as Record<string, unknown>[]) || [];
    if (answers.length === 0) rows.push({ group, name: "—", ttl: "—", value: "no answers" });
    for (const a of answers) {
      rows.push({
        group,
        name: String(a.name ?? ""),
        ttl: a.ttl ?? "—",
        value: String(a.data ?? ""),
      });
    }
  }
  if (rows.length === 0) return <div className="ent-empty">No DNS answers returned.</div>;
  return (
    <div className="dns-table">
      <div className="dns-head">
        <span>record</span>
        <span>name</span>
        <span>ttl</span>
        <span>data</span>
      </div>
      {rows.map((r, i) => (
        <div className="dns-row" key={`${r.name}-${r.value}-${i}`}>
          <span className="dns-type">{i === 0 || rows[i - 1].group !== r.group ? r.group : ""}</span>
          <span className="dns-name">{r.name}</span>
          <span className="dns-ttl">{String(r.ttl)}</span>
          <span className="dns-data">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Body({ item }: { item: FeedItem }) {
  const mod = MODULE_MAP.get(item.moduleId);

  if (item.status === "running") {
    return (
      <div className="skeleton">
        <div className="sk-line" style={{ width: "62%" }} />
        <div className="sk-line" style={{ width: "84%" }} />
        <div className="sk-line" style={{ width: "41%" }} />
        <div className="sk-line" style={{ width: "72%" }} />
      </div>
    );
  }

  if (item.status === "error") {
    const payload = (item.data || {}) as Record<string, unknown>;
    const hint = typeof payload.hint === "string" ? payload.hint : null;
    const needsKey = typeof payload.needsKey === "string" ? payload.needsKey : null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="error-box">
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 600 }}>{item.error || "Request failed"}</div>
            {hint && <div style={{ marginTop: 3, opacity: 0.75 }}>{hint}</div>}
          </div>
        </div>
        {needsKey && (
          <div className="hint-box">
            <KeyRound size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>This module needs an API key. Open Settings, paste it, and run again.</div>
          </div>
        )}
      </div>
    );
  }

  const data = (item.data || {}) as Record<string, unknown>;
  if (mod?.id === "username") return <UsernameView data={data} />;
  if (mod?.id === "dorks") return <DorksView data={data} />;
  if (mod?.id === "cve") return <CveView data={data} />;
  if (mod?.id === "dns") return <DnsView data={data} />;

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "source") continue;
    clean[k] = v;
  }
  return <Value v={clean} />;
}

export function ResultCard({
  item,
  onRetry,
}: {
  item: FeedItem;
  onRetry: (item: FeedItem) => void;
}) {
  const [hidden, setHidden] = useState(false);
  const mod = MODULE_MAP.get(item.moduleId);
  const index = String(MODULES.findIndex((m) => m.id === item.moduleId) + 1).padStart(2, "0");
  const payload = (item.data || {}) as Record<string, unknown>;
  const source = typeof payload.source === "string" && payload.source.startsWith("http") ? payload.source : null;

  const summary = useMemo(() => {
    if (item.status === "running") return "in flight";
    if (item.status === "error") return "stopped";
    if (mod?.id === "username") return `${payload.foundCount ?? 0} profiles`;
    if (mod?.id === "dorks") return `${payload.count ?? 0} queries`;
    if (mod?.id === "cve") return `${payload.total ?? 0} records`;
    if (mod?.id === "dns") return `${payload.total ?? 0} records`;
    if (mod?.id === "crtsh") return `${payload.totalSubdomains ?? 0} hosts`;
    if (mod?.id === "wayback") return `${payload.snapshots ?? 0} snapshots`;
    return "complete";
  }, [item.status, mod?.id, payload]);

  const state = item.status === "running" ? "running" : item.status === "error" ? "failed" : "ok";

  return (
    <article className={`bubble ${item.status}`}>
      <header className="bubble-head">
        <span className="b-index">{index}</span>
        <div className="b-titles">
          <div className="b-name">{mod?.name || item.moduleId}</div>
          <div className="b-sub">
            {item.moduleId} · {item.target} · {summary}
          </div>
        </div>
        <div className="b-meta">
          <span className={`b-state ${state}`}>{state}</span>
          {item.status !== "running" && <span className="dur">{seconds(item.duration)}</span>}
        </div>
      </header>

      {!hidden && (
        <div className="b-body">
          <Body item={item} />
        </div>
      )}

      <footer className="b-foot">
        {source && (
          <a href={source} target="_blank" rel="noreferrer">
            source ↗
          </a>
        )}
        <button
          type="button"
          onClick={async () => {
            const done = await copyText(prettyJson(item.data ?? { error: item.error }));
            toast(done ? "JSON copied" : "Clipboard blocked");
          }}
        >
          copy json
        </button>
        {item.status !== "running" && (
          <button type="button" onClick={() => onRetry(item)}>
            retry
          </button>
        )}
        <span className="spacer" />
        <button type="button" onClick={() => setHidden((v) => !v)}>
          {hidden ? "show" : "hide"}
        </button>
      </footer>
    </article>
  );
}
