"""The incident state machine.

This is the orchestration harness around the Strands agents: it sequences
calls to Intel / Resource / Comms / Policy / Orchestrator, persists
structured state (tasks, approvals, events) that the frontend god-view
renders, and owns the two demo-critical behaviors — the failure/replanning
beat and the approval halt/resume beat. The Strands agents provide the
reasoning text that gets logged alongside each deterministic state change;
they don't need to also manage task bookkeeping, which keeps the demo
reliable.
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
from models import Approval, Incident, IncidentStatus, Task, TaskStatus

HOSPITAL_TASK_KEY = "hospital_access_task_id"


def _log_text(incident: Incident) -> str:
    return "\n".join(f"[{e.agent}] {e.text}" for e in incident.events)


async def start_incident(trigger: dict) -> Incident:
    incident = Incident(title="Flood Response — South Delhi", severity="high")
    incident.log(
        "system",
        "system",
        "Incident triggered by weather feed via EventBridge. No human prompt.",
        trigger=trigger,
    )
    return incident


async def run_intel_phase(incident: Incident, trigger: dict) -> None:
    prompt = f"Incident trigger received: {trigger}. Investigate and summarize the situation."
    text = await run_agent_turn(build_intel_agent(), prompt)
    incident.log("intel_agent", "reasoning", text)

    affected = tools.get_affected_wards(risk_level="high")
    incident.affected_wards = [w["name"] for w in affected]
    incident.log(
        "intel_agent",
        "decision",
        f"Affected wards identified: {', '.join(incident.affected_wards)}",
    )


async def run_resource_phase(incident: Incident) -> None:
    prompt = (
        f"Affected wards: {incident.affected_wards}. Recommend team dispatch and "
        "check the flood response SOP for what's auto-approved."
    )
    text = await run_agent_turn(build_resource_agent(), prompt)
    incident.log("resource_agent", "reasoning", text)

    # Deterministic task creation for demo reliability — mirrors the
    # recommendation the Resource Agent's reasoning above describes.
    t1 = Task(title="Drainage inspection", owner_agent="Drainage Team A", ward="Ward 54")
    t2 = Task(title="Emergency deployment", owner_agent="Emergency Response B", ward="Ward 43")
    t3 = Task(title="Hospital access check", owner_agent="Medical Team C", ward="Ward 54")
    incident.tasks.extend([t1, t2, t3])
    incident.plan_state[HOSPITAL_TASK_KEY] = t3.id
    for t in (t1, t2, t3):
        incident.log("resource_agent", "task_created", f"Task created: {t.title} ({t.ward})", task_id=t.id)


async def _policy_check(incident: Incident, action_summary: str, amount_inr: float | None = None) -> bool:
    sop = tools.get_sop("flood")
    prompt = (
        f"Proposed action: {action_summary}. Amount (INR): {amount_inr}. "
        f"SOP: {sop}. Decide AUTO_APPROVE or REQUIRES_APPROVAL."
    )
    text = await run_agent_turn(build_policy_agent(), prompt)
    incident.log("policy_agent", "decision", text)

    auto_approved = text.strip().upper().startswith("AUTO_APPROVE")
    if not auto_approved:
        approval = Approval(
            reason=action_summary,
            evidence=[e.text for e in incident.events[-3:]],
            action_summary=action_summary,
            amount_inr=amount_inr,
        )
        incident.approvals.append(approval)
        incident.status = IncidentStatus.PAUSED_FOR_APPROVAL
        incident.log(
            "policy_agent",
            "approval_required",
            f"Human approval required: {action_summary}",
            approval_id=approval.id,
        )
    return auto_approved


async def run_dispatch_phase(incident: Incident) -> None:
    """Dispatches the two auto-approved tasks (drainage + general deployment)."""
    directory = tools._load("directory.json")  # noqa: SLF001 - internal helper reused intentionally
    responders_by_team = {r["team"]: r for r in directory["responders"]}

    for task in incident.tasks:
        if task.owner_agent == "Medical Team C":
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
    replan -> escalate -> approval-gated redeploy sequence."""
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
        f"Deploy Medical Team C to {task.ward} (hospital access blocked) + emergency procurement",
        amount_inr=2_500_000,
    )
    if approved:
        await _complete_hospital_task(incident, task)


async def _complete_hospital_task(incident: Incident, task: Task) -> None:
    directory = tools._load("directory.json")  # noqa: SLF001
    responder = next(r for r in directory["responders"] if r["team"] == "Medical Team C")
    result = tools.contact_responder(responder["id"], f"Deploy to {task.ward}, hospital access priority.")
    task.status = TaskStatus.COMPLETED if result["status"] == "confirmed" else TaskStatus.FAILED
    incident.log("comms_agent", "tool_call", f"contact_responder({responder['id']}) -> {result['status']}", task_id=task.id)


async def resolve_approval(incident: Incident, approval_id: str, approve: bool) -> None:
    approval = next((a for a in incident.approvals if a.id == approval_id), None)
    if approval is None:
        raise ValueError(f"Unknown approval {approval_id}")

    from models import now

    approval.status = "approved" if approve else "rejected"
    approval.resolved_at = now()
    incident.log(
        "human",
        "decision",
        f"Human {'approved' if approve else 'rejected'}: {approval.action_summary}",
        approval_id=approval_id,
    )
    incident.status = IncidentStatus.ACTIVE

    if approve and "hospital" in approval.action_summary.lower():
        task_id = incident.plan_state.get(HOSPITAL_TASK_KEY)
        task = next((t for t in incident.tasks if t.id == task_id), None)
        if task is not None:
            await _complete_hospital_task(incident, task)

    if all(t.status in (TaskStatus.COMPLETED, TaskStatus.FAILED) for t in incident.tasks):
        await resolve_incident(incident)


async def resolve_incident(incident: Incident) -> None:
    prompt = f"Incident log:\n{_log_text(incident)}\n\nWrite the executive briefing."
    briefing = await run_agent_turn(build_orchestrator_agent(), prompt)
    incident.log("orchestrator", "briefing", briefing)
    incident.status = IncidentStatus.RESOLVED


async def run_full_demo_sequence(trigger: dict) -> Incident:
    """Runs the whole flow up to the point where hospital deployment needs a
    human decision — used by the manual /demo/run endpoint."""
    incident = await start_incident(trigger)
    await run_intel_phase(incident, trigger)
    await run_resource_phase(incident)
    await run_dispatch_phase(incident)
    await simulate_hospital_task_failure(incident)
    return incident
