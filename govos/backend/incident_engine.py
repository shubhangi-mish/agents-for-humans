"""The incident state machine.

This is the orchestration harness around the Strands agents: it sequences
calls to Intel / Resource / Comms / Policy / Orchestrator, persists
structured state (tasks, approvals, events) that the frontend god-view
renders, and owns the two demo-critical behaviors — the failure/replanning
beat and the real-jurisdiction auto-authorization beat (see AUTHORITY_TIERS
and _select_authority below: whichever real office actually holds the
authority for an action resolves it itself, instantly — nothing here ever
pauses waiting for a person). The Strands agents provide the reasoning text
that gets logged alongside each deterministic state change; they don't need
to also manage task bookkeeping, which keeps the demo reliable.
"""

from __future__ import annotations

from agents import (
    build_comms_agent,
    build_intel_agent,
    build_orchestrator_agent,
    build_policy_agent,
    build_resource_agent,
)
from agents import tools
from agents.base import run_agent_turn
from models import Approval, Incident, IncidentStatus, Task, TaskStatus, now

HOSPITAL_TASK_KEY = "hospital_access_task_id"

# Real delegated-authority tiers. Nothing in this engine ever blocks waiting
# for a person to click a button — every action either gets auto-approved by
# the Policy Agent against the SOP, or gets instantly authorized by whichever
# real office actually holds that authority in practice (DDMA Act emergency
# powers for the District Magistrate; NDRF requisition and city-wide law &
# order sit with the Police Commissioner; only a genuinely multi-district or
# public-broadcast action goes to DDMA). A human can still override a
# decision after the fact via /approve, but resolving the incident never
# depends on one doing so.
AUTHORITY_TIERS = {
    "district_magistrate": {
        "office": "District Magistrate (Deputy Commissioner)",
        "tier": "DDMA Act emergency sanction (District Magistrate)",
        "max_inr": 2_000_000,
    },
    "police_commissioner": {
        "office": "Office of the Commissioner of Police, Delhi",
        "tier": "City-wide law & order / specialist-force sanction (Police Commissioner)",
        "max_inr": None,
    },
    "ddma": {
        "office": "Delhi Disaster Management Authority (DDMA)",
        "tier": "City-wide disaster sanction / multi-district mutual aid (DDMA)",
        "max_inr": None,
    },
}


def _select_authority(action_summary: str, amount_inr: float | None) -> dict:
    lowered = action_summary.lower()
    if "ndrf" in lowered or "broadcast" in lowered:
        return AUTHORITY_TIERS["police_commissioner"]
    dm_ceiling = AUTHORITY_TIERS["district_magistrate"]["max_inr"]
    if amount_inr is not None and amount_inr > dm_ceiling:
        return AUTHORITY_TIERS["ddma"]
    return AUTHORITY_TIERS["district_magistrate"]


def _primary_jurisdiction(incident: Incident) -> dict | None:
    for ward_id in incident.plan_state.get("affected_ward_ids", []):
        jurisdiction = tools.get_jurisdiction(ward_id)
        if jurisdiction:
            return jurisdiction
    return None


SCENARIO_TITLES = {
    "building_collapse": "Building Collapse Response — {location}",
    "flood": "Flood Response — South Delhi",
}
# Task templates are keyed by scenario so both scenarios can reuse the same
# real-institution team roster in directory.json (see its _note).
HOSPITAL_TASK_TITLE = {
    "building_collapse": "Casualty evacuation — hospital access",
    "flood": "Hospital access check",
}


def _log_text(incident: Incident) -> str:
    return "\n".join(f"[{e.agent}] {e.text}" for e in incident.events)


async def start_incident(trigger: dict) -> Incident:
    scenario = trigger.get("scenario", "building_collapse")
    location = trigger.get("location", "Satya Niketan")
    title = SCENARIO_TITLES.get(scenario, SCENARIO_TITLES["building_collapse"]).format(location=location)
    headline = trigger.get("source_headline")
    incident = Incident(title=title, scenario=scenario, location=location, severity="high", source_headline=headline)
    incident.plan_state["scenario"] = scenario

    system_text = f"Incident triggered ({scenario}) via EventBridge. No human prompt."
    if headline:
        system_text += (
            f' Signal source: live news — "{headline}" (headline used only to '
            "decide the incident type; location and response are this "
            "system's own simulated South Delhi scenario, not the real story's "
            "location or details)."
        )
    incident.log("system", "system", system_text, trigger=trigger)
    return incident


