"use client";

import type { RefObject } from "react";
import { Command, KeyRound, Loader2, Search, Settings2, Trash2, Zap } from "lucide-react";
import type { TargetType } from "@/lib/types";
import { TYPE_LABEL } from "@/lib/detect";

const TYPE_ICON: Record<string, string> = {
  domain: "◈",
  ip: "▣",
  email: "✉",
  username: "◉",
  phone: "☏",
  btc: "₿",
  eth: "Ξ",
  cve: "⚠",
  hash: "#",
  package: "▤",
  mac: "⌗",
  url: "↗",
  unknown: "?",
};

export function TargetBar({
  value,
  onChange,
  type,
  onRunAll,
  onClear,
  running,
  armed,
  locked,
  inputRef,
  onPalette,
  onSettings,
}: {
  value: string;
  onChange: (v: string) => void;
  type: TargetType;
  onRunAll: () => void;
  onClear: () => void;
  running: number;
  armed: number;
  locked: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onPalette: () => void;
  onSettings: () => void;
}) {
  const has = value.trim().length > 0;
  const known = type !== "unknown";

  return (
    <div className="target-wrap">
      <div className="target-row">
        <div className="target-box">
          <span className="target-icon" style={{ fontSize: 15, fontFamily: "var(--mono)" }}>
            {TYPE_ICON[type] || "◇"}
          </span>
          <input
            ref={inputRef}
            className="target-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onRunAll();
              }
            }}
            placeholder="domain, ip, email, handle, phone, wallet, mac, cve…"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
          />
          <span className={`type-badge ${has ? (known ? "live" : "bad") : ""}`}>
            {has ? (known ? TYPE_LABEL[type] : "Unknown") : "Auto"}
          </span>
        </div>

        <button type="button" className="tb-btn primary" onClick={onRunAll} disabled={!has || armed === 0}>
          {running > 0 ? <Loader2 size={15} className="spin" /> : <Zap size={15} />}
          {running > 0 ? `${running} running` : `Run ${armed}`}
        </button>

        <button type="button" className="tb-btn ghost tb-icon" title="Command palette" onClick={onPalette}>
          <Command size={15} />
        </button>

        <button type="button" className="tb-btn ghost tb-icon" title="Clear target" onClick={onClear} disabled={!has}>
          <Trash2 size={15} />
        </button>

        <button type="button" className="tb-btn ghost tb-icon" title="API keys" onClick={onSettings}>
          <Settings2 size={15} />
        </button>
      </div>

      <div className="target-hint">
        <span>
          <span className="kbd">⌘K</span> palette
        </span>
        <span>
          <span className="kbd">Enter</span> run all armed modules
        </span>
        <span>
          <span className="kbd">/</span> focus
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Search size={9} />
          {armed} of 19 modules armed
        </span>
        {locked > 0 && (
          <button type="button" className="hint-key" onClick={onSettings} title="Modules waiting for an API key">
            <KeyRound size={9} />
            {locked} need {locked === 1 ? "a key" : "keys"}
          </button>
        )}
      </div>
    </div>
  );
}
