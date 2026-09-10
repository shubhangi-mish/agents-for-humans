"use client";

import { useState } from "react";
import CityMap from "@/components/CityMap";
import EventStream from "@/components/EventStream";
import KanbanBoard from "@/components/KanbanBoard";
import OfficeChain from "@/components/OfficeChain";
import { resolveApproval, useEventStream, useIncidentList } from "@/lib/useEventStream";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused_for_approval: "Awaiting approval",
  resolved: "Resolved",
};

const STATUS_COLOR: Record<string, string> = {
  active: "#5b9dd9",
  paused_for_approval: "#e0b34d",
  resolved: "#6bbf7b",
};

export default function Page() {
  const incidents = useIncidentList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const incident = useEventStream(selectedId);

  async function handleDecideApproval(approvalId: string, approve: boolean) {
    if (!incident) return;
    await resolveApproval(incident.id, approvalId, approve);
  }

  if (!selectedId || !incident) {
    return (
      <main style={{ height: "100vh", width: "100vw" }}>
        <CityMap incidents={incidents} onSelect={setSelectedId} />
      </main>
    );
  }

  return (
    <main
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateRows: "auto auto 1fr auto",
        gap: 10,
        padding: 12,
        minHeight: 0,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.5 }}>{incident.title}</span>
          <span
            style={{
              fontSize: 10.5,
              color: STATUS_COLOR[incident.status],
              border: `1px solid ${STATUS_COLOR[incident.status]}66`,
              borderRadius: 4,
              padding: "2px 8px",
              fontWeight: 700,
              letterSpacing: 0.3,
            }}
          >
            {STATUS_LABEL[incident.status]}
          </span>
          <span style={{ fontSize: 11, color: "#666" }}>{incident.severity.toUpperCase()}</span>
        </div>
        <button
          onClick={() => setSelectedId(null)}
          style={{
            background: "#1a1a1a",
            color: "#bbb",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ← Back to city map
        </button>
      </header>

      <div style={{ background: "#141414", border: "1px solid #262626", borderRadius: 10, padding: 12 }}>
        <OfficeChain incident={incident} />
      </div>

      <div style={{ minHeight: 0 }}>
        <KanbanBoard incident={incident} onDecideApproval={handleDecideApproval} />
      </div>

      <section
        style={{
          background: "#141414",
          border: "1px solid #262626",
          borderRadius: 10,
          padding: 12,
          maxHeight: 140,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div style={{ fontSize: 11, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          Activity
        </div>
        <div style={{ overflowY: "auto", minHeight: 0 }}>
          <EventStream events={incident.events} />
        </div>
      </section>
    </main>
  );
}
