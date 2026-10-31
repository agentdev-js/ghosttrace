"use client";

import type { EntitySet } from "@/lib/types";
import { copyText } from "@/lib/utils";
import { toast } from "@/lib/toast";

const GROUPS: { key: keyof EntitySet; label: string }[] = [
  { key: "domains", label: "Domains" },
  { key: "ips", label: "IP addresses" },
  { key: "emails", label: "Emails" },
  { key: "urls", label: "URLs" },
  { key: "hashes", label: "Hashes" },
  { key: "wallets", label: "Wallets" },
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
          <span className="ent-title">Entity index</span>
          <span className="ent-count">{total}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="modal-close ent-close" style={{ margin: 0 }} onClick={onClose} title="Close">
            ×
          </button>
        </div>

        <div className="ent-scroll">
          {total === 0 ? (
            <div className="ent-empty">
              Extracted domains, IPs, emails, URLs, hashes and wallets appear here as results land. Select any value
              to pivot.
            </div>
          ) : (
            GROUPS.map((g) => {
              const list = entities[g.key];
              if (list.length === 0) return null;
              return (
                <div className="ent-group" key={g.key}>
                  <div className="ent-group-title">
                    {g.label}
                    <span className="ent-group-count">{list.length}</span>
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
            copy index
          </button>
          <button type="button" className="mini-btn" onClick={onClose}>
            close
          </button>
        </div>
      </aside>
    </>
  );
}
