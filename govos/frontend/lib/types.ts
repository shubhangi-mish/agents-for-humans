export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "escalated";
export type IncidentStatus = "active" | "paused_for_approval" | "resolved";

export interface GovEvent {
  id: string;
  ts: number;
  agent: string;
  kind: string;
  text: string;
  data: Record<string, unknown>;
}

export interface Task {
  id: string;
  title: string;
  owner_agent: string;
  status: TaskStatus;
  ward: string | null;
  created_at: number;
  updated_at: number;
  notes: string[];
}

export interface Approval {
  id: string;
  reason: string;
  evidence: string[];
  action_summary: string;
  amount_inr: number | null;
  status: "pending" | "approved" | "rejected";
  authorized_by: string | null;
  authority_tier: string | null;
  created_at: number;
  resolved_at: number | null;
}

export interface Incident {
  id: string;
  title: string;
  scenario: string;
  location: string;
  source_headline: string | null;
  severity: string;
  status: IncidentStatus;
  affected_wards: string[];
  tasks: Task[];
  approvals: Approval[];
  events: GovEvent[];
  plan_state: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface StreamMessage {
  type: "event" | "state";
  phase: string;
  event?: GovEvent;
  incident?: Incident;
}
