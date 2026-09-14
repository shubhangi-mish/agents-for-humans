import { useState } from "react";
import { AuditRow } from "@/lib/types";
import { theme } from "@/lib/theme";
import { CURRENT_ACTOR } from "@/lib/personas";
import { resolveApproval } from "@/lib/useEventStream";

const MAX_SHOWN = 5;

function Row({ row, onOpenIncident, onDecided }: { row: AuditRow; onOpenIncident: (id: string) => void; onDecided: () => void }) {
  const [busy, setBusy] = useState<"confirm" | "override" | null>(null);

  async function decide(approve: boolean, which: "confirm" | "override") {
    setBusy(which);
    try {
      await resolveApproval(row.incident_id, row.id, approve, CURRENT_ACTOR);
      onDecided();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ padding: "12px 14px", background: theme.bgElevated, border: `1px solid ${theme.border}`, borderRadius: 8 }}>
      <div
        onClick={() => onOpenIncident(row.incident_id)}
        style={{ fontSize: 11.5, color: theme.textPrimary, fontWeight: 600, lineHeight: 1.4, cursor: "pointer" }}
      >
        {row.action_summary}
      </div>
      <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 3 }}>
        {row.incident_title}
        {row.amount_inr ? ` · ₹${row.amount_inr.toLocaleString("en-IN")}` : ""}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button
          disabled={!!busy}
          onClick={() => decide(true, "confirm")}
          style={{ flex: 1, background: theme.accentSoft, color: theme.textPrimary, border: "none", borderRadius: 5, padding: "6px 0", fontSize: 10.5, cursor: busy ? "default" : "pointer" }}
        >
          {busy === "confirm" ? "…" : "Confirm"}
        </button>
        <button
          disabled={!!busy}
          onClick={() => decide(false, "override")}
          style={{ flex: 1, background: "#3a2020", color: "#ffd9d9", border: "none", borderRadius: 5, padding: "6px 0", fontSize: 10.5, cursor: busy ? "default" : "pointer" }}
        >
          {busy === "override" ? "…" : "Override"}
        </button>
      </div>
    </div>
  );
}

/** DDMA is chaired by the Chief Minister — so any action the system
 * auto-authorized under that tier is, in effect, a decision taken in the
 * CM's name before the CM has actually seen it. This queue surfaces
 * exactly those, city-wide, so a real sign-off (confirm) or veto
 * (override) can catch up to what already happened. */
export default function SignOffQueue({
  rows,
  onOpenIncident,
  onRefresh,
}: {
  rows: AuditRow[];
  onOpenIncident: (id: string) => void;
  onRefresh: () => void;
}) {
  const pending = rows.filter((r) => r.authority_tier?.includes("DDMA") && !r.overridden_by).slice(0, MAX_SHOWN);

  return (
    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.textPrimary }}>Pending Your Sign-Off</span>
        {pending.length > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: theme.statusAwaiting,
              background: `${theme.statusAwaiting}22`,
              borderRadius: 999,
              padding: "1px 7px",
            }}
          >
            {pending.length}
          </span>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: theme.textMuted, marginBottom: 12 }}>
        Actions auto-authorized under DDMA — chaired by you — awaiting your confirmation or veto.
      </div>

      {pending.length === 0 ? (
        <div style={{ fontSize: 11, color: theme.textMuted, fontStyle: "italic" }}>Nothing awaiting review.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pending.map((row) => (
            <Row key={row.id} row={row} onOpenIncident={onOpenIncident} onDecided={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}
