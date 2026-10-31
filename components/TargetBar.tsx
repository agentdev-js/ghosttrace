"use client";

import type { RefObject } from "react";
import { Loader2 } from "lucide-react";
import type { TargetType } from "@/lib/types";
import { TYPE_LABEL } from "@/lib/detect";

export function TargetBar({
  value,
  onChange,
  type,
  onRunAll,
  onClear,
  running,
  armed,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  type: TargetType;
  onRunAll: () => void;
  onClear: () => void;
  running: number;
  armed: number;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const has = value.trim().length > 0;
  const known = type !== "unknown";

  return (
    <div className="target-wrap">
      <div className="target-row">
        <div className="target-box">
          <span className="target-prompt">&gt;</span>
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
            placeholder="domain · ip · email · handle · name · phone · wallet · mac · cve"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
          />
          {has && (
            <button type="button" className="target-clear" onClick={onClear} title="Clear target">
              ×
            </button>
          )}
          <span className={`type-badge ${has ? (known ? "live" : "bad") : ""}`}>
            {has ? (known ? TYPE_LABEL[type] : "Unknown") : "Any"}
          </span>
        </div>

        <button type="button" className="tb-btn primary" onClick={onRunAll} disabled={!has || armed === 0}>
          {running > 0 ? <Loader2 size={13} className="spin" /> : null}
          {running > 0 ? `${running} running` : `Run ${armed}`}
        </button>
      </div>

      <div className="target-hint">
        <span>{has && known ? `${armed} sources accept ${TYPE_LABEL[type].toLowerCase()}` : "target type is detected as you type"}</span>
        <span className="target-hint-right">
          {has ? "press ↵ to dispatch" : "queries are proxied, not stored"}
        </span>
      </div>
    </div>
  );
}
