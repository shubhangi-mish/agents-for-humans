import { Fragment } from "react";
import { Incident } from "@/lib/types";
import { buildGraph } from "@/lib/graph";
import { STATUS_COLOR, STATUS_LABEL, theme } from "@/lib/theme";

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function highestAuthority(incident: Incident): string {
  const tiers = incident.approvals.map((a) => a.authority_tier).filter(Boolean) as string[];
  if (tiers.some((t) => t.includes("DDMA"))) return "DDMA";
  if (tiers.some((t) => t.includes("Police Commissioner"))) return "Police Commissioner";
  if (tiers.some((t) => t.includes("District Magistrate"))) return "District Magistrate";
  return "Field level";
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: "20px 22px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: theme.textPrimary, letterSpacing: -0.8, lineHeight: 1.05 }}>
        {value}
      </div>
    </div>
  );
}

const PHASES: { id: string; label: string; match: (i: Incident) => boolean }[] = [
  { id: "triggered", label: "Triggered", match: () => true },
  {
    id: "assessed",
    label: "Situation Assessed",
    match: (i) => i.events.some((e) => e.agent === "intel_agent" && e.kind === "reasoning"),
  },
  {
    id: "dispatched",
    label: "Resources Dispatched",
    match: (i) => i.events.some((e) => e.kind === "task_created"),
  },
  {
    id: "authorized",
    label: "Authorized",
    match: (i) => i.tasks.some((t) => t.status === "in_progress" || t.status === "completed"),
  },
  { id: "resolved", label: "Resolved", match: (i) => i.status === "resolved" },
];

function PhaseTimeline({ incident }: { incident: Incident }) {
  const reached = PHASES.map((p) => p.match(incident));
  const lastReachedIdx = reached.lastIndexOf(true);

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {PHASES.map((phase, i) => {
        const done = i <= lastReachedIdx;
        const isCurrent = i === lastReachedIdx && incident.status !== "resolved";
        return (
          <Fragment key={phase.id}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 96, flexShrink: 0 }}>
              <div
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  background: done ? theme.accent : theme.bgElevated,
                  border: `2px solid ${done ? theme.accent : theme.border}`,
                  boxShadow: isCurrent ? `0 0 0 4px ${theme.accentDim}` : "none",
                }}
              />
              <div
                style={{
                  fontSize: 10.5,
                  color: done ? theme.textSecondary : theme.textMuted,
                  textAlign: "center",
                  lineHeight: 1.3,
                  fontWeight: done ? 600 : 400,
                }}
              >
                {phase.label}
              </div>
            </div>
            {i < PHASES.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < lastReachedIdx ? theme.accent : theme.border, marginTop: 6 }} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** The big, website-shaped header for an incident page — a real title at
 * real size, a stat row (response time, offices engaged, resources
 * deployed, authorization level) computed from the incident's own data, and
 * a phase timeline instead of a wall of small grey text. */
export default function IncidentHero({ incident }: { incident: Incident }) {
  const graphTiers = buildGraph(incident);
  const officesEngaged = new Set(
    graphTiers.flat().filter((n) => n.kind === "authority").map((n) => n.label)
  ).size;
  const elapsed = (incident.status === "resolved" ? incident.updated_at : Date.now() / 1000) - incident.created_at;

  return (
    <div>
      <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.2, color: theme.textPrimary, lineHeight: 1.08, marginBottom: 14 }}>
        {incident.title}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11.5,
            color: STATUS_COLOR[incident.status],
            border: `1px solid ${STATUS_COLOR[incident.status]}55`,
            background: `${STATUS_COLOR[incident.status]}14`,
            borderRadius: 5,
            padding: "4px 10px",
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          {STATUS_LABEL[incident.status]}
        </span>
        <span style={{ fontSize: 11.5, color: theme.textMuted, letterSpacing: 0.4, fontWeight: 600 }}>
          {incident.severity.toUpperCase()} SEVERITY
        </span>
        {incident.source_headline && (
          <span style={{ fontSize: 11.5, color: theme.textMuted }}>
            · Sourced from live news: "{incident.source_headline}"
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 36 }}>
        <StatTile label="Response Time" value={formatDuration(elapsed)} color={theme.statusActive} />
        <StatTile label="Offices Engaged" value={String(officesEngaged)} color={theme.accent} />
        <StatTile label="Resources Deployed" value={String(incident.tasks.length)} color={theme.statusResolved} />
        <StatTile label="Authorization Level" value={highestAuthority(incident)} color={theme.statusAwaiting} />
      </div>

      <PhaseTimeline incident={incident} />
    </div>
  );
}
