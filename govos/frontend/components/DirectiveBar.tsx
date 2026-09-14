import { useState } from "react";
import { Directive } from "@/lib/types";
import { theme } from "@/lib/theme";
import { CURRENT_PERSONA } from "@/lib/personas";
import { DIRECTIVE_RECIPIENTS } from "@/lib/officesDirectory";
import { sendDirective } from "@/lib/useEventStream";

function timeLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** A direct line from the signed-in authority to a specific real office —
 * distinct from per-incident Comments, this isn't scoped to any one
 * incident. City-wide, in-memory (see backend/main.py), not part of the
 * durable audit trail the way approvals/comments are. */
export default function DirectiveBar({ directives, onSent }: { directives: Directive[]; onSent: () => void }) {
  const [to, setTo] = useState(DIRECTIVE_RECIPIENTS[0]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendDirective(CURRENT_PERSONA.name, CURRENT_PERSONA.role, to, trimmed);
      setText("");
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.border}` }}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.textPrimary }}>Message a Desk</span>
        <span style={{ fontSize: 11, color: theme.textMuted }}>{expanded ? "−" : "+"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{
              background: theme.bgElevated,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              color: theme.textPrimary,
              fontSize: 11.5,
              padding: "7px 8px",
              fontFamily: "inherit",
            }}
          >
            {DIRECTIVE_RECIPIENTS.map((office) => (
              <option key={office} value={office}>
                {office}
              </option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            rows={2}
            style={{
              resize: "vertical",
              background: theme.bgElevated,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              padding: "8px 10px",
              color: theme.textPrimary,
              fontSize: 11.5,
              fontFamily: "inherit",
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            style={{
              background: text.trim() ? theme.accentSoft : theme.bgElevated,
              color: text.trim() ? theme.textPrimary : theme.textMuted,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              padding: "7px 0",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: text.trim() && !sending ? "pointer" : "default",
            }}
          >
            {sending ? "Sending…" : "Send"}
          </button>

          {directives.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, maxHeight: 160, overflowY: "auto" }}>
              {directives.slice(0, 6).map((d) => (
                <div key={d.id} style={{ fontSize: 10.5, color: theme.textSecondary, lineHeight: 1.4 }}>
                  <span style={{ color: theme.textMuted }}>{timeLabel(d.created_at)} → </span>
                  <span style={{ fontWeight: 600, color: theme.textPrimary }}>{d.to_office}</span>
                  <div style={{ color: theme.textSecondary }}>{d.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
