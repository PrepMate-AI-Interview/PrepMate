// ==========================================
// PREPMATE — MEETING VECTOR SVG ICONS
// ARCHITECTURE: HUD PRESENTATION ASSETS
// ==========================================

const ZOOM_ICONS = {
  micOn: `<svg class="zoom-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
    <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="8" y1="22" x2="16" y2="22"/>
  </svg>`,

  micMuted: `<svg class="zoom-svg-icon zoom-svg-muted" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" stroke-width="2.5"/>
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 11v-1"/>
    <path d="M5 10v1a7 7 0 0 0 11.37 5.5"/>
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
    <path d="M9 9v2a3 3 0 0 0 5.12 2.12"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="8" y1="22" x2="16" y2="22"/>
  </svg>`,

  camOn: `<svg class="zoom-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M23 7l-7 5 7 5V7z"/>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>`,

  camMuted: `<svg class="zoom-svg-icon zoom-svg-muted" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" stroke-width="2.5"/>
    <path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m4 0h4a2 2 0 0 1 2 2v3.5l7-5v11l-3.5-2.5"/>
  </svg>`,

  speakerOn: `<svg class="zoom-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>`,

  speakerMuted: `<svg class="zoom-svg-icon zoom-svg-muted" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" stroke-width="2.5"/>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
  </svg>`,

  nameplateMicMuted: `<svg class="zoom-nameplate-svg-red" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" stroke-width="2.6"/>
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 11v-1"/>
    <path d="M5 10v1a7 7 0 0 0 11.37 5.5"/>
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
    <path d="M9 9v2a3 3 0 0 0 5.12 2.12"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="8" y1="22" x2="16" y2="22"/>
  </svg>`,

  nameplateMicLive: `<svg class="zoom-nameplate-svg-live" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22c55e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
    <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="8" y1="22" x2="16" y2="22"/>
  </svg>`,
};

if (typeof window !== "undefined") {
  window.ZOOM_ICONS = ZOOM_ICONS;
}
