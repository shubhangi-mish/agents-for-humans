import { Persona } from "@/lib/personas";
import { theme } from "@/lib/theme";

export default function ProfileCard({ persona, compact }: { persona: Persona; compact?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: compact ? "4px 4px 4px 4px" : "6px 12px 6px 6px",
        background: compact ? "transparent" : theme.panel,
        border: compact ? "none" : `1px solid ${theme.border}`,
        borderRadius: 999,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: theme.accentSoft,
          border: `1px solid ${theme.accent}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: theme.accent,
          flexShrink: 0,
        }}
      >
        {persona.initials}
      </div>
      <div style={{ minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.textPrimary, whiteSpace: "nowrap" }}>{persona.name}</div>
        <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {persona.role}
        </div>
      </div>
    </div>
  );
}
