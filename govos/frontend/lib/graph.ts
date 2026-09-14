import { DistrictJurisdiction, Incident, NewsKind, Task } from "./types";
import { buildChain, OfficeNode } from "./chain";
import { TEAM_OFFICE } from "./offices";

export type NodeStatus = "idle" | "active" | "done" | "escalated" | "failed" | "informed";

export interface GraphNode {
  id: string;
  tier: number;
  label: string;
  eyebrow: string;
  role: string;
  message: string | null;
  status: NodeStatus;
  kind: "authority" | "agent";
}

const AUTHORITY_TIER: Record<string, number> = {
  "police-station": 2,
  "control-room": 2,
  "sdm-office": 1,
  "mla-office": 1,
  "dm-office": 1,
};

function authorityTier(node: OfficeNode): number {
  if (node.id.startsWith("auth-")) return 0;
  return AUTHORITY_TIER[node.id] ?? 1;
}

function taskStatusToNodeStatus(status: Task["status"]): NodeStatus {
  switch (status) {
    case "pending":
      return "idle";
    case "in_progress":
      return "active";
    case "completed":
      return "done";
    case "escalated":
      return "escalated";
    case "failed":
      return "failed";
  }
}

/** The command chain and the resources it tasks, as one connected graph
 * instead of two disjoint sections. Authorities occupy the top tiers (city
 * authority → SDM/MLA → local station/control room); the response units
 * doing the actual work sit in the bottom tier as live agent nodes whose
 * status updates as their task progresses. Returns tiers top-to-bottom,
 * each already sorted for stable left-to-right layout. Any human-override
 * event is deliberately excluded here — the caller renders it as a banner,
 * not a node, since it's an exception to the chain, not a step in it. */
export function buildGraph(incident: Incident): GraphNode[][] {
  const chain = buildChain(incident).filter((n) => n.id !== "field-override");

  const authorityNodes: GraphNode[] = chain.map((n) => ({
    id: n.id,
    tier: authorityTier(n),
    label: n.office,
    eyebrow: n.eyebrow,
    role: n.role,
    message: n.message,
    status: n.message ? "done" : "idle",
    kind: "authority",
  }));

  const maxAuthorityTier = authorityNodes.reduce((m, n) => Math.max(m, n.tier), 0);
  const agentTier = maxAuthorityTier + 1;

  const agentNodes: GraphNode[] = incident.tasks.map((t) => {
    const office = TEAM_OFFICE[t.owner_agent];
    return {
      id: `task-${t.id}`,
      tier: agentTier,
      label: t.owner_agent,
      eyebrow: office?.office ?? "Response unit",
      role: t.title,
      message: t.notes[t.notes.length - 1] ?? (t.ward ? t.ward : null),
      status: taskStatusToNodeStatus(t.status),
      kind: "agent",
    };
  });

  const byTier = new Map<number, GraphNode[]>();
  for (const node of [...authorityNodes, ...agentNodes]) {
    byTier.set(node.tier, [...(byTier.get(node.tier) ?? []), node]);
  }

  return [...byTier.entries()].sort((a, b) => a[0] - b[0]).map(([, nodes]) => nodes);
}

/** The real district-level authority chain for a geocoded news item —
 * every Delhi story gets this, not just the five pilot wards, since it's
 * built straight from delhi_districts.json (see news_feed.py) rather than
 * anything the response engine simulated. Every node's status is
 * "informed": this is jurisdiction on record, never a claim that dispatch
 * or authorization actually happened. */
export function buildDistrictGraph(jurisdiction: DistrictJurisdiction, kind: NewsKind): GraphNode[][] {
  const top: GraphNode[] = [
    {
      id: "ddma",
      tier: 0,
      label: jurisdiction.ddma,
      eyebrow: "GOVERNMENT OF NCT OF DELHI",
      role: "City-wide disaster coordination",
      message: null,
      status: "informed",
      kind: "authority",
    },
  ];
  if (kind === "crime") {
    top.push({
      id: "lg-office",
      tier: 0,
      label: jurisdiction.lg_office,
      eyebrow: "GOVERNMENT OF INDIA",
      role: "Constitutional authority — Delhi Police & public order",
      message: null,
      status: "informed",
      kind: "authority",
    });
  }

  const districtTier: GraphNode[] = [
    {
      id: "dm-office",
      tier: 1,
      label: jurisdiction.dm_office,
      eyebrow: "GNCTD — REVENUE DEPARTMENT",
      role: `${jurisdiction.district} — emergency sanction authority`,
      message: null,
      status: "informed",
      kind: "authority",
    },
    {
      id: "dcp-office",
      tier: 1,
      label: jurisdiction.dcp_office,
      eyebrow: "DELHI POLICE",
      role: `${jurisdiction.district} — law & order`,
      message: null,
      status: "informed",
      kind: "authority",
    },
  ];

  const civicTier: GraphNode[] = [
    {
      id: "mcd-zone",
      tier: 2,
      label: jurisdiction.mcd_zone,
      eyebrow: "MUNICIPAL CORPORATION OF DELHI",
      role: `${jurisdiction.district} — civic body`,
      message: null,
      status: "informed",
      kind: "authority",
    },
  ];

  return [top, districtTier, civicTier];
}
