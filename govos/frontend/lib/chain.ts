import { DistrictJurisdiction, GovEvent, Incident } from "./types";

export interface OfficeNode {
  id: string;
  office: string;
  officer: string;
  role: string;
  eyebrow: string;
  message: string | null;
}

interface WardJurisdiction {
  assembly_constituency: string;
  mla_office: string;
  lok_sabha_constituency: string;
  mp_office: string;
  sdm_subdivision: string;
  sdm_office: string;
  police_station: string;
  police_district: string;
  mcd_ward: string;
  mcd_zone: string;
  djb_zone: string;
  discom: string;
}

type Jurisdiction = WardJurisdiction | DistrictJurisdiction;

function isWardJurisdiction(j: Jurisdiction): j is WardJurisdiction {
  return "police_station" in j;
}

function findLast(events: GovEvent[], pred: (e: GovEvent) => boolean): GovEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (pred(events[i])) return events[i];
  }
  return undefined;
}

function officerFor(office: string): string {
  if (office.includes("SDM")) return "Sub-Divisional Magistrate on duty";
  if (office.includes("District Magistrate")) return "Duty Officer S. Verma";
  if (office.includes("Commissioner of Police")) return "Coordination Officer V. Menon";
  if (office.includes("DCP")) return "Station Coordination Officer";
  if (office.includes("DDMA")) return "Situation Officer M. Iyer";
  if (office.includes("MLA")) return "Constituency Office Secretary A. Bhatia";
  if (office.includes("PS ") || office.toLowerCase().includes("police station")) return "Station House Officer R. Sharma";
  return "Control Room Duty Officer P. Singh";
}

function eyebrowFor(office: string): string {
  if (office.includes("Commissioner of Police") || office.includes("DCP") || office.startsWith("PS ")) return "DELHI POLICE";
  if (office.includes("MLA") || office.includes("DDMA")) return "GOVERNMENT OF NCT OF DELHI";
  if (office.includes("SDM") || office.includes("District Magistrate")) return "GNCTD — REVENUE DEPARTMENT";
  return "MUNICIPAL CORPORATION OF DELHI";
}

/** Assembles the real jurisdiction chain for this specific incident. Which
 * offices show up, and in what order, comes entirely from the incident's own
 * events. A pilot-ward incident resolves ward-level jurisdiction (police
 * station, SDM, MLA); anywhere else in Delhi resolves the coarser but still
 * real district-level jurisdiction (DCP, District Magistrate) — see
 * incident_engine._resolve_jurisdiction. Each authority tier (District
 * Magistrate / Police Commissioner / DDMA) appears only if that incident
 * actually needed it. Nothing here is a fixed ladder, and nothing waits on a
 * human — every node's message is already a resolved action, not a pending
 * request. Officer names are fictional placeholders for "who's on duty at
 * that desk"; the office itself is real. */
export function buildChain(incident: Incident): OfficeNode[] {
  const events = incident.events;
  const chain: OfficeNode[] = [];

  const jurisdictionEvt = findLast(events, (e) => e.kind === "jurisdiction");
  const jurisdiction = jurisdictionEvt?.data?.jurisdiction as Jurisdiction | undefined;

  if (jurisdiction) {
    if (isWardJurisdiction(jurisdiction)) {
      chain.push({
        id: "police-station",
        office: jurisdiction.police_station,
        officer: officerFor(jurisdiction.police_station),
        role: `${jurisdiction.police_district} — cordon & law and order`,
        eyebrow: "DELHI POLICE",
        message: `Cordon and crowd-control support requested for ${incident.affected_wards[0] ?? incident.location}.`,
      });
    } else {
      chain.push({
        id: "police-station",
        office: jurisdiction.dcp_office,
        officer: officerFor(jurisdiction.dcp_office),
        role: `${jurisdiction.district} — cordon & law and order`,
        eyebrow: "DELHI POLICE",
        message: `Cordon and crowd-control support requested for ${incident.affected_wards[0] ?? incident.location}.`,
      });
    }
  }

  const resource = findLast(events, (e) => e.agent === "resource_agent" && e.kind === "reasoning");
  const intel = findLast(events, (e) => e.agent === "intel_agent" && e.kind === "reasoning");
  chain.push({
    id: "control-room",
    office: jurisdiction?.mcd_zone ?? "MCD South Zone — Disaster Management Cell",
    officer: officerFor(jurisdiction?.mcd_zone ?? ""),
    role: jurisdiction
      ? isWardJurisdiction(jurisdiction)
        ? `${jurisdiction.mcd_ward} — zonal control room`
        : `${jurisdiction.district} — civic control room`
      : "Zonal control room",
    eyebrow: "MUNICIPAL CORPORATION OF DELHI",
    message: (resource ?? intel)?.text ?? null,
  });

  if (jurisdiction) {
    if (isWardJurisdiction(jurisdiction)) {
      chain.push({
        id: "sdm-office",
        office: jurisdiction.sdm_office,
        officer: officerFor(jurisdiction.sdm_office),
        role: `SDM, ${jurisdiction.sdm_subdivision} subdivision`,
        eyebrow: "GNCTD — REVENUE DEPARTMENT",
        message: `On-ground coordination briefing received for ${incident.affected_wards.join(", ")}.`,
      });

      chain.push({
        id: "mla-office",
        office: jurisdiction.mla_office,
        officer: officerFor(jurisdiction.mla_office),
        role: `MLA, ${jurisdiction.assembly_constituency}`,
        eyebrow: "GOVERNMENT OF NCT OF DELHI",
        message: `Constituency briefed — response under way in ${incident.affected_wards.join(", ")}.`,
      });
    } else {
      chain.push({
        id: "dm-office",
        office: jurisdiction.dm_office,
        officer: officerFor(jurisdiction.dm_office),
        role: `${jurisdiction.district} — emergency sanction authority`,
        eyebrow: "GNCTD — REVENUE DEPARTMENT",
        message: `District briefing received for ${incident.affected_wards.join(", ")}.`,
      });
    }
  }

  for (const approval of incident.approvals) {
    if (!approval.authorized_by) continue;
    chain.push({
      id: `auth-${approval.id}`,
      office: approval.authorized_by,
      officer: officerFor(approval.authorized_by),
      role: approval.authority_tier ?? "Authorizing office",
      eyebrow: eyebrowFor(approval.authorized_by),
      message: `Authorized — ${approval.action_summary}${
        approval.amount_inr ? ` (₹${approval.amount_inr.toLocaleString("en-IN")})` : ""
      }.`,
    });
  }

  const override = findLast(events, (e) => e.agent === "human_override" && e.kind === "decision");
  if (override) {
    const rejected = override.text.toLowerCase().includes("rejected");
    chain.push({
      id: "field-override",
      office: "Field Command",
      officer: "Duty Officer on shift",
      role: rejected ? "Human override — rejected" : "Human override — confirmed",
      eyebrow: "INCIDENT COMMAND",
      message: override.text,
    });
  }

  return chain;
}
