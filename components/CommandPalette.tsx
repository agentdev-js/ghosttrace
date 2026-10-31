"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock, Search, Settings2, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { MODULES } from "@/lib/modules";
import type { ModuleDef } from "@/lib/types";
import { detectType, TYPE_LABEL } from "@/lib/detect";
import { MODULE_ICONS } from "./icons";

interface Action {
  id: string;
  label: string;
  hint: string;
  icon: ReactNode;
  group: string;
  run: () => void;
}

export function CommandPalette({
  open,
  target,
  onClose,
  onRunTarget,
  onRunModule,
  onSettings,
  onHistory,
}: {
  open: boolean;
  target: string;
  onClose: () => void;
  onRunTarget: (v: string) => void;
  onRunModule: (mod: ModuleDef, v: string) => void;
  onSettings: () => void;
  onHistory: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const actions = useMemo<Action[]>(() => {
    const q = query.trim();
    const list: Action[] = [];

    if (q) {
      const t = detectType(q);
      list.push({
        id: "target-new",
        label: `Run every module on “${q}”`,
        hint: t === "unknown" ? "unclassified" : TYPE_LABEL[t],
        icon: <Zap size={14} style={{ color: "var(--accent-2)" }} />,
        group: "Target",
        run: () => onRunTarget(q),
      });
    } else if (target.trim()) {
      const t = detectType(target);
      list.push({
        id: "target-current",
        label: `Run every module on “${target.trim()}”`,
        hint: t === "unknown" ? "unclassified" : TYPE_LABEL[t],
        icon: <Zap size={14} style={{ color: "var(--accent-2)" }} />,
        group: "Target",
        run: () => onRunTarget(target.trim()),
      });
    }

    const needle = q.toLowerCase();
    const qType = detectType(q);
    const runValue = target.trim() || (qType !== "unknown" ? q : "");
    const mods = MODULES.filter(
      (m) => !needle || m.name.toLowerCase().includes(needle) || m.description.toLowerCase().includes(needle) || m.category.toLowerCase().includes(needle),
    ).slice(0, 12);

    for (const mod of mods) {
      const Icon = MODULE_ICONS[mod.icon] || Zap;
      list.push({
        id: `mod-${mod.id}`,
        label: mod.name,
        hint: mod.category,
        icon: <Icon size={14} />,
        group: "Modules",
        run: () => onRunModule(mod, runValue),
      });
    }

    if (!q) {
      list.push(
        {
          id: "settings",
          label: "API keys & settings",
          hint: "Settings",
          icon: <Settings2 size={14} />,
          group: "Actions",
          run: onSettings,
        },
        {
          id: "history",
          label: "Recent targets",
          hint: "History",
          icon: <Clock size={14} />,
          group: "Actions",
          run: onHistory,
        },
      );
    }

    return list;
  }, [query, target, onRunTarget, onRunModule, onSettings, onHistory]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const groups = actions.reduce<Record<string, Action[]>>((acc, a) => {
    (acc[a.group] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal palette">
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 16, color: "var(--faint)" }}>
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => (i + 1) % Math.max(actions.length, 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i - 1 + actions.length) % Math.max(actions.length, 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                actions[active]?.run();
                onClose();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search modules or type a target…"
            spellCheck={false}
          />
          <span className="kbd" style={{ marginRight: 14 }}>
            esc
          </span>
        </div>

        <div className="palette-list">
          {Object.entries(groups).map(([group, list]) => (
            <div key={group}>
              <div className="pal-section">{group}</div>
              {list.map((a) => {
                const index = actions.indexOf(a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`pal-item ${index === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      a.run();
                      onClose();
                    }}
                  >
                    {a.icon}
                    <span className="name">{a.label}</span>
                    <span className="desc">{a.hint}</span>
                    <ArrowRight size={12} style={{ color: "var(--faint)" }} />
                  </button>
                );
              })}
            </div>
          ))}
          {actions.length === 0 && <div className="ent-empty" style={{ padding: 14 }}>Nothing matches that query.</div>}
        </div>
      </div>
    </div>
  );
}
