import { Incident } from "@/lib/types";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "#777", textTransform: "uppercase", letterSpacing: 0.5 }}>
        What happened
      </div>
      <div style={{ fontSize: 13, color: "#ddd", lineHeight: 1.6 }}>
        {intel?.text ?? "Situation summary not yet available — the Intel Agent hasn't reported in."}
      </div>
      {incident.affected_wards.length > 0 && (
        <div style={{ fontSize: 11.5, color: "#999" }}>
          📍 Affected area: {incident.affected_wards.join(", ")}
        </div>
      )}
      {briefing && (
        <div style={{ marginTop: 4, paddingTop: 10, borderTop: "1px solid #262626" }}>
          <div style={{ fontSize: 10.5, color: "#6bbf7b", fontWeight: 700, letterSpacing: 0.3, marginBottom: 4 }}>
            RESOLUTION BRIEFING
          </div>
          <div style={{ fontSize: 12.5, color: "#ccc", lineHeight: 1.55 }}>{briefing.text}</div>
        </div>
      )}
    </div>
  );
}
