"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, RotateCcw, Save, X } from "lucide-react";
import { KEY_META } from "@/lib/keys";
import type { Keys, KeyName } from "@/lib/types";
import { toast } from "@/lib/toast";

export function SettingsModal({
  keys,
  onKey,
  onClear,
  onClose,
}: {
  keys: Keys;
  onKey: (id: KeyName, value: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const active = Object.values(keys).filter(Boolean).length;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <KeyRound size={16} style={{ color: "var(--accent-2)" }} />
          <div>
            <div className="modal-title">API keys</div>
            <div className="modal-sub">{active} of {KEY_META.length} configured · stored in localStorage only</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="modal-body">
          {KEY_META.map((k) => (
            <div className="field" key={k.id}>
              <label htmlFor={`key-${k.id}`}>
                {k.label}
                <span className="hint">{k.hint}</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id={`key-${k.id}`}
                  className="input"
                  type={visible[k.id] ? "text" : "password"}
                  value={keys[k.id]}
                  placeholder={k.placeholder}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => onKey(k.id, e.target.value.trim())}
                  style={{ paddingRight: 34 }}
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => ({ ...v, [k.id]: !v[k.id] }))}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--faint)",
                    display: "grid",
                    placeItems: "center",
                  }}
                  title={visible[k.id] ? "Hide" : "Show"}
                >
                  {visible[k.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
          ))}

          <div className="hint-box" style={{ marginTop: 4 }}>
            <KeyRound size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              Keys never touch storage on the server. They are attached to a single request, used by that module, and
              discarded. Environment variables set on Vercel take priority when present.
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button
            type="button"
            className="mini-btn"
            onClick={() => {
              onClear();
              toast("Keys cleared");
            }}
          >
            <RotateCcw size={11} />
            Clear all
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="mini-btn accent"
            onClick={() => {
              toast("Saved to this browser");
              onClose();
            }}
          >
            <Save size={11} />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

