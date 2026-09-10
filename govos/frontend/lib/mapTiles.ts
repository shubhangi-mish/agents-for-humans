const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export const TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}{r}?access_token=${MAPBOX_TOKEN}`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// Mapbox styles are served as 512px tiles at one zoom level lower than
// standard 256px tiles — without these two, tiles render at the wrong scale.
export const TILE_OPTIONS = MAPBOX_TOKEN ? { tileSize: 512, zoomOffset: -1 } : {};

export const TILE_ATTRIBUTION = MAPBOX_TOKEN
  ? '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
