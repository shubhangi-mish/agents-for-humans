"use client";

import { useState } from "react";
import CityMap from "@/components/CityMap";
import EventStream from "@/components/EventStream";
import KanbanBoard from "@/components/KanbanBoard";
import NewsFeed from "@/components/NewsFeed";
import OfficeSections from "@/components/OfficeSections";
import { resolveApproval, useEventStream, useIncidentList, useNewsFeed } from "@/lib/useEventStream";

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

const SECTION: React.CSSProperties = {
  background: "#141414",
  border: "1px solid #262626",
  borderRadius: 12,
  padding: 20,
};

export default function Page() {
  const incidents = useIncidentList();
  const newsItems = useNewsFeed();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const incident = useEventStream(selectedId);

  async function handleDecideApproval(approvalId: string, approve: boolean) {
    if (!incident) return;
    await resolveApproval(incident.id, approvalId, approve);
  }

  if (!selectedId || !incident) {
    return (
      <main style={{ height: "100vh", width: "100vw", display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CityMap incidents={incidents} newsItems={newsItems} onSelect={setSelectedId} />
        </div>
        <NewsFeed items={newsItems} />
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0d0d0d" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#0d0d0dee",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid #262626",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "14px 24px",
        }}
      >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.5 }}>{incident.title}</span>
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
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ← Back to city map
        </button>
      </div>
      {incident.source_headline && (
        <div style={{ fontSize: 11, color: "#888" }}>📰 Sourced from live news: “{incident.source_headline}”</div>
      )}
      </header>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px 20px" }}>
        <OfficeSections key={incident.id} incident={incident} />
      </div>

      <div style={{ padding: "20px 32px 60px", display: "flex", flexDirection: "column", gap: 20 }}>
        <section style={SECTION}>
          <div style={{ fontSize: 12, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
            Field tasks
          </div>
          <KanbanBoard key={incident.id} incident={incident} onDecideApproval={handleDecideApproval} />
        </section>

        <section style={SECTION}>
          <div style={{ fontSize: 12, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Activity
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            <EventStream events={incident.events} />
          </div>
        </section>
      </div>
    </main>
  );
}