async def run_intel_phase(incident: Incident, trigger: dict) -> None:
    prompt = f"Incident trigger received: {trigger}. Investigate and summarize the situation."
    text = await run_agent_turn(build_intel_agent(), prompt)
    incident.log("intel_agent", "reasoning", text)

    if incident.scenario == "building_collapse":
        epicenter_id = trigger.get("location_id", "satya-niketan")
        affected = tools.get_nearby_localities(epicenter_id, radius=2)
    else:
        affected = tools.get_affected_wards(risk_level="high")
    incident.affected_wards = [w["name"] for w in affected]
    incident.plan_state["affected_ward_ids"] = [w["id"] for w in affected]
    incident.log(
        "intel_agent",
        "decision",
        f"Affected area identified: {', '.join(incident.affected_wards)}",
    )

    jurisdiction = _primary_jurisdiction(incident)
    if jurisdiction:
        incident.plan_state["jurisdiction"] = jurisdiction
        incident.log(
            "intel_agent",
            "jurisdiction",
            f"Jurisdiction identified — {jurisdiction['police_station']} ({jurisdiction['police_district']}); "
            f"{jurisdiction['mcd_ward']} ({jurisdiction['mcd_zone']}); {jurisdiction['mla_office']}; "
            f"{jurisdiction['mp_office']}. Local representatives and station briefed automatically.",
            jurisdiction=jurisdiction,
        )


async def run_resource_phase(incident: Incident) -> None:
    site = incident.affected_wards[0] if incident.affected_wards else incident.location
    prompt = (
        f"Affected area: {incident.affected_wards}. Recommend team dispatch and "
        "check the response SOP for what's auto-approved."
    )
    text = await run_agent_turn(build_resource_agent(), prompt)
    incident.log("resource_agent", "reasoning", text)

    # Deterministic task creation for demo reliability — mirrors the
    # recommendation the Resource Agent's reasoning above describes.
    if incident.scenario == "building_collapse":
        t1 = Task(title="Structural assessment & rescue", owner_agent="Fire & Rescue Unit", ward=site)
        t2 = Task(title="Area cordon & crowd control", owner_agent="Rapid Action Team", ward=site)
    else:
        t1 = Task(title="Drainage inspection", owner_agent="Fire & Rescue Unit", ward=site)
        t2 = Task(title="Emergency deployment", owner_agent="Rapid Action Team",
                   ward=incident.affected_wards[1] if len(incident.affected_wards) > 1 else site)
    t3 = Task(title=HOSPITAL_TASK_TITLE.get(incident.scenario, "Hospital access check"),
              owner_agent="Medical/Ambulance Unit", ward=site)
    incident.tasks.extend([t1, t2, t3])
    incident.plan_state[HOSPITAL_TASK_KEY] = t3.id
    for t in (t1, t2, t3):
        incident.log("resource_agent", "task_created", f"Task created: {t.title} ({t.ward})", task_id=t.id)


async def _policy_check(incident: Incident, action_summary: str, amount_inr: float | None = None) -> bool:
    """Decides whether an action is auto-approved outright by the SOP, or
    needs sign-off above the field level — and if so, resolves that sign-off
    itself against the real office that actually holds the authority, rather
    than pausing the incident for a person to click something. Always
    returns True: nothing in this pipeline blocks on a human."""
    sop = tools.get_sop(incident.plan_state.get("scenario", "building_collapse"))
    prompt = (
        f"Proposed action: {action_summary}. Amount (INR): {amount_inr}. "
        f"SOP: {sop}. Decide AUTO_APPROVE or REQUIRES_APPROVAL."
    )
    text = await run_agent_turn(build_policy_agent(), prompt)
    incident.log("policy_agent", "decision", text)

    auto_approved = text.strip().upper().startswith("AUTO_APPROVE")
    if not auto_approved:
        authority = _select_authority(action_summary, amount_inr)
        approval = Approval(
            reason=action_summary,
            evidence=[e.text for e in incident.events[-3:]],
            action_summary=action_summary,
            amount_inr=amount_inr,
            status="approved",
            authorized_by=authority["office"],
            authority_tier=authority["tier"],
            resolved_at=now(),
        )
        incident.approvals.append(approval)
        incident.log(
            "auto_authorization",
            "approval_required",
            f"Authorized by {authority['office']} — {authority['tier']}: {action_summary}",
            approval_id=approval.id,
        )
    return True


