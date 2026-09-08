import { Incident } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused_for_approval: "Paused — awaiting approval",
  resolved: "Resolved",
};

export default function DecisionStack({ incident }: { incident: Incident }) {
  const lastDecision = [...incident.events].reverse().find((e) => e.kind === "decision" || e.kind === "reasoning");
  const completed = incident.tasks.filter((t) => t.status === "completed").length;
  const escalations = incident.tasks.filter((t) => t.status === "escalated").length;
  const approvals = incident.approvals.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>Status</div>
        <div style={{ fontSize: 15, color: "#eee", fontWeight: 600 }}>{STATUS_LABEL[incident.status]}</div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Latest reasoning
        </div>
        <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.5 }}>
          {lastDecision?.text ?? "—"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <Stat label="Tasks done" value={completed} />
        <Stat label="Escalations" value={escalations} />
        <Stat label="Approvals" value={approvals} />
        <Stat label="Agent actions" value={incident.events.length} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#777" }}>{label}</div>
    </div>
  );
}
