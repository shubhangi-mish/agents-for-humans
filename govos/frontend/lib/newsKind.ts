import { NewsKind } from "./types";
import { theme } from "./theme";

export const NEWS_KIND_ICON: Record<NewsKind, string> = {
  fire: "🔥",
  collapse: "🏚️",
  flood: "🌊",
  crime: "🚔",
  accident: "🚑",
  other: "📰",
};

export const NEWS_KIND_COLOR: Record<NewsKind, string> = {
  fire: theme.kindFire,
  collapse: theme.kindCollapse,
  flood: theme.kindFlood,
  crime: theme.kindCrime,
  accident: theme.kindAccident,
  other: theme.kindOther,
};
