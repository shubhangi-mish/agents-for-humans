import { NewsItem } from "@/lib/types";
import { NEWS_KIND_COLOR, NEWS_KIND_ICON } from "@/lib/newsKind";

const SECTION: React.CSSProperties = {
  background: "#141414",
  border: "1px solid #262626",
  borderRadius: 12,
  padding: 20,
};

/** The click-through page for a real news pin that isn't (yet) a simulated
 * incident. Deliberately honest about that: it never invents an authority
 * chain or a resource deployment for a real story GovOS hasn't actually
 * modeled a response for — that would misrepresent a real event as one the
 * simulation is handling. */
export default function NewsDetail({ item, onBack }: { item: NewsItem; onBack: () => void }) {
  return (
    <main style={{ minHeight: "100vh", background: "#0d0d0d" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#0d0d0dee",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid #262626",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.5 }}>{NEWS_KIND_ICON[item.kind]} {item.headline}</span>
          <span
            style={{
              fontSize: 10.5,
              color: NEWS_KIND_COLOR[item.kind],
              border: `1px solid ${NEWS_KIND_COLOR[item.kind]}66`,
              borderRadius: 4,
              padding: "2px 8px",
              fontWeight: 700,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            {item.kind}
          </span>
        </div>
        <button
          onClick={onBack}
          style={{ background: "#1a1a1a", color: "#bbb", border: "1px solid #333", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 12 }}
        >
          ← Back to city map
        </button>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px", display: "flex", flexDirection: "column", gap: 20 }}>
        <section style={SECTION}>
          <div style={{ fontSize: 12, color: "#777", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            What happened
          </div>
          <div style={{ fontSize: 13.5, color: "#ddd", lineHeight: 1.6 }}>{item.headline}</div>
          {item.locality && (
            <div style={{ fontSize: 11.5, color: "#999", marginTop: 8 }}>📍 Reported near {item.locality}, Delhi</div>
          )}
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#5b9dd9" }}
          >
            Read the source report ({item.source}) →
          </a>
        </section>

        <section style={{ ...SECTION, borderColor: "#3a3220" }}>
          <div style={{ fontSize: 12, color: "#e0b34d", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, fontWeight: 700 }}>
            Authorities &amp; response — not simulated
          </div>
          <div style={{ fontSize: 12.5, color: "#bbb", lineHeight: 1.6 }}>
            This is a real news report, shown here only to mark where it happened. GovOS's simulated
            response engine — the jurisdiction chain, authority sign-offs, and resource dispatch you'd see
            on a running incident — only models the seeded Delhi localities it runs scenarios for
            (Satya Niketan, Safdarjung Enclave, Sarojini Nagar, Munirka, Hauz Khas). No real MLA, SDM,
            police station, or agency has actually been notified through this app about this story.
          </div>
        </section>
      </div>
    </main>
  );
}
