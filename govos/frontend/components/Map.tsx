import { Task } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  pending: "#555",
  in_progress: "#5b9dd9",
  completed: "#6bbf7b",
  failed: "#e0684d",
  escalated: "#e0b34d",
};

export default function Map({ affectedWards, tasks }: { affectedWards: string[]; tasks: Task[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Affected zones
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {affectedWards.length === 0 && <span style={{ color: "#555", fontSize: 13 }}>None yet</span>}
        {affectedWards.map((w) => (
          <div
            key={w}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: "#2a1414",
              border: "1px solid #e0684d55",
              color: "#e0a08c",
              fontSize: 12,
            }}
          >
            {w}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 }}>
        Tasks
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
        {tasks.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12.5,
              padding: "6px 8px",
              borderRadius: 4,
              background: "#161616",
              border: "1px solid #262626",
            }}
          >
            <span style={{ color: "#ddd" }}>
              {t.title} <span style={{ color: "#666" }}>· {t.ward}</span>
            </span>
            <span style={{ color: STATUS_COLOR[t.status], fontWeight: 600 }}>{t.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
