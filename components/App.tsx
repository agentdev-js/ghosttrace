"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Settings2 } from "lucide-react";
import { MODULES, MODULE_MAP } from "@/lib/modules";
import { detectType, normalizeTarget, TYPE_LABEL } from "@/lib/detect";
import { EMPTY_KEYS, keyHeaders, loadKeys, saveKeys } from "@/lib/keys";
import { extractEntities } from "@/lib/entities";
import type { FeedItem, HistoryEntry, Keys, KeyName, ModuleDef, TargetType } from "@/lib/types";
import { prettyJson } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { Rail } from "./Rail";
import { Sidebar } from "./Sidebar";
import { TargetBar } from "./TargetBar";
import { Feed } from "./Feed";
import { EntityPanel } from "./EntityPanel";
import { SettingsModal } from "./SettingsModal";
import { HistoryModal } from "./HistoryModal";
import { CommandPalette } from "./CommandPalette";
import { Toaster } from "./Toaster";

const ENABLED_KEY = "ghosttrace.enabled";
const HISTORY_KEY = "ghosttrace.history";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function callModule(mod: ModuleDef, value: string, type: TargetType, keys: Keys) {
  const params = new URLSearchParams({ q: value });
  if (mod.id === "dorks") params.set("type", type);
  const res = await fetch(`${mod.endpoint}?${params.toString()}`, {
    headers: keyHeaders(keys),
    cache: "no-store",
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = { error: `HTTP ${res.status}` };
  }
  if (!res.ok) {
    const p = payload as { error?: string };
    const err = new Error(p?.error || `HTTP ${res.status}`) as Error & { payload?: unknown };
    err.payload = payload;
    throw err;
  }
  return payload;
}

export function App() {
  const [target, setTarget] = useState("");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [running, setRunning] = useState(0);
  const [enabled, setEnabled] = useState<Set<string>>(new Set(MODULES.map((m) => m.id)));
  const [keys, setKeys] = useState<Keys>(EMPTY_KEYS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [entitiesOpen, setEntitiesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setKeys(loadKeys());
    try {
      const rawEnabled = window.localStorage.getItem(ENABLED_KEY);
      if (rawEnabled) {
        const arr = JSON.parse(rawEnabled) as string[];
        setEnabled(new Set(arr.filter((id) => MODULE_MAP.has(id))));
      }
      const rawHistory = window.localStorage.getItem(HISTORY_KEY);
      if (rawHistory) setHistory(JSON.parse(rawHistory) as HistoryEntry[]);
    } catch {
      setEnabled(new Set(MODULES.map((m) => m.id)));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(ENABLED_KEY, JSON.stringify([...enabled]));
  }, [enabled, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history, hydrated]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setSettingsOpen(false);
        setHistoryOpen(false);
        setSidebarOpen(false);
        setEntitiesOpen(false);
        return;
      }
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (!typing && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const type = useMemo(() => detectType(target), [target]);

  const ready = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const m of MODULES) map.set(m.id, !m.needsKey || Boolean(keys[m.needsKey]));
    return map;
  }, [keys]);

  const armed = useMemo(
    () =>
      MODULES.filter(
        (m) => enabled.has(m.id) && type !== "unknown" && m.accepts.includes(type) && ready.get(m.id),
      ).length,
    [enabled, type, ready],
  );

  const entities = useMemo(
    () => extractEntities(items.filter((i) => i.status === "done").map((i) => i.data)),
    [items],
  );

  function updateKey(id: KeyName, value: string) {
    setKeys((prev) => {
      const next = { ...prev, [id]: value };
      saveKeys(next);
      return next;
    });
  }

  function pushHistory(value: string, t: TargetType) {
    setHistory((prev) =>
      [{ target: value, type: t, at: Date.now() }, ...prev.filter((h) => h.target !== value)].slice(0, 60),
    );
  }

  function runModules(mods: ModuleDef[], rawTarget: string, t: TargetType) {
    const value = normalizeTarget(rawTarget, t);
    if (!value || mods.length === 0) return;

    pushHistory(value, t);

    const batch: FeedItem[] = mods.map((m) => ({
      id: uid(),
      moduleId: m.id,
      target: value,
      status: "running",
      startedAt: Date.now(),
    }));

    setItems((prev) => [...prev, ...batch]);
    setRunning((n) => n + batch.length);

    for (const item of batch) {
      const mod = MODULE_MAP.get(item.moduleId);
      if (!mod) continue;
      callModule(mod, value, t, keys)
        .then((data) => {
          setItems((prev) =>
            prev.map((x) =>
              x.id === item.id ? { ...x, status: "done" as const, data, duration: Date.now() - item.startedAt } : x,
            ),
          );
        })
        .catch((err: Error & { payload?: unknown }) => {
          setItems((prev) =>
            prev.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    status: "error" as const,
                    error: err.message,
                    data: err.payload ?? null,
                    duration: Date.now() - item.startedAt,
                  }
                : x,
            ),
          );
        })
        .finally(() => setRunning((n) => Math.max(0, n - 1)));
    }
  }

  function runAllFrom(raw?: string) {
    const value = (raw ?? target).trim();
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    const t = detectType(value);
    if (t === "unknown") {
      toast("Can't classify that target");
      return;
    }
    const mods = MODULES.filter((m) => enabled.has(m.id) && m.accepts.includes(t) && ready.get(m.id));
    if (mods.length === 0) {
      toast(`No armed module accepts ${TYPE_LABEL[t].toLowerCase()}`);
      return;
    }
    runModules(mods, value, t);
  }

  function runOne(mod: ModuleDef, raw?: string) {
    const value = (raw ?? target).trim();
    if (!value) {
      toast("Enter a target first");
      inputRef.current?.focus();
      return;
    }
    const t = detectType(value);
    if (t === "unknown") {
      toast("Can't classify that target");
      return;
    }
    runModules([mod], value, t);
  }

  function retryItem(item: FeedItem) {
    const mod = MODULE_MAP.get(item.moduleId);
    if (!mod) return;
    const t = detectType(item.target);
    runModules([mod], item.target, t === "unknown" ? type : t);
  }

  function pickEntity(value: string) {
    setTarget(value);
    setEntitiesOpen(false);
    const t = detectType(value);
    if (t === "unknown") {
      toast("Picked, but the type is unclear");
      inputRef.current?.focus();
      return;
    }
    const mods = MODULES.filter((m) => enabled.has(m.id) && m.accepts.includes(t) && ready.get(m.id));
    if (mods.length === 0) {
      toast(`No armed module accepts ${TYPE_LABEL[t].toLowerCase()}`);
      return;
    }
    runModules(mods, value, t);
  }

  function exportFeed() {
    const payload = items.map((i) => ({
      module: i.moduleId,
      target: i.target,
      status: i.status,
      durationMs: i.duration ?? null,
      error: i.error ?? null,
      data: i.data ?? null,
    }));
    const blob = new Blob([prettyJson({ exportedAt: new Date().toISOString(), results: payload })], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ghosttrace-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Feed exported");
  }

  return (
    <div className="shell">
      <Rail
        entitiesOpen={entitiesOpen}
        onEntities={() => setEntitiesOpen((v) => !v)}
        onHistory={() => setHistoryOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onPalette={() => setPaletteOpen(true)}
        onTop={() => {
          inputRef.current?.focus();
          document.querySelector(".feed")?.scrollTo({ top: 0 });
        }}
      />

      {sidebarOpen && <div className="drawer-backdrop side-backdrop" onClick={() => setSidebarOpen(false)} />}

      <Sidebar
        enabled={enabled}
        open={sidebarOpen}
        running={running}
        runCount={armed}
        onToggle={(id) =>
          setEnabled((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onRunOne={(mod) => {
          runOne(mod);
          setSidebarOpen(false);
        }}
        onRunAll={() => {
          runAllFrom();
          setSidebarOpen(false);
        }}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main">
        <div className="mobile-bar">
          <button type="button" className="rail-btn" onClick={() => setSidebarOpen(true)} title="Modules">
            <Menu size={18} />
          </button>
          <div className="brand-name" style={{ fontSize: 13 }}>
            GhostTrace
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" className="rail-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            <Settings2 size={16} />
          </button>
        </div>

        <div className="workspace-bar">
          <div className="ws-left">
            <span className="ws-path">GhostTrace</span>
            <span className="ws-sep">/</span>
            <span className="ws-target">{target.trim() || "no target"}</span>
          </div>
          <div className="ws-right">
            <span className="ws-meta">{items.length} results</span>
            <span className={`ws-state ${running > 0 ? "live" : ""}`}>
              {running > 0 ? `${running} running` : "idle"}
            </span>
          </div>
        </div>

        <TargetBar
          value={target}
          onChange={setTarget}
          type={type}
          onRunAll={() => runAllFrom()}
          onClear={() => {
            setTarget("");
            inputRef.current?.focus();
          }}
          running={running}
          armed={armed}
          inputRef={inputRef}
        />

        <Feed
          items={items}
          running={running}
          onClear={() => setItems([])}
          onExport={exportFeed}
          onRetry={retryItem}
          onExample={(v) => {
            setTarget(v);
            runAllFrom(v);
          }}
        />
      </main>

      <EntityPanel
        entities={entities}
        open={entitiesOpen}
        onPick={pickEntity}
        onClose={() => setEntitiesOpen(false)}
      />

      {settingsOpen && (
        <SettingsModal
          keys={keys}
          onKey={updateKey}
          onClear={() => {
            setKeys(EMPTY_KEYS);
            saveKeys(EMPTY_KEYS);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {historyOpen && (
        <HistoryModal
          history={history}
          onPick={(v) => {
            setHistoryOpen(false);
            setTarget(v);
            runAllFrom(v);
          }}
          onClear={() => setHistory([])}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        target={target}
        onClose={() => setPaletteOpen(false)}
        onRunTarget={(v) => {
          setTarget(v);
          runAllFrom(v);
        }}
        onRunModule={(mod, v) => runOne(mod, v)}
        onSettings={() => setSettingsOpen(true)}
        onHistory={() => setHistoryOpen(true)}
      />

      <Toaster />
    </div>
  );
}
