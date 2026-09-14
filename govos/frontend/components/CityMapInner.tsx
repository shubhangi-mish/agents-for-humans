"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Tooltip, TileLayer } from "react-leaflet";
import { Incident, NewsItem } from "@/lib/types";
import { DELHI_CENTER, REAL_LOCATIONS } from "@/lib/geo";
import { TILE_ATTRIBUTION, TILE_OPTIONS, TILE_URL } from "@/lib/mapTiles";

const STATUS_LABEL: Record<Incident["status"], string> = {
  active: "In progress",
  paused_for_approval: "Awaiting approval",
  resolved: "Resolved",
};

// One pin shape for everything on the map — an incident and a real news
// report look the same at a glance, only the color (status) and the pulse
// (still live vs. settled) differ. No per-scenario or per-kind icon variety.
const PIN_COLOR: Record<string, string> = {
  active: "#5b9dd9",
  paused_for_approval: "#e0b34d",
  resolved: "#6bbf7b",
  news: "#9a9a9a",
};

type MapPin =
  | { id: string; kind: "incident"; lat: number; lng: number; title: string; subtitle: string; status: Incident["status"]; ref: Incident }
  | { id: string; kind: "news"; lat: number; lng: number; title: string; subtitle: string; status: "news"; ref: NewsItem };

function uniformPinIcon(color: string, pulsing: boolean) {
  return L.divIcon({
    className: "govos-div-icon",
    html: `
      <div style="position:relative;width:26px;height:32px;">
        ${pulsing ? `<div class="govos-city-pulse" style="border-color:${color}"></div>` : ""}
        <div style="
            position:absolute; left:3px; top:0; width:20px; height:20px;
            background:${color}; border:2px solid #0b0d0f;
            border-radius:50% 50% 50% 0; transform:rotate(-45deg);
            box-shadow:0 3px 8px rgba(0,0,0,.6);
          "></div>
        <div style="
            position:absolute; left:3px; top:0; width:20px; height:20px;
            display:flex; align-items:center; justify-content:center;
          ">
          <div style="width:7px;height:7px;border-radius:50%;background:#0b0d0f;"></div>
        </div>
      </div>
    `,
    iconSize: [26, 32],
    iconAnchor: [13, 28],
    popupAnchor: [0, -26],
  });
}

// Fans concurrent pins at (almost) the same coordinate out into a small ring
// so they don't render exactly stacked on top of each other.
function fanOut(pins: Omit<MapPin, "lat" | "lng">[], coords: (p: Omit<MapPin, "lat" | "lng">) => { lat: number; lng: number }): MapPin[] {
  const groups = new Map<string, Omit<MapPin, "lat" | "lng">[]>();
  for (const p of pins) {
    const c = coords(p);
    const key = `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const out: MapPin[] = [];
  for (const group of groups.values()) {
    group.forEach((p, i) => {
      const c = coords(p);
      const angle = (i / Math.max(group.length, 1)) * 2 * Math.PI;
      const fan = group.length > 1 ? 0.0035 : 0;
      out.push({ ...p, lat: c.lat + Math.sin(angle) * fan, lng: c.lng + Math.cos(angle) * fan } as MapPin);
    });
  }
  return out;
}

/** Merges simulated incidents and real geocoded news into one pin list. A
 * news item whose headline matches an incident's source_headline is
 * dropped — that story already has a full simulated pin, showing both would
 * just be the same real event marked twice. */
function buildPins(incidents: Incident[], newsItems: NewsItem[]): MapPin[] {
  const incidentHeadlines = new Set(incidents.map((i) => i.source_headline).filter(Boolean));

  const incidentPins: Omit<MapPin, "lat" | "lng">[] = incidents
    .filter((i) => REAL_LOCATIONS[i.location])
    .map((i) => ({
      id: i.id,
      kind: "incident" as const,
      title: i.title,
      subtitle: STATUS_LABEL[i.status],
      status: i.status,
      ref: i,
    }));

  const newsPins: Omit<MapPin, "lat" | "lng">[] = newsItems
    .filter((n) => n.lat != null && n.lng != null && !incidentHeadlines.has(n.headline))
    .map((n) => ({
      id: n.id,
      kind: "news" as const,
      title: n.headline,
      subtitle: n.locality ? `Reported near ${n.locality}` : "Real news report",
      status: "news" as const,
      ref: n,
    }));

  const coords = (p: Omit<MapPin, "lat" | "lng">) => {
    if (p.kind === "incident") return REAL_LOCATIONS[(p.ref as Incident).location] ?? { lat: DELHI_CENTER[0], lng: DELHI_CENTER[1] };
    const n = p.ref as NewsItem;
    return { lat: n.lat as number, lng: n.lng as number };
  };

  return fanOut([...incidentPins, ...newsPins], coords);
}

export default function CityMapInner({
  incidents,
  newsItems,
  onSelectIncident,
  onSelectNews,
}: {
  incidents: Incident[];
  newsItems: NewsItem[];
  onSelectIncident: (id: string) => void;
  onSelectNews: (id: string) => void;
}) {
  const pins = buildPins(incidents, newsItems);

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

      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={uniformPinIcon(PIN_COLOR[pin.status], pin.status !== "resolved")}
          eventHandlers={{
            click: () => (pin.kind === "incident" ? onSelectIncident(pin.id) : onSelectNews(pin.id)),
          }}
        >
          <Tooltip direction="top" offset={[0, -26]} opacity={0.97}>
            <div style={{ maxWidth: 220 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{pin.title}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{pin.subtitle}</div>
            </div>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
