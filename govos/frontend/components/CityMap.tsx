"use client";

import dynamic from "next/dynamic";
import { Incident } from "@/lib/types";

const CityMapInner = dynamic(() => import("./CityMapInner"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#555", fontSize: 13 }}>
      Loading map…
    </div>
  ),
});

export default function CityMap({
  incidents,
  onSelect,
}: {
  incidents: Incident[];
  onSelect: (incidentId: string) => void;
}) {
  const open = incidents.filter((i) => i.status !== "resolved");
  const resolved = incidents.filter((i) => i.status === "resolved");

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CityMapInner incidents={incidents} onSelect={onSelect} />

      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 1000,
          background: "#141414ee",
          border: "1px solid #262626",
          borderRadius: 8,
          padding: "8px 12px",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.5 }}>GOVOS</div>
        <div style={{ fontSize: 11, color: "#888" }}>
          {open.length} active incident{open.length === 1 ? "" : "s"} · {resolved.length} resolved
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          zIndex: 1000,
          background: "#141414ee",
          border: "1px solid #262626",
          borderRadius: 8,
          padding: "6px 12px",
          display: "flex",
          gap: 12,
          fontSize: 11,
          color: "#aaa",
          pointerEvents: "none",
        }}
      >
        <span><span style={{ color: "#5b9dd9" }}>●</span> In progress</span>
        <span><span style={{ color: "#e0b34d" }}>●</span> Awaiting approval</span>
        <span><span style={{ color: "#6bbf7b" }}>●</span> Resolved</span>
      </div>

      {open.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            color: "#888",
            fontSize: 13,
            background: "#141414ee",
            border: "1px solid #262626",
            borderRadius: 8,
            padding: "8px 14px",
            pointerEvents: "none",
          }}
        >
          No active incidents right now — the city is quiet.
        </div>
      )}
    </div>
  );
}
