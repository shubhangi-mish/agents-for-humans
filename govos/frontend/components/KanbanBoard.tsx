import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Approval, Incident, Task } from "@/lib/types";
import { TEAM_EMOJI } from "@/lib/teams";
import { TEAM_OFFICE } from "@/lib/offices";

type ColumnId = "todo" | "in_progress" | "blocked" | "done";

const COLUMNS: { id: ColumnId; label: string; color: string }[] = [
  { id: "todo", label: "To Do", color: "#777" },
  { id: "in_progress", label: "In Progress", color: "#5b9dd9" },
  { id: "blocked", label: "Blocked / Needs Decision", color: "#e0b34d" },
  { id: "done", label: "Done", color: "#6bbf7b" },
];

const CARD_TRANSITION = { type: "spring" as const, stiffness: 380, damping: 32 };

function columnForTask(status: Task["status"]): ColumnId {
  switch (status) {
    case "pending":
      return "todo";
    case "in_progress":
      return "in_progress";
    case "escalated":
    case "failed":
      return "blocked";
    case "completed":
      return "done";
  }
}

function TaskCard({ task }: { task: Task }) {
  const office = TEAM_OFFICE[task.owner_agent];
  return (
    <motion.div
      layoutId={`task-${task.id}`}
      layout
      transition={CARD_TRANSITION}
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        background: "#1a1a1a",
        border: "1px solid #2c2c2c",
        borderRadius: 8,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12.5, color: "#eee", fontWeight: 600 }}>{task.title}</div>
      <div style={{ fontSize: 11, color: "#888" }}>📍 {task.ward}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        <motion.span
          animate={task.status === "in_progress" || task.status === "escalated" ? { scale: [1, 1.15, 1] } : {}}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#111",
            border: "1px solid #333",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          {TEAM_EMOJI[task.owner_agent] ?? "🧑‍✈️"}
        </motion.span>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: 10.5, color: "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {office?.office ?? task.owner_agent}
          </span>
          {office && <span style={{ fontSize: 9.5, color: "#666" }}>{office.role}</span>}
        </div>
      </div>
      {task.notes.length > 0 && (
        <div style={{ fontSize: 10.5, color: "#777", borderTop: "1px solid #262626", paddingTop: 5, marginTop: 2 }}>
          {task.notes[task.notes.length - 1]}
        </div>
      )}
    </motion.div>
  );
}

function ApprovalCardCompact({
  approval,
  onDecide,
}: {
  approval: Approval;
  onDecide: (approve: boolean) => void;
}) {
  return (
    <motion.div
      layoutId={`appr-${approval.id}`}
      layout
      transition={CARD_TRANSITION}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        background: "#221a0f",
        border: "1px solid #e0b34d66",
        borderRadius: 8,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 10.5, color: "#e0b34d", fontWeight: 700, letterSpacing: 0.3 }}>APPROVAL NEEDED</div>
      <div style={{ fontSize: 12, color: "#eee" }}>{approval.action_summary}</div>
      {approval.amount_inr != null && (
        <div style={{ fontSize: 11, color: "#ccc" }}>₹{approval.amount_inr.toLocaleString("en-IN")}</div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
        <button
          onClick={() => onDecide(true)}
          style={{ flex: 1, background: "#2c5c3d", color: "#eafff0", border: "none", borderRadius: 5, padding: "5px 0", cursor: "pointer", fontSize: 11.5 }}
        >
          Approve
        </button>
        <button
          onClick={() => onDecide(false)}
          style={{ flex: 1, background: "#3a2020", color: "#ffd9d9", border: "none", borderRadius: 5, padding: "5px 0", cursor: "pointer", fontSize: 11.5 }}
        >
          Reject
        </button>
      </div>
    </motion.div>
  );
}

export default function KanbanBoard({
  incident,
  onDecideApproval,
}: {
  incident: Incident;
  onDecideApproval: (approvalId: string, approve: boolean) => void;
}) {
  const pendingApprovals = incident.approvals.filter((a) => a.status === "pending");

  return (
    <LayoutGroup>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "start" }}>
        {COLUMNS.map((col) => {
          const tasks = incident.tasks.filter((t) => columnForTask(t.status) === col.id);
          const approvalsHere = col.id === "blocked" ? pendingApprovals : [];
          const count = tasks.length + approvalsHere.length;

          return (
            <div
              key={col.id}
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 90,
                background: "#141414",
                border: "1px solid #262626",
                borderRadius: 10,
                padding: 10,
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#ccc", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  {col.label}
                </span>
                <motion.span
                  key={count}
                  initial={{ scale: 1.4, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{ fontSize: 11, color: "#666", marginLeft: "auto" }}
                >
                  {count}
                </motion.span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", minHeight: 0 }}>
                <AnimatePresence>
                  {approvalsHere.map((a) => (
                    <ApprovalCardCompact key={a.id} approval={a} onDecide={(approve) => onDecideApproval(a.id, approve)} />
                  ))}
                  {tasks.map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                </AnimatePresence>
                {count === 0 && <div style={{ fontSize: 11, color: "#444", padding: "6px 2px" }}>Nothing here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
