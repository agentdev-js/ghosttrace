"use client";

import { Command, Fingerprint, History, Radar, Settings2 } from "lucide-react";

function GithubMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export function Rail({
  entitiesOpen,
  onEntities,
  onHistory,
  onSettings,
  onPalette,
  onTop,
}: {
  entitiesOpen: boolean;
  onEntities: () => void;
  onHistory: () => void;
  onSettings: () => void;
  onPalette: () => void;
  onTop: () => void;
}) {
  return (
    <nav className="rail">
      <button type="button" className="rail-logo" onClick={onTop} title="GhostTrace">
        <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="19" stroke="#72c7e8" strokeWidth="3" opacity=".45" />
          <circle cx="32" cy="32" r="9" stroke="#a9e2f4" strokeWidth="3" opacity=".85" />
          <circle cx="32" cy="32" r="3" fill="#72c7e8" />
          <path d="M32 3v7M32 54v7M3 32h7M54 32h7" stroke="#697684" strokeWidth="3" strokeLinecap="round" opacity=".8" />
        </svg>
      </button>

      <button type="button" className="rail-btn active" title="Console" onClick={onTop}>
        <Radar size={17} />
        <span className="rail-label">console</span>
      </button>
      <button type="button" className="rail-btn" title="History" onClick={onHistory}>
        <History size={17} />
        <span className="rail-label">history</span>
      </button>
      <button type="button" className={`rail-btn ${entitiesOpen ? "active" : ""}`} title="Entities" onClick={onEntities}>
        <Fingerprint size={17} />
        <span className="rail-label">index</span>
      </button>
      <button type="button" className="rail-btn" title="Palette" onClick={onPalette}>
        <Command size={17} />
        <span className="rail-label">search</span>
      </button>

      <span className="rail-spacer" />

      <button type="button" className="rail-btn" title="Settings" onClick={onSettings}>
        <Settings2 size={17} />
        <span className="rail-label">keys</span>
      </button>
      <a className="rail-btn" title="GitHub" href="https://github.com/agentdev-js" target="_blank" rel="noreferrer">
        <GithubMark size={16} />
        <span className="rail-label">github</span>
      </a>
    </nav>
  );
}
