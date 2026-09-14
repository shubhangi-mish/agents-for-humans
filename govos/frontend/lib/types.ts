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
  // Set for an incident outside the five pilot wards — its real geocoded
  // coordinates, so the map can pin it without a REAL_LOCATIONS lookup.
  lat: number | null;
  lng: number | null;
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

export type NewsKind = "fire" | "collapse" | "flood" | "crime" | "accident" | "other";

export interface DistrictJurisdiction {
  district: string;
  dm_office: string;
  dcp_office: string;
  mcd_zone: string;
  cm_office: string;
  ddma: string;
  lg_office: string;
  police_commissioner: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  link: string;
  source: string;
  published: string | null;
  kind: NewsKind;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  district: string | null;
  jurisdiction: DistrictJurisdiction | null;
  fetched_at: number;
}
