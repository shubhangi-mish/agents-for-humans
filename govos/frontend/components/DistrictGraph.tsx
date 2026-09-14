import { DistrictJurisdiction, NewsKind } from "@/lib/types";
import { buildDistrictGraph } from "@/lib/graph";
import { theme } from "@/lib/theme";
import TieredGraph from "./TieredGraph";

/** The real, connected authority chain for any geocoded Delhi news item —
 * not just the response engine's five pilot wards. Every node is "on
 * record": this is who genuinely has jurisdiction, not a claim that
 * dispatch or sign-off actually happened through this app. */
export default function DistrictGraph({ jurisdiction, kind }: { jurisdiction: DistrictJurisdiction; kind: NewsKind }) {
  const tiers = buildDistrictGraph(jurisdiction, kind);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
        <div style={{ fontSize: 11.5, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
          Authorities for {jurisdiction.district}
        </div>
        <div
          style={{
            fontSize: 9.5,
            color: theme.textMuted,
            border: `1px solid ${theme.border}`,
            borderRadius: 4,
            padding: "1px 7px",
          }}
        >
          On record — not simulated
        </div>
      </div>

      <TieredGraph tiers={tiers} emptyLabel="Jurisdiction unresolved." />

      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 18, lineHeight: 1.5 }}>
        These are the real offices whose jurisdiction actually covers {jurisdiction.district}. GovOS's deeper
        response simulation (auto-authorized dispatch, a live command graph) only executes for its five pilot
        wards (Satya Niketan, Safdarjung Enclave, Sarojini Nagar, Munirka, Hauz Khas); no agency here has been
        notified through this app.
      </div>
    </div>
  );
}
