import type { CSSProperties } from "react";

/** Shared design tokens. Cool, muted, enterprise-console palette — slate
 * background, blue/cyan accent, no gold/tricolor/emoji-illustration
 * elements. Referenced by every component instead of scattering hex
 * literals so the look stays consistent as the app grows. */
export const theme = {
  bg: "#0a0d12",
  bgElevated: "#10141b",
  panel: "#12161e",
  panelAlt: "#161b24",
  border: "#232a36",
  borderStrong: "#2d3546",

  textPrimary: "#e6e9ef",
  textSecondary: "#9aa4b2",
  textMuted: "#5b6472",

  accent: "#4c8dff",
  accentDim: "#4c8dff33",
  accentSoft: "#1c2b4a",

  statusActive: "#4c8dff",
  statusAwaiting: "#d99a3f",
  statusResolved: "#2fb787",
  statusFailed: "#e0654d",
  statusNews: "#6b7684",

  kindFire: "#e0654d",
  kindCollapse: "#d99a3f",
  kindFlood: "#4c8dff",
  kindCrime: "#9d7ae0",
  kindAccident: "#d9853f",
  kindOther: "#6b7684",
} as const;

/** A subtle dot-grid texture for page backgrounds — the modern-console look
 * (see e.g. dashboard/landing sites with a faint dotted field behind
 * content) instead of a flat, dull background. Cheap: two radial gradients
 * repeated as a background-image, no image asset. */
export const dotGridBackground: CSSProperties = {
  backgroundColor: theme.bg,
  backgroundImage: `radial-gradient(${theme.borderStrong} 1px, transparent 1px)`,
  backgroundSize: "28px 28px",
};

export const STATUS_LABEL: Record<string, string> = {
  active: "In progress",
  paused_for_approval: "Awaiting approval",
  resolved: "Resolved",
};

export const STATUS_COLOR: Record<string, string> = {
  active: theme.statusActive,
  paused_for_approval: theme.statusAwaiting,
  resolved: theme.statusResolved,
};
