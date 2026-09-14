"use client";

import dynamic from "next/dynamic";
import { Incident, NewsItem } from "@/lib/types";
import { theme } from "@/lib/theme";

const CityMapInner = dynamic(() => import("./CityMapInner"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: theme.textMuted, fontSize: 13 }}>
      Loading map…
    </div>
  ),
});

const OVERLAY: React.CSSProperties = {
  position: "absolute",
  zIndex: 1000,
  background: `${theme.panel}f2`,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  pointerEvents: "none",
};

export default function CityMap({
  incidents,
  newsItems,
  onSelectIncident,
  onSelectNews,
}: {
  incidents: Incident[];
  newsItems: NewsItem[];
  onSelectIncident: (incidentId: string) => void;
  onSelectNews: (newsId: string) => void;
}) {
  const open = incidents.filter((i) => i.status !== "resolved");

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CityMapInner incidents={incidents} newsItems={newsItems} onSelectIncident={onSelectIncident} onSelectNews={onSelectNews} />

      <div style={{ ...OVERLAY, bottom: 14, left: 14, padding: "7px 12px", display: "flex", gap: 12, fontSize: 10.5, color: theme.textSecondary }}>
        <span><span style={{ color: theme.statusActive }}>●</span> In progress</span>
        <span><span style={{ color: theme.statusAwaiting }}>●</span> Awaiting approval</span>
        <span><span style={{ color: theme.statusResolved }}>●</span> Resolved</span>
        <span><span style={{ color: theme.statusNews }}>●</span> Real news, unprocessed</span>
      </div>

      {open.length === 0 && (
        <div
          style={{
            ...OVERLAY,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: theme.textSecondary,
            fontSize: 12.5,
            padding: "8px 14px",
          }}
        >
          No active incidents right now — the city is quiet.
        </div>
      )}
    </div>
  );
}
