import { Persona } from "@/lib/personas";
import { theme } from "@/lib/theme";
import ProfileCard from "./ProfileCard";

function navLinkStyle(active: boolean): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: active ? theme.textPrimary : theme.textMuted,
    padding: 0,
    fontFamily: "inherit",
  };
}

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.2, minWidth: 34 }}>
      <span style={{ fontSize: 15, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 8.5, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}

export type NavLink = "map" | "audit";

/** The app's real top-level header — identity (wordmark + tagline),
 * navigation, live city-wide stats, and the signed-in persona's profile
 * card, all in one bar instead of a floating widget stacked on the map. */
export default function NavBar({
  persona,
  activeLink,
  onNavigate,
  stats,
}: {
  persona: Persona;
  activeLink: NavLink;
  onNavigate: (link: NavLink) => void;
  stats: { active: number; resolved: number; officesEngaged: number };
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 28px",
        borderBottom: `1px solid ${theme.border}`,
        background: `${theme.bg}f5`,
        backdropFilter: "blur(8px)",
        position: "relative",
        zIndex: 20,
        gap: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: theme.accentSoft,
              border: `1px solid ${theme.accent}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: theme.accent,
              flexShrink: 0,
            }}
          >
            G
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: theme.textPrimary }}>GovOS</span>
        </div>
        <div style={{ width: 1, height: 20, background: theme.border, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: theme.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Autonomous incident command — Delhi
        </span>
      </div>

      <nav style={{ display: "flex", alignItems: "center", gap: 28, flexShrink: 0 }}>
        <button onClick={() => onNavigate("map")} style={navLinkStyle(activeLink === "map")}>
          Live Map
        </button>
        <button onClick={() => onNavigate("audit")} style={navLinkStyle(activeLink === "audit")}>
          Audit Log
        </button>

        <div style={{ display: "flex", gap: 18, paddingLeft: 14, borderLeft: `1px solid ${theme.border}` }}>
          <StatMini label="Active" value={stats.active} color={theme.statusActive} />
          <StatMini label="Resolved" value={stats.resolved} color={theme.statusResolved} />
          <StatMini label="Offices" value={stats.officesEngaged} color={theme.accent} />
        </div>

        <div style={{ paddingLeft: 4 }}>
          <ProfileCard persona={persona} />
        </div>
      </nav>
    </header>
  );
}
