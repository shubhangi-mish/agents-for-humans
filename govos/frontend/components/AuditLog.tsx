import { AuditRow } from "@/lib/types";
import { theme } from "@/lib/theme";

function timeLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const COLUMNS = "1.7fr 1.1fr 1fr 0.7fr 1fr 0.7fr";

function HeaderRow() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: COLUMNS,
        gap: 16,
        padding: "12px 20px",
        borderBottom: `1px solid ${theme.border}`,
        fontSize: 10,
        color: theme.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        fontWeight: 700,
      }}
    >
      <div>Action</div>
      <div>Authorized by</div>
      <div>Authority tier</div>
      <div>Amount</div>
      <div>Status</div>
      <div>When</div>
    </div>
  );
}

function Row({ row, onOpenIncident }: { row: AuditRow; onOpenIncident: (id: string) => void }) {
  const overridden = !!row.overridden_by;
  return (
    <div
      onClick={() => onOpenIncident(row.incident_id)}
      style={{
        display: "grid",
        gridTemplateColumns: COLUMNS,
        gap: 16,
        alignItems: "center",
        padding: "16px 20px",
        borderBottom: `1px solid ${theme.border}`,
        cursor: "pointer",
      }}
    >
      <div>
        <div style={{ fontSize: 12.5, color: theme.textPrimary, fontWeight: 600, lineHeight: 1.4 }}>{row.action_summary}</div>
        <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 3 }}>{row.incident_title}</div>
      </div>
      <div style={{ fontSize: 11.5, color: theme.textSecondary, lineHeight: 1.4 }}>{row.authorized_by ?? "—"}</div>
      <div style={{ fontSize: 10.5, color: theme.textMuted, lineHeight: 1.4 }}>{row.authority_tier ?? "Auto-approved (SOP)"}</div>
      <div style={{ fontSize: 11.5, color: theme.textSecondary }}>
        {row.amount_inr ? `₹${row.amount_inr.toLocaleString("en-IN")}` : "—"}
      </div>
      <div>
        {overridden ? (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: row.status === "rejected" ? theme.statusFailed : theme.statusResolved }}>
            {row.status === "rejected" ? "Overridden" : "Confirmed"}
          </span>
        ) : (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: theme.accent }}>Standing</span>
        )}
        {overridden && <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>by {row.overridden_by}</div>}
      </div>
      <div style={{ fontSize: 10.5, color: theme.textMuted }}>{timeLabel(row.created_at)}</div>
    </div>
  );
}

/** The CM's (or any signed-in authority's) city-wide oversight view — every
 * authorization across every incident, who signed off under what real
 * delegated tier, and whether anyone has since intervened. This is the
 * "account-wise" accountability layer: nothing here is anonymous. */
export default function AuditLog({
  rows,
  loading,
  onRefresh,
  onOpenIncident,
}: {
  rows: AuditRow[];
  loading: boolean;
  onRefresh: () => void;
  onOpenIncident: (id: string) => void;
}) {
  return (
    <div style={{ padding: "40px 48px 60px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 20 }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.8, color: theme.textPrimary, marginBottom: 10 }}>
            Audit Log
          </div>
          <div style={{ fontSize: 14, color: theme.textMuted, maxWidth: 620, lineHeight: 1.6 }}>
            Every authorization across every incident, city-wide — who signed off, under what real delegated
            authority, and whether it's since been overridden. Nothing here is anonymous.
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: theme.bgElevated,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            color: theme.textSecondary,
            fontSize: 12,
            padding: "8px 16px",
            cursor: loading ? "default" : "pointer",
            flexShrink: 0,
          }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div style={{ background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: "hidden" }}>
        <HeaderRow />
        {rows.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 12.5, color: theme.textMuted, fontStyle: "italic" }}>
            No authorizations recorded yet.
          </div>
        ) : (
          rows.map((row) => <Row key={row.id} row={row} onOpenIncident={onOpenIncident} />)
        )}
      </div>
    </div>
  );
}
