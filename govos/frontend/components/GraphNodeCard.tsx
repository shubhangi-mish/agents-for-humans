import { useState } from "react";
import { motion } from "framer-motion";
import { Approval } from "@/lib/types";
import { GraphNode, NodeStatus } from "@/lib/graph";
import { theme } from "@/lib/theme";

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const STATUS_DOT: Record<NodeStatus, string> = {
  idle: theme.textMuted,
  active: theme.statusActive,
  done: theme.statusResolved,
  escalated: theme.statusAwaiting,
  failed: theme.statusFailed,
  informed: theme.accent,
};

const STATUS_TEXT: Record<NodeStatus, string> = {
  idle: "Not yet reached",
  active: "In progress",
  done: "Complete",
  escalated: "Escalated",
  failed: "Failed",
  informed: "On record",
};

const MESSAGE_PREVIEW_LEN = 150;

/** One node in a command/response graph — either a live incident node
 * (CommandGraph, status updates as the task/authorization actually
 * progresses) or a static jurisdiction node (DistrictGraph, "informed" is
 * the only status it ever has). Click any node with a longer message to
 * expand it in place instead of reading a truncated snippet. */
export default function GraphNodeCard({
  node,
  approval,
  onDecideApproval,
}: {
  node: GraphNode;
  approval?: Approval;
  onDecideApproval?: ((approvalId: string, approve: boolean) => void) | null;
}) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dot = STATUS_DOT[node.status];
  const messageIsLong = !!node.message && node.message.length > MESSAGE_PREVIEW_LEN;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      onClick={() => messageIsLong && setExpanded((v) => !v)}
      style={{
        position: "relative",
        width: 236,
        background: theme.panel,
        border: `1px solid ${node.status === "active" ? `${theme.accent}88` : theme.border}`,
        borderRadius: 8,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: messageIsLong ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <motion.span
          animate={node.status === "active" ? { opacity: [1, 0.35, 1] } : {}}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }}
        />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: dot }}>
          {STATUS_TEXT[node.status]}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 8.5,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: theme.textMuted,
            border: `1px solid ${theme.border}`,
            borderRadius: 3,
            padding: "1px 5px",
          }}
        >
          {node.kind === "agent" ? "Agent" : "Office"}
        </span>
      </div>

      <div>
        <div style={{ fontSize: 9, color: theme.textMuted, letterSpacing: 0.3, marginBottom: 2 }}>{node.eyebrow}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.textPrimary, lineHeight: 1.35 }}>{node.label}</div>
        <div style={{ fontSize: 10.5, color: theme.textSecondary, marginTop: 2 }}>{node.role}</div>
      </div>

      {node.message && (
        <div
          style={{
            fontSize: 10.5,
            color: theme.textSecondary,
            lineHeight: 1.5,
            borderTop: `1px solid ${theme.border}`,
            paddingTop: 8,
          }}
        >
          {expanded ? node.message : truncate(node.message, MESSAGE_PREVIEW_LEN)}
          {messageIsLong && (
            <span style={{ color: theme.accent, marginLeft: 4, fontSize: 9.5 }}>{expanded ? "less" : "more"}</span>
          )}
        </div>
      )}

      {approval && onDecideApproval && (
        <div style={{ marginTop: 2 }} onClick={(e) => e.stopPropagation()}>
          {!overrideOpen ? (
            <button
              onClick={() => setOverrideOpen(true)}
              style={{ background: "none", border: "none", padding: 0, color: theme.textMuted, fontSize: 10, textDecoration: "underline", cursor: "pointer" }}
            >
              Field Command override…
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => onDecideApproval(approval.id, true)}
                style={{ flex: 1, background: theme.accentSoft, color: theme.textPrimary, border: "none", borderRadius: 4, padding: "5px 0", cursor: "pointer", fontSize: 11 }}
              >
                Confirm
              </button>
              <button
                onClick={() => onDecideApproval(approval.id, false)}
                style={{ flex: 1, background: "#3a2020", color: "#ffd9d9", border: "none", borderRadius: 4, padding: "5px 0", cursor: "pointer", fontSize: 11 }}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
