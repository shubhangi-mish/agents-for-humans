import { Incident } from "./types";

export interface OfficeNode {
  id: "control-room" | "district-control" | "commissioner" | "cm-office" | "field-command";
  office: string;
  officer: string;
  role: string;
  message: string | null;
}

const NARROW_ESCALATION_THRESHOLD = 1_000_000;

/** Every possible office slot in fixed order, for a static scene layout. */
export const ALL_OFFICE_SLOTS: Omit<OfficeNode, "message">[] = [
  { id: "control-room", office: "MCD South Zone — Disaster Management Cell", officer: "Duty Officer R. Sharma", role: "Control Room" },
  { id: "district-control", office: "DCP South West District Control Room", officer: "Officer-in-Charge S. Verma", role: "District Control" },
  { id: "commissioner", office: "Commissioner's Office", officer: "Coordination Officer A. Bhatia", role: "City Coordination" },
  { id: "cm-office", office: "CM Office — Situation Room", officer: "Situation Officer M. Iyer", role: "State Situation Desk" },
  { id: "field-command", office: "Field Command", officer: "You", role: "Decision" },
];

/** Dynamically assembles the office chain for this specific incident — which
 * offices even get involved is derived from the incident's own real events,
 * not a fixed roster. A small issue never reaches beyond the control room;
 * a large one climbs all the way up. Officer names are fictional
 * placeholders for "who's on duty at that desk" — the office is real, the
 * person is not a real official. */
export function buildChain(incident: Incident): OfficeNode[] {
  const events = incident.events;
  const findLast = (pred: (e: Incident["events"][number]) => boolean) => [...events].reverse().find(pred);

  const chain: OfficeNode[] = [];

  const intel = findLast((e) => e.agent === "intel_agent" && e.kind === "reasoning");
  const resource = findLast((e) => e.agent === "resource_agent" && e.kind === "reasoning");
  chain.push({ ...ALL_OFFICE_SLOTS[0], message: (resource ?? intel)?.text ?? null });

  const approval = incident.approvals[0];
  const policyDecision = findLast(
    (e) => e.agent === "policy_agent" && e.kind === "decision" && e.text.includes("REQUIRES_APPROVAL")
  );
  if (approval || policyDecision) {
    chain.push({ ...ALL_OFFICE_SLOTS[1], message: policyDecision?.text ?? approval?.action_summary ?? null });
  }

  const orchestrator = findLast((e) => e.agent === "orchestrator" && e.kind === "reasoning");
  if (orchestrator) {
    chain.push({ ...ALL_OFFICE_SLOTS[2], message: orchestrator.text });
  }

  const needsNdrf = incident.tasks.some((t) => t.owner_agent === "NDRF Response Team");
  const bigApproval = incident.approvals.find((a) => (a.amount_inr ?? 0) >= NARROW_ESCALATION_THRESHOLD);
  if (needsNdrf || bigApproval) {
    chain.push({
      ...ALL_OFFICE_SLOTS[3],
      message: bigApproval
        ? `Briefed — ₹${bigApproval.amount_inr!.toLocaleString("en-IN")} emergency procurement authorized.`
        : "Briefed on NDRF specialist deployment.",
    });
  }

  const humanDecision = findLast((e) => e.agent === "human" && e.kind === "decision");
  if (humanDecision) {
    const approved = humanDecision.text.startsWith("Human approved");
    chain.push({
      ...ALL_OFFICE_SLOTS[4],
      role: approved ? "Order approved" : "Order rejected",
      message: humanDecision.text,
    });
  }

  return chain;
}
