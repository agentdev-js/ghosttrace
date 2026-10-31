"use client";

import { useEffect, useRef } from "react";
import type { FeedItem } from "@/lib/types";
import { ResultCard } from "./ResultCard";

const EXAMPLES = [
  { value: "example.com", label: "domain" },
  { value: "8.8.8.8", label: "ip" },
  { value: "octocat", label: "handle" },
  { value: "test@example.com", label: "email" },
  { value: "CVE-2024-3094", label: "cve" },
  { value: "00:1A:2B:3C:4D:5E", label: "mac" },
];

export function Feed({
  items,
  running,
  onClear,
  onExport,
  onRetry,
  onExample,
}: {
  items: FeedItem[];
  running: number;
  onClear: () => void;
  onExport: () => void;
  onRetry: (item: FeedItem) => void;
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
        <strong>Investigation log</strong>
        <span>{items.length > 0 ? `${items.length} result${items.length === 1 ? "" : "s"}` : "empty"}</span>
        {running > 0 && (
          <span className="feed-running">
            {running} running
          </span>
        )}
        <span className="line" />
        <button type="button" onClick={onExport} disabled={items.length === 0}>
          export
        </button>
        <button type="button" onClick={onClear} disabled={items.length === 0}>
          clear
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty" style={{ height: "calc(100% - 36px)" }}>
          <h1>No active investigation.</h1>
          <p>
            Enter a target. GhostTrace detects the type, selects every source that accepts it and streams the
            evidence back into this log.
          </p>
          <div className="examples">
            <span className="examples-label">try</span>
            {EXAMPLES.map((e) => (
              <button key={e.value} type="button" className="example" onClick={() => onExample(e.value)}>
                {e.value}
                <span>{e.label}</span>
              </button>
            ))}
          </div>
          <div className="empty-foot">
            19 sources · DNS · RDAP · CT logs · OTX · URLScan · breaches · GitHub · 30 identity sites · dorks
          </div>
        </div>
      ) : (
        <div className="feed-inner">
          {items.map((item) => (
            <ResultCard key={item.id} item={item} onRetry={onRetry} />
          ))}
        </div>
      )}
    </div>
  );
}
