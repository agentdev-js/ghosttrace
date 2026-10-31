"use client";

import { Copy, Fingerprint, X } from "lucide-react";
import type { EntitySet } from "@/lib/types";
import { copyText } from "@/lib/utils";
import { toast } from "@/lib/toast";

const GROUPS: { key: keyof EntitySet; label: string; color: string }[] = [
  { key: "domains", label: "Domains", color: "#4cc3ff" },
  { key: "ips", label: "IP addresses", color: "#3ddc97" },
  { key: "emails", label: "Emails", color: "#9b7bff" },
  { key: "urls", label: "URLs", color: "#ffb340" },
  { key: "hashes", label: "Hashes", color: "#ff7ab8" },
  { key: "wallets", label: "Wallets", color: "#ff8a5c" },
];

export function EntityPanel({
  entities,
  open,
  onPick,
  onClose,
}: {
  entities: EntitySet;
  open: boolean;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const total = GROUPS.reduce((n, g) => n + entities[g.key].length, 0);
  const all = GROUPS.flatMap((g) => entities[g.key]);

  return (
    <>
      {open && <div className="drawer-backdrop ent-backdrop" onClick={onClose} />}
      <aside className={`entities ${open ? "open" : ""}`}>
        <div className="ent-head">
          <Fingerprint size={14} style={{ color: "var(--accent-2)" }} />
          <span className="ent-title">Entities</span>
          <span className="ent-count">{total}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="modal-close ent-close" style={{ margin: 0 }} onClick={onClose} title="Close">
            <X size={14} />
          </button>
        </div>

        <div className="ent-scroll">
          {total === 0 ? (
            <div className="ent-empty">
              Extracted domains, IPs, emails, URLs, hashes and wallets will collect here as results land. Click one to
              pivot.
            </div>
          ) : (
            GROUPS.map((g) => {
              const list = entities[g.key];
              if (list.length === 0) return null;
              return (
                <div className="ent-group" key={g.key}>
                  <div className="ent-group-title">
                    <span className="site-dot" style={{ background: g.color }} />
                    {g.label}
                    <span style={{ marginLeft: "auto", color: "var(--faint)" }}>{list.length}</span>
                  </div>
                  {list.map((v) => (
                    <button key={v} type="button" className="ent-item" title={`Pivot to ${v}`} onClick={() => onPick(v)}>
                      {v}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>

        <div className="ent-foot">
          <button
            type="button"
            className="mini-btn"
            disabled={total === 0}
            onClick={async () => {
              const done = await copyText(all.join("\n"));
              toast(done ? `Copied ${all.length} entities` : "Clipboard blocked");
            }}
          >
            <Copy size={10} />
            Copy all
          </button>
          <button type="button" className="mini-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
