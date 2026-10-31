"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { copyText, fmtDate, fmtNumber, isIsoDate, isUrl } from "@/lib/utils";
import { toast } from "@/lib/toast";

export function CopyBtn({ value, size = 11 }: { value: string; size?: number }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="copy-inline"
      title="Copy"
      onClick={async (e) => {
        e.stopPropagation();
        const done = await copyText(value);
        if (done) {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        } else {
          toast("Clipboard is blocked in this browser");
        }
      }}
    >
      {ok ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}

export function labelOf(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function Chips({ items, tone }: { items: string[]; tone?: string }) {
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? 400 : 70;
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;
  return (
    <div className="chips">
      {shown.map((s, i) => (
        <span key={`${s}-${i}`} className={tone ? `chip ${tone}` : "chip"}>
          {s}
          <CopyBtn value={s} size={10} />
        </span>
      ))}
      {rest > 0 && (
        <button type="button" className="chip neutral" onClick={() => setExpanded(true)}>
          +{rest} more
        </button>
      )}
    </div>
  );
}

function LongString({ s }: { s: string }) {
  const [open, setOpen] = useState(false);
  const cut = 260;
  if (s.length <= cut) return <span className="mono">{s}</span>;
  return (
    <div>
      <div className="mono" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
        {open ? s : `${s.slice(0, cut)}…`}
      </div>
      <button type="button" className="mini-btn" style={{ marginTop: 6 }} onClick={() => setOpen((v) => !v)}>
        {open ? "Collapse" : `Show all ${s.length.toLocaleString()} chars`}
      </button>
    </div>
  );
}

function StringValue({ s }: { s: string }) {
  if (isUrl(s)) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2, maxWidth: "100%" }}>
        <a className="val-link mono" href={s} target="_blank" rel="noreferrer">
          {s.length > 96 ? `${s.slice(0, 96)}…` : s}
          <ExternalLink size={10} />
        </a>
        <CopyBtn value={s} />
      </span>
    );
  }
  if (isIsoDate(s)) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span className="mono" title={s}>
          {fmtDate(s)}
        </span>
        {s.length > 12 && <span className="dim mono" style={{ fontSize: 10 }}>{s.slice(11, 19)}</span>}
        <CopyBtn value={s} />
      </span>
    );
  }
  if (s.length > 120) return <LongString s={s} />;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, maxWidth: "100%" }}>
      <span className="mono">{s}</span>
      {s.length > 10 && <CopyBtn value={s} />}
    </span>
  );
}

function isPrimitiveArray(v: unknown[]): boolean {
  return v.every((x) => typeof x === "string" || typeof x === "number" || typeof x === "boolean");
}

function RecordItem({ item, depth, index }: { item: Record<string, unknown>; depth: number; index: number }) {
  const entries = Object.entries(item).filter(
    ([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
  );
  if (entries.length === 0) return null;
  return (
    <div className="record">
      <span className="record-index">{String(index + 1).padStart(2, "0")}</span>
      <div className="record-grid">
        {entries.map(([k, v]) => {
          const wide = typeof v === "object" && v !== null ? true : typeof v === "string" && v.length > 64;
          return (
            <div key={k} className={wide ? "rec-cell wide" : "rec-cell"}>
              <span className="rec-key">{labelOf(k)}</span>
              <span className="rec-val">
                <Value v={v} depth={depth + 1} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Value({ v, depth = 0 }: { v: unknown; depth?: number }) {
  if (v === null || v === undefined) return <span className="null">null</span>;
  if (typeof v === "boolean") return <span className={v ? "bool-t" : "bool-f"}>{String(v)}</span>;
  if (typeof v === "number") return <span className="num">{Number.isFinite(v) ? fmtNumber(v) : String(v)}</span>;
  if (typeof v === "string") return <StringValue s={v} />;

  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="null">empty</span>;
    if (v.every((x) => typeof x === "string")) return <Chips items={v as string[]} />;
    if (isPrimitiveArray(v)) {
      return (
        <div className="chips">
          {v.slice(0, 80).map((x, i) => (
            <span key={i} className="chip neutral">
              {String(x)}
            </span>
          ))}
        </div>
      );
    }
    const items = v.slice(0, 30);
    if (items.every((x) => x !== null && typeof x === "object" && !Array.isArray(x))) {
      return (
        <div className="records">
          {items.map((x, i) => (
            <RecordItem key={i} item={x as Record<string, unknown>} depth={depth} index={i} />
          ))}
          {v.length > 30 && <span className="dim mono" style={{ fontSize: 10 }}>+{v.length - 30} more entries</span>}
        </div>
      );
    }
    return (
      <div className="blocks">
        {items.map((x, i) => (
          <div key={i} className="block-item">
            <Value v={x} depth={depth + 1} />
          </div>
        ))}
        {v.length > 30 && <span className="dim mono" style={{ fontSize: 10 }}>+{v.length - 30} more entries</span>}
      </div>
    );
  }

  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 0) return <span className="null">empty</span>;
    if (depth > 4) return <span className="null">nested object</span>;
    return (
      <div className="kv">
        {keys.map((k) => (
          <div className="kv-row" key={k}>
            <div className="kv-key">{labelOf(k)}</div>
            <div className="kv-val">
              <Value v={o[k]} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="mono">{String(v)}</span>;
}

export function KeyValue({ data }: { data: Record<string, unknown> }) {
  return <Value v={data} />;
}
