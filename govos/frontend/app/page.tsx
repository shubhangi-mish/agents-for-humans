"use client";

import { useState } from "react";
import CityMap from "@/components/CityMap";
import CommandGraph from "@/components/CommandGraph";
import EventStream from "@/components/EventStream";
import IncidentSummary from "@/components/IncidentSummary";
import NewsDetail from "@/components/NewsDetail";
import NewsFeed from "@/components/NewsFeed";
import { theme, STATUS_COLOR, STATUS_LABEL } from "@/lib/theme";
import { resolveApproval, useEventStream, useIncidentList, useNewsFeed } from "@/lib/useEventStream";

const SECTION: React.CSSProperties = {
  background: theme.panel,
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  padding: 22,
};

export default function Page() {
  const incidents = useIncidentList();
  const newsItems = useNewsFeed();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const incident = useEventStream(selectedId);

  async function handleDecideApproval(approvalId: string, approve: boolean) {
    if (!incident) return;
    await resolveApproval(incident.id, approvalId, approve);
  }

  function selectIncident(id: string) {
    setSelectedNewsId(null);
    setSelectedId(id);
  }

  function selectNews(id: string) {
    setSelectedId(null);
    setSelectedNewsId(id);
  }

  const selectedNewsItem = selectedNewsId ? newsItems.find((n) => n.id === selectedNewsId) : undefined;
  if (selectedNewsItem) {
    return <NewsDetail item={selectedNewsItem} onBack={() => setSelectedNewsId(null)} />;
  }

  if (!selectedId || !incident) {
    return (
      <main style={{ height: "100vh", width: "100vw", display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CityMap incidents={incidents} newsItems={newsItems} onSelectIncident={selectIncident} onSelectNews={selectNews} />
        </div>
        <NewsFeed items={newsItems} />
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: theme.bg }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: `${theme.bg}ee`,
          backdropFilter: "blur(6px)",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "16px 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.2, color: theme.textPrimary }}>{incident.title}</span>
            <span
              style={{
                fontSize: 10,
                color: STATUS_COLOR[incident.status],
                border: `1px solid ${STATUS_COLOR[incident.status]}55`,
                borderRadius: 4,
                padding: "2px 8px",
                fontWeight: 600,
                letterSpacing: 0.3,
              }}
            >
              {STATUS_LABEL[incident.status]}
            </span>
            <span style={{ fontSize: 10.5, color: theme.textMuted, letterSpacing: 0.3 }}>{incident.severity.toUpperCase()}</span>
          </div>
          <button
            onClick={() => setSelectedId(null)}
            style={{
              background: theme.bgElevated,
              color: theme.textSecondary,
              border: `1px solid ${theme.border}`,
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
          <div style={{ fontSize: 11, color: theme.textMuted }}>Sourced from live news: "{incident.source_headline}"</div>
        )}
      </header>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px 60px", display: "flex", flexDirection: "column", gap: 20 }}>
        <section style={SECTION}>
          <IncidentSummary key={incident.id} incident={incident} />
        </section>

        <section style={SECTION}>
          <CommandGraph key={incident.id} incident={incident} onDecideApproval={handleDecideApproval} />
        </section>

        <section style={SECTION}>
          <div style={{ fontSize: 11.5, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600, marginBottom: 12 }}>
            Full activity log
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            <EventStream events={incident.events} />
          </div>
        </section>
      </div>
    </main>
  );
}
