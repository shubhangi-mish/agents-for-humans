import { GovEvent } from "@/lib/types";
import { theme } from "@/lib/theme";

const KIND_COLOR: Record<string, string> = {
  system: theme.textMuted,
  reasoning: theme.statusActive,
  decision: theme.statusAwaiting,
  task_created: theme.statusResolved,
  tool_call: theme.kindCrime,
  message: theme.statusResolved,
  approval_required: theme.statusFailed,
  event: theme.statusFailed,
  briefing: theme.textPrimary,
  error: theme.statusFailed,
};

function timeLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function EventStream({ events }: { events: GovEvent[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", height: "100%" }}>
      {events.length === 0 && <div style={{ color: theme.textMuted, fontSize: 13 }}>Waiting for incident activity…</div>}
      {[...events].reverse().map((e) => (
        <div key={e.id} style={{ fontSize: 12.5, lineHeight: 1.4, display: "flex", gap: 8 }}>
          <span style={{ color: theme.textMuted, flexShrink: 0 }}>{timeLabel(e.ts)}</span>
          <span
            style={{
              color: KIND_COLOR[e.kind] ?? theme.textSecondary,
              fontWeight: 600,
              flexShrink: 0,
              minWidth: 90,
            }}
          >
            {e.agent}
          </span>
          <span style={{ color: theme.textSecondary }}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
