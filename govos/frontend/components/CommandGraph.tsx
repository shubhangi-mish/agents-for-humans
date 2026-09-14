import { Incident } from "@/lib/types";
import { buildGraph } from "@/lib/graph";
import { theme } from "@/lib/theme";
import TieredGraph from "./TieredGraph";

export default function CommandGraph({
  incident,
  onDecideApproval,
}: {
  incident: Incident;
  onDecideApproval: (approvalId: string, approve: boolean) => void;
}) {
  const tiers = buildGraph(incident);
  const approvalsById = new Map(incident.approvals.map((a) => [a.id, a]));
  const override = [...incident.events].reverse().find((e) => e.agent === "human_override" && e.kind === "decision");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
        <div style={{ fontSize: 11.5, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
          Command &amp; response graph
        </div>
        <div
          style={{
            fontSize: 9.5,
            color: theme.statusResolved,
            border: `1px solid ${theme.statusResolved}44`,
            borderRadius: 4,
            padding: "1px 7px",
          }}
        >
          Autonomous — no sign-off required
        </div>
      </div>

      {override && (
        <div
          style={{
            fontSize: 11.5,
            color: theme.statusAwaiting,
            background: `${theme.statusAwaiting}14`,
            border: `1px solid ${theme.statusAwaiting}44`,
            borderRadius: 6,
            padding: "8px 12px",
            marginBottom: 18,
          }}
        >
          Field Command override — {override.text}
        </div>
      )}

      <TieredGraph
        tiers={tiers}
        approvalsById={approvalsById}
        onDecideApproval={onDecideApproval}
        emptyLabel="Identifying command chain…"
      />
    </div>
  );
}
