"""Authority sign-off via a real phone call (CALL-E).

Pattern: when an autonomous agent auto-authorizes a high-stakes action on a
real authority's behalf (see incident_engine.AUTHORITY_TIERS — the DDMA tier
specifically, since DDMA is chaired by the Chief Minister), the person it
was authorized "as" hasn't necessarily seen it yet. This places a real phone
call to THAT authority's own pre-registered number — never a third party,
never an emergency number, never anyone who hasn't explicitly configured
their own line for this — explains the decision in plain language, and
returns a structured confirm/override the caller feeds back into
incident_engine.resolve_approval(), the exact same function the dashboard's
override button already calls.

Safe by default: with no CALLE_API_KEY, no CALLE_SIGNOFF_PHONE, or
CALLE_SIGNOFF_ENABLED not explicitly "true", this never places a real call —
it logs what it would have said and returns "unclear" immediately. A call
failure (busy/no-answer/timeout/API error) also resolves as "unclear" rather
than raising, so a flaky phone line can never wedge an incident that already
resolved itself autonomously.

This module is GovOS's wiring around a portable pattern — the standalone,
GovOS-independent version of this same logic is packaged as the
"authority-signoff-call" Agent Skill submitted to
CALLE-AI/awesome-phone-call-agents.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

logger = logging.getLogger("govos.signoff_call")

RESULT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["decision"],
    "properties": {
        "decision": {"type": "string", "enum": ["confirm", "override", "unclear"]},
        "notes": {"type": "string"},
    },
}


def _dry_run_reason() -> str | None:
    if not os.getenv("CALLE_API_KEY"):
        return "CALLE_API_KEY not set"
    if not os.getenv("CALLE_SIGNOFF_PHONE"):
        return "CALLE_SIGNOFF_PHONE not set"
    if os.getenv("CALLE_SIGNOFF_ENABLED", "false").lower() != "true":
        return 'CALLE_SIGNOFF_ENABLED is not "true"'
    return None


def _build_task(
    actor_name: str, incident_title: str, action_summary: str, authority_tier: str, amount_inr: float | None
) -> str:
    amount_clause = f" for approximately ₹{amount_inr:,.0f}" if amount_inr else ""
    return (
        f"You are calling {actor_name} on behalf of an autonomous incident-response system. "
        f"Speak clearly and briefly. Explain: the incident \"{incident_title}\" just had the "
        f"following action auto-authorized under {authority_tier}{amount_clause}: "
        f"\"{action_summary}\". Ask whether they want to CONFIRM this decision as it stands, "
        "or OVERRIDE (reject) it. Politely end the call once you have a clear answer. If they "
        "are unavailable or the line doesn't answer, record the outcome as unclear."
    )


async def request_signoff_call(
    *,
    actor_name: str,
    incident_id: str,
    approval_id: str,
    incident_title: str,
    action_summary: str,
    authority_tier: str,
    amount_inr: float | None,
) -> dict[str, Any]:
    """Places (or, if not configured/enabled, simulates) the sign-off call.
    Returns {"decision": "confirm"|"override"|"unclear", "dry_run": bool,
    "raw": <full CALL-E result or None>}."""
    task = _build_task(actor_name, incident_title, action_summary, authority_tier, amount_inr)

    reason = _dry_run_reason()
    if reason:
        logger.info("[DRY RUN — %s] Would call %s to sign off: %s", reason, actor_name, task)
        return {"decision": "unclear", "dry_run": True, "raw": None, "dry_run_reason": reason}

    def _place_call() -> dict[str, Any]:
        from calle import CalleClient  # imported lazily — an optional runtime dependency

        client = CalleClient(api_key=os.environ["CALLE_API_KEY"])
        return client.calls.create_and_wait(
            task=task,
            recipient={"phone": os.environ["CALLE_SIGNOFF_PHONE"], "region": "IN", "locale": "en-IN"},
            result_schema=RESULT_SCHEMA,
            metadata={"source": "govos-signoff", "incident_id": incident_id, "approval_id": approval_id},
            idempotency_key=f"govos-signoff-{approval_id}",
            timeout_seconds=180.0,
        )

    try:
        # create_and_wait polls with a blocking time.sleep() internally —
        # never call it directly on the asyncio event loop.
        call = await asyncio.to_thread(_place_call)
    except Exception:
        logger.exception("Sign-off call failed for approval %s", approval_id)
        return {"decision": "unclear", "dry_run": False, "raw": None, "error": True}

    structured = call.get("structured_result") or {}
    decision = structured.get("decision", "unclear")
    if decision not in ("confirm", "override", "unclear"):
        decision = "unclear"
    return {"decision": decision, "dry_run": False, "raw": call}
