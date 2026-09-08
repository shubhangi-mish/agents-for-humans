import { GovEvent } from "@/lib/types";

const KIND_COLOR: Record<string, string> = {
  system: "#7c8794",
  reasoning: "#5b9dd9",
  decision: "#e0b34d",
  task_created: "#6bbf7b",
  tool_call: "#a889d8",
  message: "#4dbf9e",
  approval_required: "#e0684d",
  event: "#e0684d",
  briefing: "#ffffff",
  error: "#ff5c5c",
};

function timeLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function EventStream({ events }: { events: GovEvent[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", height: "100%" }}>
      {events.length === 0 && <div style={{ color: "#666", fontSize: 13 }}>Waiting for incident activity…</div>}
      {[...events].reverse().map((e) => (
        <div key={e.id} style={{ fontSize: 12.5, lineHeight: 1.4, display: "flex", gap: 8 }}>
          <span style={{ color: "#666", flexShrink: 0 }}>{timeLabel(e.ts)}</span>
          <span
            style={{
              color: KIND_COLOR[e.kind] ?? "#ccc",
              fontWeight: 600,
              flexShrink: 0,
              minWidth: 90,
            }}
          >
            {e.agent}
          </span>
          <span style={{ color: "#d8d8d8" }}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
