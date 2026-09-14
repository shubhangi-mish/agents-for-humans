import { useState } from "react";
import { NewsItem } from "@/lib/types";
import { NEWS_KIND_COLOR, NEWS_KIND_ICON } from "@/lib/newsKind";
import { theme } from "@/lib/theme";
import { refreshNews } from "@/lib/useEventStream";

function timeAgo(fetchedAt: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - fetchedAt));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 7,
        padding: 11,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11.5 }}>{NEWS_KIND_ICON[item.kind]}</span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: NEWS_KIND_COLOR[item.kind],
          }}
        >
          {item.kind}
        </span>
        {item.locality ? (
          <span style={{ fontSize: 9.5, color: theme.textSecondary }}>· {item.locality}</span>
        ) : (
          <span style={{ fontSize: 9.5, color: theme.textMuted }}>· location unconfirmed</span>
        )}
        <span style={{ fontSize: 9.5, color: theme.textMuted, marginLeft: "auto", flexShrink: 0 }}>
          {timeAgo(item.fetched_at)}
        </span>
      </div>
      <div style={{ fontSize: 12, color: theme.textPrimary, lineHeight: 1.45 }}>{item.headline}</div>
    </a>
  );
}

type RefreshState = { kind: "idle" } | { kind: "loading" } | { kind: "done"; count: number } | { kind: "error" };

export default function NewsFeed({ items }: { items: NewsItem[] }) {
  const [refresh, setRefresh] = useState<RefreshState>({ kind: "idle" });

  async function handleRefresh() {
    setRefresh({ kind: "loading" });
    try {
      const { new_items } = await refreshNews();
      setRefresh({ kind: "done", count: new_items });
      setTimeout(() => setRefresh({ kind: "idle" }), 3000);
    } catch {
      setRefresh({ kind: "error" });
      setTimeout(() => setRefresh({ kind: "idle" }), 3000);
    }
  }

  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        height: "100%",
        background: theme.bg,
        borderLeft: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "15px 16px 11px", borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.4, color: theme.textPrimary }}>
            DELHI NEWS
          </div>
          <button
            onClick={handleRefresh}
            disabled={refresh.kind === "loading"}
            style={{
              background: theme.bgElevated,
              border: `1px solid ${theme.border}`,
              borderRadius: 5,
              color: theme.textSecondary,
              fontSize: 10.5,
              padding: "4px 9px",
              cursor: refresh.kind === "loading" ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                display: "inline-block",
                animation: refresh.kind === "loading" ? "govos-spin 0.8s linear infinite" : undefined,
              }}
            >
              ⟳
            </span>
            {refresh.kind === "loading" ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 5 }}>
          {refresh.kind === "done"
            ? refresh.count > 0
              ? `+${refresh.count} new headline${refresh.count === 1 ? "" : "s"} found.`
              : "No new headlines since last refresh."
            : refresh.kind === "error"
              ? "Refresh failed — try again."
              : "On-demand only — press Refresh to pull the latest, geocoded to where it actually happened."}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 11.5, color: theme.textMuted, fontStyle: "italic", padding: "8px 2px" }}>
            No news yet — press Refresh to check Delhi.
          </div>
        ) : (
          items.map((item) => <NewsCard key={item.id} item={item} />)
        )}
      </div>

      <style>{`
        @keyframes govos-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
