import { NewsKind } from "./types";

export const NEWS_KIND_ICON: Record<NewsKind, string> = {
  fire: "🔥",
  collapse: "🏚️",
  flood: "🌊",
  crime: "🚔",
  accident: "🚑",
  other: "📰",
};

export const NEWS_KIND_COLOR: Record<NewsKind, string> = {
  fire: "#e0654d",
  collapse: "#e0b34d",
  flood: "#5b9dd9",
  crime: "#b366d9",
  accident: "#e0a04d",
  other: "#888",
};
