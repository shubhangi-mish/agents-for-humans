"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Incident } from "@/lib/types";
import { DELHI_CENTER, REAL_LOCATIONS } from "@/lib/geo";
import { TILE_ATTRIBUTION, TILE_OPTIONS, TILE_URL } from "@/lib/mapTiles";

const STATUS_COLOR: Record<Incident["status"], string> = {
  active: "#5b9dd9",
  paused_for_approval: "#e0b34d",
  resolved: "#6bbf7b",
};

const STATUS_LABEL: Record<Incident["status"], string> = {
  active: "In progress",
  paused_for_approval: "Awaiting approval",
  resolved: "Resolved",
};

const SCENARIO_ICON: Record<string, string> = {
  building_collapse: "🏚️",
  flood: "🌊",
};

// A real map-pin (teardrop) shape — unmistakably "an active trigger point",
// never confusable with the small static landmark dots.
function pinIcon(scenario: string, color: string, pulsing: boolean) {
  return L.divIcon({
    className: "govos-div-icon",
    html: `
      <div style="position:relative;width:36px;height:44px;">
        ${pulsing ? `<div class="govos-city-pulse" style="border-color:${color}"></div>` : ""}
        <div style="
            position:absolute; left:3px; top:0; width:30px; height:30px;
            background:${color}; border:2px solid #0b0d0f;
            border-radius:50% 50% 50% 0; transform:rotate(-45deg);
            box-shadow:0 3px 8px rgba(0,0,0,.6);
          "></div>
        <div style="
            position:absolute; left:3px; top:0; width:30px; height:30px;
            display:flex; align-items:center; justify-content:center;
            font-size:15px;
          ">${SCENARIO_ICON[scenario] ?? "🚨"}</div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 40],
    popupAnchor: [0, -38],
  });
}

function landmarkIcon(kind: string) {
  const color = kind === "hospital" ? "#7a3b3b" : kind === "base" ? "#3a4a40" : "#3a3a3a";
  return L.divIcon({
    className: "govos-div-icon",
    html: `<div style="width:5px;height:5px;border-radius:50%;background:${color};opacity:0.7;"></div>`,
    iconSize: [5, 5],
    iconAnchor: [2.5, 2.5],
  });
}

// Fans concurrent incidents at (almost) the same coordinate out into a
// small ring so they don't render exactly stacked on top of each other.
function fanOut(incidents: Incident[]): { incident: Incident; lat: number; lng: number }[] {
  const groups = new Map<string, Incident[]>();
  for (const inc of incidents) {
    const loc = REAL_LOCATIONS[inc.location];
    const key = loc ? `${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}` : "unknown";
    groups.set(key, [...(groups.get(key) ?? []), inc]);
  }
  const out: { incident: Incident; lat: number; lng: number }[] = [];
  for (const group of groups.values()) {
    group.forEach((inc, i) => {
      const loc = REAL_LOCATIONS[inc.location] ?? { lat: DELHI_CENTER[0], lng: DELHI_CENTER[1] };
      const angle = (i / Math.max(group.length, 1)) * 2 * Math.PI;
      const fan = group.length > 1 ? 0.0035 : 0;
      out.push({ incident: inc, lat: loc.lat + Math.sin(angle) * fan, lng: loc.lng + Math.cos(angle) * fan });
    });
  }
  return out;
}

export default function CityMapInner({
  incidents,
  onSelect,
}: {
  incidents: Incident[];
  onSelect: (id: string) => void;
}) {
  const pins = fanOut(incidents);

  return (
    <MapContainer
      center={DELHI_CENTER}
      zoom={13}
      style={{ width: "100%", height: "100%", background: "#0d0d0d" }}
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        url={TILE_URL}
        attribution={TILE_ATTRIBUTION}
        className={TILE_URL.includes("mapbox") ? undefined : "tiles-fallback-dark"}
        {...TILE_OPTIONS}
      />

      {Object.entries(REAL_LOCATIONS).map(([name, loc]) => (
        <Marker key={name} position={[loc.lat, loc.lng]} icon={landmarkIcon(loc.kind)}>
          <Popup>{name}</Popup>
        </Marker>
      ))}

      {pins.map(({ incident, lat, lng }) => (
        <Marker
          key={incident.id}
          position={[lat, lng]}
          icon={pinIcon(incident.scenario, STATUS_COLOR[incident.status], incident.status !== "resolved")}
          eventHandlers={{ click: () => onSelect(incident.id) }}
        >
          <Popup>
            <div style={{ fontWeight: 600 }}>{incident.title}</div>
            <div>{STATUS_LABEL[incident.status]}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
