"use client";

import { useState } from "react";
import AuditLog from "@/components/AuditLog";
import CityMap from "@/components/CityMap";
import CommandGraph from "@/components/CommandGraph";
import CommentThread from "@/components/CommentThread";
import EventStream from "@/components/EventStream";
import IncidentHero from "@/components/IncidentHero";
import IncidentSummary from "@/components/IncidentSummary";
import NavBar, { NavLink } from "@/components/NavBar";
import NewsDetail from "@/components/NewsDetail";
import NewsFeed from "@/components/NewsFeed";
import { CURRENT_ACTOR, CURRENT_PERSONA } from "@/lib/personas";
import { dotGridBackground, theme } from "@/lib/theme";
import { resolveApproval, useAuditLog, useEventStream, useIncidentList, useNewsFeed } from "@/lib/useEventStream";

const SECTION: React.CSSProperties = {
  background: theme.panel,
  border: `1px solid ${theme.border}`,
  borderRadius: 12,
  padding: 26,
};

export default function Page() {
  const incidents = useIncidentList();
  const newsItems = useNewsFeed();
  const audit = useAuditLog();
  const [view, setView] = useState<NavLink>("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const incident = useEventStream(selectedId);

  const open = incidents.filter((i) => i.status !== "resolved");
  const resolved = incidents.filter((i) => i.status === "resolved");
  const officesEngaged = new Set(
    incidents.flatMap((i) => i.approvals.map((a) => a.authorized_by).filter(Boolean))
  ).size;

  async function handleDecideApproval(approvalId: string, approve: boolean) {
    if (!incident) return;
    await resolveApproval(incident.id, approvalId, approve, CURRENT_ACTOR);
    audit.refresh();
  }

  function selectIncident(id: string) {
    setSelectedNewsId(null);
    setSelectedId(id);
  }

  function selectNews(id: string) {
    setSelectedId(null);
    setSelectedNewsId(id);
  }

  function backToNav(target: NavLink) {
    setSelectedId(null);
    setSelectedNewsId(null);
    setView(target);
  }

  const selectedNewsItem = selectedNewsId ? newsItems.find((n) => n.id === selectedNewsId) : undefined;
  if (selectedNewsItem) {
    return <NewsDetail item={selectedNewsItem} onBack={() => setSelectedNewsId(null)} />;
  }

  if (selectedId && incident) {
    return (
      <main style={{ minHeight: "100vh", ...dotGridBackground }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: `${theme.bg}ee`,
            backdropFilter: "blur(6px)",
            borderBottom: `1px solid ${theme.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 28px",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, color: theme.textSecondary }}>GOVOS</span>
          <button
            onClick={() => backToNav("map")}
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
        </header>

        <div style={{ padding: "40px 48px 0" }}>
          <IncidentHero key={`${incident.id}-hero`} incident={incident} />
        </div>

        <div style={{ padding: "40px 48px 60px", display: "flex", flexDirection: "column", gap: 20 }}>
          <section style={SECTION}>
            <IncidentSummary key={incident.id} incident={incident} />
          </section>

          <section style={SECTION}>
            <CommandGraph key={incident.id} incident={incident} onDecideApproval={handleDecideApproval} />
          </section>

          <section style={SECTION}>
            <CommentThread incidentId={incident.id} comments={incident.comments} />
          </section>

          <section style={SECTION}>
            <div style={{ fontSize: 13, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, marginBottom: 14 }}>
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

  return (
    <main style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column" }}>
      <NavBar
        persona={CURRENT_PERSONA}
        activeLink={view}
        onNavigate={backToNav}
        stats={{ active: open.length, resolved: resolved.length, officesEngaged }}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        {view === "audit" ? (
          <div style={{ height: "100%", overflowY: "auto", ...dotGridBackground }}>
            <AuditLog rows={audit.rows} loading={audit.loading} onRefresh={audit.refresh} onOpenIncident={selectIncident} />
          </div>
        ) : (
          <div style={{ height: "100%", display: "flex" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <CityMap incidents={incidents} newsItems={newsItems} onSelectIncident={selectIncident} onSelectNews={selectNews} />
            </div>
            <NewsFeed items={newsItems} />
          </div>
        )}
      </div>
    </main>
  );
}
