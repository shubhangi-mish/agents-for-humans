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

`request_tag_notification_call` below is the same pattern applied to a
different trigger: instead of an auto-authorization, a signed-in authority
tagged another office on a comment and wants an urgent reply. Same
safe-by-default behavior, same single-consented-number rule.
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
        "This is a routine administrative call about a software demo/simulation. It is NOT a "
        "real emergency, is not connected to any real emergency dispatch, and does not direct "
        "or affect any real-world incident response — say this plainly if asked. "
        f"The purpose of this call is to get {actor_name}'s approval on one matter: a "
        f"government-operations simulation app's policy engine provisionally recorded the "
        f"following as authorized under {authority_tier}{amount_clause}, pending their review: "
        f"\"{action_summary}\" (simulated scenario: \"{incident_title}\"). Speak clearly and "
        "briefly, state up front that you're calling to get their approval on this matter, then "
        "ask whether they CONFIRM (approve) it as recorded, or OVERRIDE (reject) it — flag a "
        "rejection for correction in the app. Politely end the call once you have a clear "
        "answer. If they are unavailable or the line doesn't answer, record the outcome as "
        "unclear."
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


TAG_RESULT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["acknowledged"],
    "properties": {
        "acknowledged": {"type": "boolean"},
        "reply_notes": {"type": "string"},
    },
}


def _build_tag_task(tagger_name: str, tagged_office: str, incident_title: str, comment_text: str) -> str:
    return (
        "This is a routine administrative call about a comment left on a software "
        "demo/simulation record. It is NOT a real emergency and does not direct or affect any "
        "real-world action — say this plainly if asked. "
        f"You are reaching the line registered for {tagged_office}. {tagger_name} tagged this "
        f"office on a simulation record titled \"{incident_title}\" and is requesting an urgent "
        f"reply. Their comment: \"{comment_text}\". Speak clearly and briefly: read the comment, "
        "ask if they can acknowledge it and give a short reply. Politely end the call once you "
        "have an answer. If they are unavailable or the line doesn't answer, record acknowledged "
        "as false."
    )


async def request_tag_notification_call(
    *, tagger_name: str, incident_id: str, comment_id: str, incident_title: str, tagged_office: str, comment_text: str
) -> dict[str, Any]:
    """Places (or, if not configured/enabled, simulates) a call notifying
    `tagged_office` that `tagger_name` tagged them on a comment and wants a
    reply. Returns {"acknowledged": bool, "reply_notes": str, "dry_run":
    bool, "raw": <full CALL-E result or None>}. Same registered number as
    request_signoff_call — this demo has exactly one consented line, and
    the call script says plainly which office it's notionally reaching."""
    task = _build_tag_task(tagger_name, tagged_office, incident_title, comment_text)

    reason = _dry_run_reason()
    if reason:
        logger.info("[DRY RUN — %s] Would call re: tag on %s: %s", reason, tagged_office, task)
        return {"acknowledged": False, "reply_notes": "", "dry_run": True, "raw": None, "dry_run_reason": reason}

    def _place_call() -> dict[str, Any]:
        from calle import CalleClient  # imported lazily — an optional runtime dependency

        client = CalleClient(api_key=os.environ["CALLE_API_KEY"])
        return client.calls.create_and_wait(
            task=task,
            recipient={"phone": os.environ["CALLE_SIGNOFF_PHONE"], "region": "IN", "locale": "en-IN"},
            result_schema=TAG_RESULT_SCHEMA,
            metadata={"source": "govos-tag-notification", "incident_id": incident_id, "comment_id": comment_id},
            idempotency_key=f"govos-tag-{comment_id}",
            timeout_seconds=180.0,
        )

    try:
        call = await asyncio.to_thread(_place_call)
    except Exception:
        logger.exception("Tag notification call failed for comment %s", comment_id)
        return {"acknowledged": False, "reply_notes": "", "dry_run": False, "raw": None, "error": True}

    structured = call.get("structured_result") or {}
    return {
        "acknowledged": bool(structured.get("acknowledged", False)),
        "reply_notes": structured.get("reply_notes", ""),
        "dry_run": False,
        "raw": call,
    }
