import { Approval } from "@/lib/types";

export default function ApprovalCard({
  approval,
  onDecide,
}: {
  approval: Approval;
  onDecide: (approve: boolean) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #e0b34d66",
        background: "#221a0f",
        borderRadius: 8,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ color: "#e0b34d", fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>
        APPROVAL REQUIRED
      </div>
      <div style={{ color: "#eee", fontSize: 13.5 }}>{approval.action_summary}</div>
      {approval.amount_inr != null && (
        <div style={{ color: "#ccc", fontSize: 13 }}>
          Amount: ₹{approval.amount_inr.toLocaleString("en-IN")}
        </div>
      )}
      <div style={{ color: "#999", fontSize: 12 }}>
        {approval.evidence.map((e, i) => (
          <div key={i}>• {e}</div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={() => onDecide(true)}
          style={{
            background: "#2c5c3d",
            color: "#eafff0",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Approve
        </button>
        <button
          onClick={() => onDecide(false)}
          style={{
            background: "#3a2020",
            color: "#ffd9d9",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
