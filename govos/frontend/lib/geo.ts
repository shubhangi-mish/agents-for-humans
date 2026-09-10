export type LocKind = "locality" | "hospital" | "base";

export interface GeoLoc {
  lat: number;
  lng: number;
  kind: LocKind;
}

// Approximate real-world coordinates for South Delhi. Good enough for a
// situation-room style map at city zoom — not survey-grade, but genuinely
// placed on the real map rather than an abstract schematic grid.
export const REAL_LOCATIONS: Record<string, GeoLoc> = {
  "Satya Niketan": { lat: 28.5677, lng: 77.1613, kind: "locality" },
  "Safdarjung Enclave": { lat: 28.5646, lng: 77.1957, kind: "locality" },
  "Sarojini Nagar": { lat: 28.5771, lng: 77.1998, kind: "locality" },
  Munirka: { lat: 28.5561, lng: 77.1746, kind: "locality" },
  "Hauz Khas": { lat: 28.5494, lng: 77.2001, kind: "locality" },
  "AIIMS New Delhi": { lat: 28.5672, lng: 77.2100, kind: "hospital" },
  "Safdarjung Hospital": { lat: 28.5688, lng: 77.2065, kind: "hospital" },
  "Primus Super Speciality Hospital": { lat: 28.5588, lng: 77.1735, kind: "hospital" },
  "MCD South Zone Office, Hauz Khas": { lat: 28.5490, lng: 77.2010, kind: "base" },
  "DFS Station, Hauz Khas": { lat: 28.5470, lng: 77.2040, kind: "base" },
  "CATS Control Room, Safdarjung": { lat: 28.5700, lng: 77.2050, kind: "base" },
  "South West District HQ": { lat: 28.5854, lng: 77.1636, kind: "base" },
  "NDRF Delhi Unit": { lat: 28.6139, lng: 77.2090, kind: "base" },
};

export const DELHI_CENTER: [number, number] = [28.5675, 77.1900];