async def run_dispatch_phase(incident: Incident) -> None:
    """Dispatches the two auto-approved tasks (drainage + general deployment)."""
    directory = tools._load("directory.json")  # noqa: SLF001 - internal helper reused intentionally
    responders_by_team = {r["team"]: r for r in directory["responders"]}

    for task in incident.tasks:
        if task.owner_agent == "Medical/Ambulance Unit":
            continue  # gated separately — hospital deployment always needs a policy check
        approved = await _policy_check(incident, f"Deploy {task.owner_agent} to {task.ward}")
        if not approved:
            continue
        responder = responders_by_team.get(task.owner_agent)
        message = f"{task.owner_agent}, deploy to {task.ward} for {task.title.lower()}."
        comms_prompt = f"Notify {responder['name']} ({responder['id']}) with: {message}"
        comms_text = await run_agent_turn(build_comms_agent(), comms_prompt)
        incident.log("comms_agent", "message", comms_text, task_id=task.id)
        result = tools.contact_responder(responder["id"], message)
        task.status = TaskStatus.IN_PROGRESS if result["status"] == "confirmed" else TaskStatus.FAILED
        incident.log(
            "comms_agent",
            "tool_call",
            f"contact_responder({responder['id']}) -> {result['status']}",
            task_id=task.id,
        )


async def simulate_hospital_task_failure(incident: Incident) -> None:
    """Demo hook: marks the hospital-access task failed and drives the
    replan -> escalate -> auto-authorized redeploy sequence."""
    task_id = incident.plan_state.get(HOSPITAL_TASK_KEY)
    task = next((t for t in incident.tasks if t.id == task_id), None)
    if task is None:
        return

    task.status = TaskStatus.FAILED
    incident.log("system", "event", f"New event: {task.ward} hospital access blocked.", task_id=task.id)

    replan_prompt = (
        f"Incident log so far:\n{_log_text(incident)}\n\n"
        f"Task '{task.title}' for {task.ward} has failed (hospital access blocked). "
        "Propose the next concrete action."
    )
    replan_text = await run_agent_turn(build_orchestrator_agent(), replan_prompt)
    incident.log("orchestrator", "reasoning", replan_text)

    task.status = TaskStatus.ESCALATED
    approved = await _policy_check(
        incident,
        f"Deploy Medical/Ambulance Unit to {task.ward} (hospital access blocked) + emergency procurement",
        amount_inr=2_500_000,
    )
    if approved:
        await _complete_hospital_task(incident, task)


async def _complete_hospital_task(incident: Incident, task: Task) -> None:
    directory = tools._load("directory.json")  # noqa: SLF001
    responder = next(r for r in directory["responders"] if r["team"] == "Medical/Ambulance Unit")
    result = tools.contact_responder(responder["id"], f"Deploy to {task.ward}, hospital access priority.")
    task.status = TaskStatus.COMPLETED if result["status"] == "confirmed" else TaskStatus.FAILED
    incident.log("comms_agent", "tool_call", f"contact_responder({responder['id']}) -> {result['status']}", task_id=task.id)


async def resolve_approval(incident: Incident, approval_id: str, approve: bool) -> None:
    """Field Command override — the rare exception path, not the default
    one. Every authorization in this incident was already resolved by the
    real office that holds it the moment it came up (see _policy_check); a
    human never has to act for the incident to proceed. This endpoint exists
    only so someone watching can veto a decision after the fact. Confirming
    an already-authorized action is a no-op; rejecting one unwinds the task
    it authorized and reopens the incident."""
    approval = next((a for a in incident.approvals if a.id == approval_id), None)
    if approval is None:
        raise ValueError(f"Unknown approval {approval_id}")

    was_approved = approval.status == "approved"
    approval.status = "approved" if approve else "rejected"
    approval.resolved_at = now()
    incident.log(
        "human_override",
        "decision",
        f"Field Command override — {'confirmed' if approve else 'rejected'}: {approval.action_summary}",
        approval_id=approval_id,
    )

    if not approve and was_approved and "hospital" in approval.action_summary.lower():
        task_id = incident.plan_state.get(HOSPITAL_TASK_KEY)
        task = next((t for t in incident.tasks if t.id == task_id), None)
        if task is not None and task.status == TaskStatus.COMPLETED:
            task.status = TaskStatus.ESCALATED
            incident.status = IncidentStatus.ACTIVE

    if incident.status != IncidentStatus.RESOLVED and all(
        t.status in (TaskStatus.COMPLETED, TaskStatus.FAILED) for t in incident.tasks
    ):
        await resolve_incident(incident)


async def resolve_incident(incident: Incident) -> None:
    prompt = f"Incident log:\n{_log_text(incident)}\n\nWrite the executive briefing."
    briefing = await run_agent_turn(build_orchestrator_agent(), prompt)
    incident.log("orchestrator", "briefing", briefing)
    incident.status = IncidentStatus.RESOLVED


async def run_full_demo_sequence(trigger: dict) -> Incident:
    """Runs the whole flow end to end, including the auto-authorized hospital
    redeploy — used by the manual /demo/run endpoint. Resolves on its own;
    nothing here waits for a human."""
    incident = await start_incident(trigger)
    await run_intel_phase(incident, trigger)
    await run_resource_phase(incident)
    await run_dispatch_phase(incident)
    await simulate_hospital_task_failure(incident)
    return incident
