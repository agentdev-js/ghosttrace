"use client";

import { Clock, Play, Trash2, X } from "lucide-react";
import type { HistoryEntry } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

const TYPE_COLOR: Record<string, string> = {
  domain: "#4cc3ff",
  ip: "#3ddc97",
  email: "#9b7bff",
  username: "#ff7ab8",
  phone: "#ffb340",
  btc: "#ff8a5c",
  eth: "#8fa0ff",
  cve: "#ff5d5d",
  hash: "#ff7ab8",
  mac: "#ffb340",
  package: "#3ddc97",
  url: "#4cc3ff",
  unknown: "#5d7182",
};

export function HistoryModal({
  history,
  onPick,
  onClear,
  onClose,
}: {
  history: HistoryEntry[];
  onPick: (v: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <Clock size={16} style={{ color: "var(--accent-2)" }} />
          <div>
            <div className="modal-title">Recent targets</div>
            <div className="modal-sub">{history.length} stored locally</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "8px 10px" }}>
          {history.length === 0 ? (
            <div className="ent-empty" style={{ padding: 14 }}>
              Every target you run is remembered here for quick pivots.
            </div>
          ) : (
            history.map((h) => (
              <div className="hist-row" key={`${h.target}-${h.at}`}>
                <span className="site-dot" style={{ background: TYPE_COLOR[h.type] || "#5d7182" }} />
                <span className="hist-target">{h.target}</span>
                <span className="hist-time">{timeAgo(h.at)}</span>
                <button type="button" className="mini-btn accent" onClick={() => onPick(h.target)}>
                  <Play size={9} fill="currentColor" />
                  Run
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-foot">
          <button
            type="button"
            className="mini-btn"
            onClick={() => {
              onClear();
              onClose();
            }}
            disabled={history.length === 0}
          >
            <Trash2 size={11} />
            Clear history
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="mini-btn accent" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
