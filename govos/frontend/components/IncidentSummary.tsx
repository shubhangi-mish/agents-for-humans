import { Incident } from "@/lib/types";
import { theme } from "@/lib/theme";

function findLast(events: Incident["events"], pred: (e: Incident["events"][number]) => boolean) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (pred(events[i])) return events[i];
  }
  return undefined;
}

/** "What happened" — the first thing anyone opening an incident should see,
 * before the chain of command or the task board. Pulls the Intel Agent's
 * situation summary (and, once resolved, the Orchestrator's closing
 * briefing) straight out of the incident's own event log rather than
 * duplicating that text anywhere else. */
export default function IncidentSummary({ incident }: { incident: Incident }) {
  const intel = findLast(incident.events, (e) => e.agent === "intel_agent" && e.kind === "reasoning");
  const briefing = findLast(incident.events, (e) => e.agent === "orchestrator" && e.kind === "briefing");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
        What happened
      </div>
      <div style={{ fontSize: 15, color: theme.textPrimary, lineHeight: 1.65 }}>
        {intel?.text ?? "Situation summary not yet available — the Intel Agent hasn't reported in."}
      </div>
      {incident.affected_wards.length > 0 && (
        <div style={{ fontSize: 12.5, color: theme.textSecondary }}>
          Affected area: {incident.affected_wards.join(", ")}
        </div>
      )}
      {briefing && (
        <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 11, color: theme.statusResolved, fontWeight: 700, letterSpacing: 0.4, marginBottom: 6 }}>
            RESOLUTION BRIEFING
          </div>
          <div style={{ fontSize: 13.5, color: theme.textSecondary, lineHeight: 1.6 }}>{briefing.text}</div>
        </div>
      )}
    </div>
  );
}
