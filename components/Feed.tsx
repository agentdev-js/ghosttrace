"use client";

import { useEffect, useRef } from "react";
import { Download, Loader2, Trash2, Zap } from "lucide-react";
import type { FeedItem } from "@/lib/types";
import { ResultCard } from "./ResultCard";

const EXAMPLES = [
  { value: "example.com", label: "domain" },
  { value: "8.8.8.8", label: "ip" },
  { value: "octocat", label: "username" },
  { value: "CVE-2024-3094", label: "cve" },
  { value: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", label: "btc" },
  { value: "00:1A:2B:3C:4D:5E", label: "mac" },
];

export function Feed({
  items,
  running,
  onClear,
  onExport,
  onRetry,
  onSettings,
  onExample,
}: {
  items: FeedItem[];
  running: number;
  onClear: () => void;
  onExport: () => void;
  onRetry: (item: FeedItem) => void;
  onSettings: () => void;
  onExample: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  return (
    <div
      className="feed"
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      }}
    >
      <div className="feed-head">
        <strong>Activity</strong>
        <span>{items.length > 0 ? `${items.length} result${items.length === 1 ? "" : "s"}` : "standby"}</span>
        {running > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--amber)" }}>
            <Loader2 size={10} className="spin" />
            {running} running
          </span>
        )}
        <span className="line" />
        <button type="button" title="Export JSON" onClick={onExport} disabled={items.length === 0}>
          <Download size={13} />
        </button>
        <button type="button" title="Clear feed" onClick={onClear} disabled={items.length === 0}>
          <Trash2 size={13} />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty" style={{ height: "calc(100% - 36px)" }}>
          <div className="empty-mark">
            <svg width="38" height="38" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="20" stroke="#2aabee" strokeWidth="2.5" opacity=".25" />
              <circle cx="32" cy="32" r="12" stroke="#4cc3ff" strokeWidth="2.5" opacity=".55" />
              <circle cx="32" cy="32" r="3.5" fill="#2aabee" />
              <path d="M32 2v8M32 54v8M2 32h8M54 32h8" stroke="#9b7bff" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
            </svg>
          </div>
          <h1>Follow the signal.</h1>
          <p>
            Drop a domain, IP, email, handle, phone number, wallet, MAC or CVE. GhostTrace fans it out across every
            compatible source and streams the findings back in one feed.
          </p>
          <div className="examples">
            {EXAMPLES.map((e) => (
              <button key={e.value} type="button" className="example" onClick={() => onExample(e.value)}>
                <Zap size={10} style={{ color: "var(--accent)" }} />
                {e.value}
                <span style={{ color: "var(--faint)", fontSize: 9 }}>{e.label}</span>
              </button>
            ))}
          </div>
          <div className="empty-meta">
            <span>
              <span className="site-dot" style={{ background: "var(--green)" }} />
              19 modules
            </span>
            <span>
              <span className="site-dot" style={{ background: "var(--accent)" }} />
              14 keyless sources
            </span>
            <span>
              <span className="site-dot" style={{ background: "var(--violet)" }} />
              zero server storage
            </span>
          </div>
        </div>
      ) : (
        <div className="feed-inner">
          {items.map((item) => (
            <ResultCard key={item.id} item={item} onRetry={onRetry} onSettings={onSettings} />
          ))}
        </div>
      )}
    </div>
  );
}
