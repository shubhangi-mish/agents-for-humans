"use client";

import { useState } from "react";
import AgentGraph from "@/components/AgentGraph";
import ApprovalCard from "@/components/ApprovalCard";
import DecisionStack from "@/components/DecisionStack";
import EventStream from "@/components/EventStream";
import Map from "@/components/Map";
import { resolveApproval, triggerIncident, useEventStream } from "@/lib/useEventStream";

const PANEL: React.CSSProperties = {
  background: "#141414",
  border: "1px solid #262626",
  borderRadius: 10,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

export default function Page() {
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const incident = useEventStream(incidentId);

  const pendingApproval = incident?.approvals.find((a) => a.status === "pending");

  async function handleTrigger() {
    const { incident_id } = await triggerIncident({ zone: "South Delhi" });
    setIncidentId(incident_id);
  }

  async function handleDecide(approve: boolean) {
    if (!incident || !pendingApproval) return;
    await resolveApproval(incident.id, pendingApproval.id, approve);
  }

  return (
    <main
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateRows: "56px 1fr 180px",
        gap: 12,
        padding: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>GOVOS</span>
          <span style={{ fontSize: 12, color: "#888" }}>
            {incident ? `${incident.title} — ${incident.severity.toUpperCase()}` : "No active incident"}
          </span>
        </div>
        <button
          onClick={handleTrigger}
          style={{
            background: "#1c3a52",
            color: "#cfe6ff",
            border: "1px solid #2d5674",
            borderRadius: 6,
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Inject weather event
        </button>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 12, minHeight: 0 }}>
        <div style={PANEL}>
          <Map affectedWards={incident?.affected_wards ?? []} tasks={incident?.tasks ?? []} />
        </div>
        <div style={PANEL}>
          <AgentGraph events={incident?.events ?? []} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div style={PANEL}>{incident && <DecisionStack incident={incident} />}</div>
          {pendingApproval && <ApprovalCard approval={pendingApproval} onDecide={handleDecide} />}
        </div>
      </section>

      <section style={PANEL}>
        <EventStream events={incident?.events ?? []} />
      </section>
    </main>
  );
}
