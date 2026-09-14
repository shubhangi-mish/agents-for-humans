import { NewsItem } from "@/lib/types";
import { NEWS_KIND_COLOR, NEWS_KIND_ICON } from "@/lib/newsKind";

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
        background: "#141414",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: 10,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 12 }}>{NEWS_KIND_ICON[item.kind]}</span>
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
          <span style={{ fontSize: 9.5, color: "#666" }}>· {item.locality}</span>
        ) : (
          <span style={{ fontSize: 9.5, color: "#555" }}>· location unconfirmed</span>
        )}
        <span style={{ fontSize: 9.5, color: "#555", marginLeft: "auto", flexShrink: 0 }}>
          {timeAgo(item.fetched_at)}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#ddd", lineHeight: 1.4 }}>{item.headline}</div>
    </a>
  );
}

export default function NewsFeed({ items }: { items: NewsItem[] }) {
  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        height: "100%",
        background: "#0d0d0d",
        borderLeft: "1px solid #262626",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #262626" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.3, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e0654d", animation: "govos-pulse 1.6s ease-in-out infinite" }} />
          LIVE FROM DELHI
        </div>
        <div style={{ fontSize: 10.5, color: "#777", marginTop: 3 }}>
          Real headlines, geocoded to where they actually happened.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "#4a4a4a", fontStyle: "italic", padding: "8px 2px" }}>
            Listening for Delhi news…
          </div>
        ) : (
          items.map((item) => <NewsCard key={item.id} item={item} />)
        )}
      </div>

      <style>{`
        @keyframes govos-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
