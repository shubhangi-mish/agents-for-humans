import { NewsItem } from "@/lib/types";
import { NEWS_KIND_COLOR, NEWS_KIND_ICON } from "@/lib/newsKind";
import { theme } from "@/lib/theme";
import DistrictGraph from "./DistrictGraph";

const SECTION: React.CSSProperties = {
  background: theme.panel,
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  padding: 22,
};

/** The click-through page for a real news pin that isn't (yet) a simulated
 * incident. Deliberately honest about that: it never invents an authority
 * chain or a resource deployment for a real story GovOS hasn't actually
 * modeled a response for — that would misrepresent a real event as one the
 * simulation is handling. */
export default function NewsDetail({ item, onBack }: { item: NewsItem; onBack: () => void }) {
  return (
    <main style={{ minHeight: "100vh", background: theme.bg }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: `${theme.bg}ee`,
          backdropFilter: "blur(6px)",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.2, color: theme.textPrimary }}>{NEWS_KIND_ICON[item.kind]} {item.headline}</span>
          <span
            style={{
              fontSize: 10,
              color: NEWS_KIND_COLOR[item.kind],
              border: `1px solid ${NEWS_KIND_COLOR[item.kind]}55`,
              borderRadius: 4,
              padding: "2px 8px",
              fontWeight: 600,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            {item.kind}
          </span>
        </div>
        <button
          onClick={onBack}
          style={{ background: theme.bgElevated, color: theme.textSecondary, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 12 }}
        >
          ← Back to city map
        </button>
      </header>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px 60px", display: "flex", flexDirection: "column", gap: 20 }}>
        <section style={SECTION}>
          <div style={{ fontSize: 11.5, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600, marginBottom: 12 }}>
            What happened
          </div>
          <div style={{ fontSize: 13.5, color: theme.textPrimary, lineHeight: 1.6 }}>{item.headline}</div>
          {item.locality && (
            <div style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 8 }}>Reported near {item.locality}, Delhi</div>
          )}
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: theme.accent }}
          >
            Read the source report ({item.source}) →
          </a>
        </section>

        {item.jurisdiction ? (
          <section style={SECTION}>
            <DistrictGraph jurisdiction={item.jurisdiction} kind={item.kind} />
          </section>
        ) : (
          <section style={{ ...SECTION, borderColor: `${theme.statusAwaiting}44` }}>
            <div style={{ fontSize: 11.5, color: theme.statusAwaiting, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, fontWeight: 700 }}>
              Jurisdiction unresolved
            </div>
            <div style={{ fontSize: 12.5, color: theme.textSecondary, lineHeight: 1.6 }}>
              This story's location couldn't be matched to a specific Delhi district, so no authority
              chain is shown. This is a real news report, not a simulated incident — no agency has been
              notified through this app about it.
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
