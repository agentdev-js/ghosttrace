"use client";

import { useMemo, useState } from "react";
import { Check, Play, Search, X, Zap } from "lucide-react";
import { CATEGORY_ORDER, MODULES } from "@/lib/modules";
import type { ModuleCategory, ModuleDef } from "@/lib/types";
import { MODULE_ICONS } from "./icons";

export function Sidebar({
  enabled,
  onToggle,
  onRunOne,
  onRunAll,
  onClose,
  running,
  open,
}: {
  enabled: Set<string>;
  onToggle: (id: string) => void;
  onRunOne: (mod: ModuleDef) => void;
  onRunAll: () => void;
  onClose: () => void;
  running: number;
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
            <circle cx="32" cy="32" r="19" stroke="#2aabee" strokeWidth="3" opacity=".45" />
            <circle cx="32" cy="32" r="9" stroke="#4cc3ff" strokeWidth="3" opacity=".8" />
            <circle cx="32" cy="32" r="3" fill="#2aabee" />
          </svg>
        </div>
        <div>
          <div className="brand-name">GhostTrace</div>
          <div className="brand-tag">OSINT workstation</div>
        </div>
        <span className="brand-version">v2</span>
        <button type="button" className="side-close" onClick={onClose} title="Close">
          <X size={15} />
        </button>
      </div>

      <div className="side-search">
        <Search size={13} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter modules" spellCheck={false} />
      </div>

      <div className="side-tools">
        <span>{query ? `${visible} matching` : "Modules"}</span>
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
          {enabled.size === MODULES.length ? "clear all" : "arm all"}
        </button>
      </div>

      <div className="mod-scroll">
        {groups.map(([cat, list]) => (
          <div key={cat}>
            <div className="cat-label">{cat}</div>
            {list.map((mod) => {
              const Icon = MODULE_ICONS[mod.icon] || Zap;
              const on = enabled.has(mod.id);
              return (
                <div
                  key={mod.id}
                  className={`mod-row ${on ? "on" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggle(mod.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggle(mod.id);
                    }
                  }}
                >
                  <span className="mod-check">{on && <Check size={10} strokeWidth={3.2} />}</span>
                  <span className="mod-icon">
                    <Icon size={13} />
                  </span>
                  <span className="mod-text">
                    <span className="mod-name">
                      {mod.name}
                      {mod.needsKey && <span className="mod-key">KEY</span>}
                    </span>
                    <span className="mod-desc">{mod.description}</span>
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
                    <Play size={10} fill="currentColor" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="side-foot">
        <button type="button" className="run-all" onClick={onRunAll} disabled={enabled.size === 0}>
          <Zap size={14} />
          {running > 0 ? `Running ${running}…` : `Run ${enabled.size} modules`}
        </button>
        <div className="side-foot-note">Keys stay in this browser. Nothing is logged server-side.</div>
      </div>
    </aside>
  );
}
