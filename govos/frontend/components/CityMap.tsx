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
  const resolved = incidents.filter((i) => i.status === "resolved");
  const officesEngaged = new Set(
    incidents.flatMap((i) => i.approvals.map((a) => a.authorized_by).filter(Boolean))
  ).size;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CityMapInner incidents={incidents} newsItems={newsItems} onSelectIncident={onSelectIncident} onSelectNews={onSelectNews} />

      <div style={{ ...OVERLAY, top: 14, left: 14, padding: "9px 14px", display: "flex", alignItems: "center", gap: 18 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: 0.4, color: theme.textPrimary }}>GOVOS</div>
          <div style={{ fontSize: 10.5, color: theme.textSecondary }}>
            {open.length} active incident{open.length === 1 ? "" : "s"} · {resolved.length} resolved
          </div>
        </div>
        <div style={{ borderLeft: `1px solid ${theme.border}`, paddingLeft: 18, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.accent }}>{officesEngaged}</div>
          <div style={{ fontSize: 8.5, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>
            Offices engaged
          </div>
        </div>
      </div>

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
