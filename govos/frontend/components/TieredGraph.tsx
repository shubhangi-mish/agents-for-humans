import { Approval } from "@/lib/types";
import { GraphNode } from "@/lib/graph";
import { theme } from "@/lib/theme";
import GraphNodeCard from "./GraphNodeCard";

/** Renders any tiered graph (top authority → ... → bottom) with connector
 * lines between rows — shared by CommandGraph (a live incident's command +
 * response chain) and DistrictGraph (a real news item's static jurisdiction
 * chain), so both read as the same visual language. */
export default function TieredGraph({
  tiers,
  approvalsById,
  onDecideApproval,
  emptyLabel,
}: {
  tiers: GraphNode[][];
  approvalsById?: Map<string, Approval>;
  onDecideApproval?: (approvalId: string, approve: boolean) => void;
  emptyLabel: string;
}) {
  if (tiers.length === 0) {
    return <div style={{ fontSize: 11.5, color: theme.textMuted, fontStyle: "italic" }}>{emptyLabel}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {tiers.map((tier, i) => (
        <div key={i} style={{ position: "relative" }}>
          {i > 0 && (
            <div aria-hidden style={{ position: "relative", height: 28, display: "flex", justifyContent: "center" }}>
              <div style={{ position: "absolute", top: 0, bottom: "50%", left: "50%", width: 1, background: theme.borderStrong }} />
              <div style={{ position: "absolute", top: "50%", left: "18%", right: "18%", height: 1, background: theme.borderStrong }} />
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20 }}>
            {tier.map((node) => {
              const approval = node.id.startsWith("auth-") ? approvalsById?.get(node.id.replace("auth-", "")) : undefined;
              return (
                <GraphNodeCard
                  key={node.id}
                  node={node}
                  approval={approval}
                  onDecideApproval={approval ? onDecideApproval : null}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
