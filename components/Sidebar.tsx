"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { CATEGORY_ORDER, MODULES } from "@/lib/modules";
import type { ModuleCategory, ModuleDef } from "@/lib/types";

export function Sidebar({
  enabled,
  onToggle,
  onRunOne,
  onRunAll,
  onClose,
  running,
  runCount,
  open,
}: {
  enabled: Set<string>;
  onToggle: (id: string) => void;
  onRunOne: (mod: ModuleDef) => void;
  onRunAll: () => void;
  onClose: () => void;
  running: number;
  runCount: number;
  open: boolean;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = MODULES.filter(
      (m) => !q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.category.toLowerCase().includes(q),
    );
    const map = new Map<ModuleCategory, ModuleDef[]>();
    for (const cat of CATEGORY_ORDER) {
      const list = filtered.filter((m) => m.category === cat);
      if (list.length) map.set(cat, list);
    }
    return [...map.entries()];
  }, [query]);

  const visible = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-mark">
          <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="19" stroke="#72c7e8" strokeWidth="3" opacity=".45" />
            <circle cx="32" cy="32" r="9" stroke="#a9e2f4" strokeWidth="3" opacity=".8" />
            <circle cx="32" cy="32" r="3" fill="#72c7e8" />
          </svg>
        </div>
        <div>
          <div className="brand-name">GhostTrace</div>
          <div className="brand-tag">OSINT workstation</div>
        </div>
        <span className="brand-version">v2.1</span>
        <button type="button" className="side-close" onClick={onClose} title="Close">
          ×
        </button>
      </div>

      <div className="side-search">
        <span className="side-search-mark">/</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="find a source" spellCheck={false} />
      </div>

      <div className="side-tools">
        <span>{query ? `${visible} matching` : "Sources"}</span>
        <button
          type="button"
          onClick={() => {
            if (enabled.size === MODULES.length) {
              MODULES.forEach((m) => {
                if (enabled.has(m.id)) onToggle(m.id);
              });
            } else {
              MODULES.forEach((m) => {
                if (!enabled.has(m.id)) onToggle(m.id);
              });
            }
          }}
        >
          {enabled.size === MODULES.length ? "none" : "all"}
        </button>
      </div>

      <div className="mod-scroll">
        {groups.map(([cat, list]) => (
          <div key={cat}>
            <div className="cat-label">
              {cat}
              <span className="cat-count">{list.length}</span>
            </div>
            {list.map((mod) => {
              const on = enabled.has(mod.id);
              return (
                <div
                  key={mod.id}
                  className={`mod-row ${on ? "on" : ""}`}
                  role="button"
                  tabIndex={0}
                  title={mod.description}
                  onClick={() => onToggle(mod.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggle(mod.id);
                    }
                  }}
                >
                  <span className="mod-index">{String(MODULES.indexOf(mod) + 1).padStart(2, "0")}</span>
                  <span className="mod-check">{on && <Check size={9} strokeWidth={3.4} />}</span>
                  <span className="mod-name">
                    {mod.name}
                    {mod.needsKey && <span className="mod-key">KEY</span>}
                  </span>
                  <button
                    type="button"
                    className="mod-play"
                    title={`Run ${mod.name} now`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunOne(mod);
                    }}
                  >
                    run
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="side-foot">
        <button type="button" className="run-all" onClick={onRunAll} disabled={runCount === 0}>
          {running > 0 ? `running ${running}…` : `run ${runCount} sources`}
        </button>
        <div className="side-foot-note">keys stay in this browser</div>
      </div>
    </aside>
  );
}
