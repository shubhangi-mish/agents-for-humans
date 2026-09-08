"""Tool functions passed straight into Strands `Agent(tools=[...])`.

These wrap the mocked/public data sources described in the plan (§7 of
GOVOS_HACKATHON_PLAN.md): synthetic responder directory, illustrative ward
layout, and a synthetic SOP. Strands generates each tool's spec from the
plain function's type hints and docstring, so these are intentionally
undecorated — that also keeps them directly callable from Python (e.g.
`contact_responder` calling `get_responder`, or `incident_engine.py` calling
these outside an agent turn) without going through any tool-wrapper
indirection.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent.parent / "data"


def _load(name: str) -> dict[str, Any]:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def get_weather_feed(zone: str = "South Delhi") -> dict[str, Any]:
    """Simulated weather feed. Structurally identical to a public weather API response.

    In production, replace with a real provider call. For the hackathon demo this
    is triggered by the incoming EventBridge event payload rather than polled live.
    """
    return {
        "zone": zone,
        "rainfall_intensity": "high",
        "expected_duration_hours": 4,
        "risk_level": "high",
    }


def get_affected_wards(risk_level: str = "high") -> list[dict[str, Any]]:
    wards = _load("wards.json")["wards"]
    if risk_level == "high":
        return wards  # demo scenario: treat all seeded wards as affected
    return [w for w in wards if w["baseline_flood_risk"] == risk_level]


def get_hospital_status(ward_id: str) -> dict[str, Any] | None:
    hospitals = _load("wards.json")["hospitals"]
    for h in hospitals:
        if h["ward"] == ward_id:
            return h
    return None


def get_sop(topic: str = "flood") -> dict[str, Any]:
    return _load(f"sop_{topic}.json")


def get_available_teams() -> list[dict[str, Any]]:
    directory = _load("directory.json")
    teams = directory["teams"]
    responders = {r["id"]: r for r in directory["responders"]}
    for team in teams:
        team["lead_detail"] = responders.get(team["lead"])
    return teams


def get_responder(responder_id: str) -> dict[str, Any] | None:
    directory = _load("directory.json")
    for r in directory["responders"]:
        if r["id"] == responder_id:
            return r
    return None


def contact_responder(responder_id: str, message: str) -> dict[str, Any]:
    """Simulated outbound contact (SMS/call). No real telecom integration —
    this keeps the demo free of privacy/consent issues around real phone numbers.
    """
    responder = get_responder(responder_id)
    if not responder:
        return {"status": "failed", "reason": "unknown_responder"}
    return {
        "status": "confirmed",
        "responder": responder["name"],
        "team": responder["team"],
        "message_sent": message,
    }
