import { Incident } from "@/lib/types";

interface OfficeNode {
  id: string;
  title: string;
  avatar: string;
  message: string | null;
}

const NARROW_ESCALATION_THRESHOLD = 1_000_000;

/** Dynamically assembles the office/officer chain for this specific
 * incident — which offices even get involved is derived from the
 * incident's own real events, not a fixed roster. A small issue never
 * reaches beyond the control room; a large one climbs all the way up. */
function buildChain(incident: Incident): OfficeNode[] {
  const events = incident.events;
  const findLast = (pred: (e: Incident["events"][number]) => boolean) => [...events].reverse().find(pred);

  const chain: OfficeNode[] = [];

  const intel = findLast((e) => e.agent === "intel_agent" && e.kind === "reasoning");
  const resource = findLast((e) => e.agent === "resource_agent" && e.kind === "reasoning");
  chain.push({
    id: "control-room",
    title: "MCD Control Room",
    avatar: "🧑‍💻",
    message: (resource ?? intel)?.text ?? null,
  });

  const approval = incident.approvals[0];
  const policyDecision = findLast(
    (e) => e.agent === "policy_agent" && e.kind === "decision" && e.text.includes("REQUIRES_APPROVAL")
  );
  if (approval || policyDecision) {
    chain.push({
      id: "district-control",
      title: "DCP District Control",
      avatar: "👮",
      message: policyDecision?.text ?? approval?.action_summary ?? null,
    });
  }

  const orchestrator = findLast((e) => e.agent === "orchestrator" && e.kind === "reasoning");
  if (orchestrator) {
    chain.push({ id: "commissioner", title: "Commissioner's Office", avatar: "🧑‍💼", message: orchestrator.text });
  }

  const needsNdrf = incident.tasks.some((t) => t.owner_agent === "NDRF Response Team");
  const bigApproval = incident.approvals.find((a) => (a.amount_inr ?? 0) >= NARROW_ESCALATION_THRESHOLD);
  if (needsNdrf || bigApproval) {
    chain.push({
      id: "cm-office",
      title: "CM Office — Situation Room",
      avatar: "🏛️",
      message: bigApproval
        ? `Briefed — ₹${bigApproval.amount_inr!.toLocaleString("en-IN")} emergency procurement authorized.`
        : "Briefed on NDRF specialist deployment.",
    });
  }

  const humanDecision = findLast((e) => e.agent === "human" && e.kind === "decision");
  if (humanDecision) {
    const approved = humanDecision.text.startsWith("Human approved");
    chain.push({
      id: "field-command",
      title: approved ? "Order approved" : "Order rejected",
      avatar: approved ? "✅" : "🛑",
      message: humanDecision.text,
    });
  }

  return chain;
}

export default function OfficeChain({ incident }: { incident: Incident }) {
  const chain = buildChain(incident);
  const latest = chain[chain.length - 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: "#777", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Chain of command
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {chain.map((node, i) => (
          <span key={node.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              title={`${node.title}${node.message ? `\n\n${node.message}` : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 999,
                padding: "3px 10px 3px 6px",
                fontSize: 11.5,
                color: "#ccc",
                cursor: "default",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#111",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                }}
              >
                {node.avatar}
              </span>
              {node.title}
            </span>
            {i < chain.length - 1 && <span style={{ color: "#444" }}>→</span>}
          </span>
        ))}
      </div>
      {latest?.message && (
        <div style={{ fontSize: 12, color: "#999", lineHeight: 1.4, marginTop: 2 }}>
          <span style={{ color: "#666" }}>📩 {latest.title}: </span>
          {latest.message.length > 220 ? `${latest.message.slice(0, 220)}…` : latest.message}
        </div>
      )}
    </div>
  );
}
