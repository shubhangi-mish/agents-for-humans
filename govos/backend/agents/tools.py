"""Tool functions passed straight into Strands `Agent(tools=[...])`.

These wrap the real-institution-structure data described in
GOVOS_HACKATHON_PLAN.md §7: a real South Delhi locality/hospital layout and
a real (but not-personally-identifying) response-unit directory. Each
function is decorated with Strands' `@tool` so this installed SDK version
(1.26.0) actually registers it as a callable tool — plain undecorated
functions are silently dropped (logged as "unrecognized tool specification")
and never reach the model, which is what caused earlier runs' agents to
hallucinate fake tool-call JSON instead of getting real data back.
`@tool`-wrapped functions remain directly callable with plain Python args
too, so `contact_responder` calling `get_responder`, and
`incident_engine.py` calling these outside an agent turn, both still work
unchanged.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from strands import tool

DATA_DIR = Path(__file__).parent.parent / "data"


def _load(name: str) -> dict[str, Any]:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


@tool
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


@tool
def get_affected_wards(risk_level: str = "high") -> list[dict[str, Any]]:
    """Returns seeded localities at or above the given baseline flood-risk level
    (used by the flood scenario). Pass "high" to get every seeded locality."""
    wards = _load("wards.json")["wards"]
    if risk_level == "high":
        return wards  # demo scenario: treat all seeded wards as affected
    return [w for w in wards if w["baseline_flood_risk"] == risk_level]


@tool
def get_nearby_localities(epicenter_id: str, radius: int = 2) -> list[dict[str, Any]]:
    """Returns the epicenter locality plus its `radius` nearest neighbors by
    straight-line distance on the ops-map schematic coordinates. Used for the
    building-collapse scenario, where "affected area" means the site plus
    its immediate surroundings rather than a broad flood-risk band."""
    wards = _load("wards.json")["wards"]
    by_id = {w["id"]: w for w in wards}
    epicenter = by_id.get(epicenter_id)
    if epicenter is None:
        return wards[:1]

    others = [w for w in wards if w["id"] != epicenter_id]
    others.sort(key=lambda w: (w["x"] - epicenter["x"]) ** 2 + (w["y"] - epicenter["y"]) ** 2)
    return [epicenter, *others[:radius]]


@tool
def get_hospital_status(ward_id: str) -> dict[str, Any] | None:
    """Looks up the hospital serving the given locality id and its current
    access_status (e.g. "open" or "blocked"). Returns None if no hospital is
    mapped to that locality."""
    hospitals = _load("wards.json")["hospitals"]
    for h in hospitals:
        if h["ward"] == ward_id:
            return h
    return None


@tool
def get_jurisdiction(ward_id: str) -> dict[str, Any] | None:
    """Looks up the real jurisdiction stack for a locality id — its assembly
    constituency/MLA office, Lok Sabha constituency/MP office, local police
    station, MCD ward/zone, water and power utility control rooms. Used so
    escalation actually names the specific offices that would own this area
    in real life, not a generic ladder. Returns None for an unknown ward."""
    return _load("jurisdictions.json")["wards"].get(ward_id)


@tool
def get_district_jurisdiction(district: str) -> dict[str, Any] | None:
    """Real district-level authorities for any of Delhi's 11 revenue
    districts (District Magistrate, DCP, MCD zone, plus the city-wide top —
    CM's Office, DDMA, LG's Office, Police Commissioner). Works for
    anywhere in Delhi, unlike get_jurisdiction() which only covers the five
    seeded pilot wards. Returns None for an unrecognized district name."""
    data = _load("delhi_districts.json")
    entry = data["districts"].get(district)
    if entry is None:
        return None
    return {"district": district, **entry, **data["top"]}


@tool
def get_district_responders(district: str) -> dict[str, dict[str, str]]:
    """Synthesizes a real-institution-type responder roster for any Delhi
    district — same three team roles as the pilot wards' fixed directory.json
    roster (Fire & Rescue, Rapid Action, Medical/Ambulance), but named for
    the district actually affected instead of always the same five South
    Delhi offices. Fire response and civic/disaster coordination are
    genuinely local (real per-district office *types* — this doesn't claim
    to know the exact station address); ambulance dispatch (CATS / 102) is
    genuinely centralized citywide in real life, so that entry stays
    constant across every district. Returns {} for an unrecognized district."""
    jurisdiction = get_district_jurisdiction(district)
    if jurisdiction is None:
        return {}
    slug = district.lower().replace(" ", "-")
    return {
        "Fire & Rescue Unit": {
            "id": f"dfs-{slug}",
            "name": f"Delhi Fire Service — {district} Divisional Control Room",
            "team": "Fire & Rescue Unit",
        },
        "Rapid Action Team": {
            "id": f"mcd-{slug}",
            "name": f"{jurisdiction['mcd_zone']} — Disaster Management Cell",
            "team": "Rapid Action Team",
        },
        "Medical/Ambulance Unit": {
            "id": "resp-003",
            "name": "CATS Ambulance Control Room",
            "team": "Medical/Ambulance Unit",
        },
    }


@tool
def simulate_contact(responder_name: str, team: str, message: str) -> dict[str, Any]:
    """Simulated outbound contact (SMS/call) to a responder identified by
    name rather than a fixed directory id — generalizes contact_responder()
    so it also works for get_district_responders()'s synthesized city-wide
    roster, not only directory.json's five-pilot-ward entries. No real
    telecom integration; always confirmed, since this is a simulation."""
    return {"status": "confirmed", "responder": responder_name, "team": team, "message_sent": message}


@tool
def get_sop(topic: str = "building_collapse") -> dict[str, Any]:
    """Loads the Standard Operating Procedure document for the given incident
    scenario (e.g. "building_collapse" or "flood"), including which actions
    are auto-approved versus which require human approval."""
    return _load(f"sop_{topic}.json")


@tool
def get_available_teams() -> list[dict[str, Any]]:
    """Lists every response team/unit in the directory (Fire & Rescue, Rapid
    Action Team, Medical/Ambulance Unit, NDRF, etc.) with its lead office and
    capability."""
    directory = _load("directory.json")
    teams = directory["teams"]
    responders = {r["id"]: r for r in directory["responders"]}
    for team in teams:
        team["lead_detail"] = responders.get(team["lead"])
    return teams


@tool
def get_responder(responder_id: str) -> dict[str, Any] | None:
    """Looks up a single response unit/office by its directory id."""
    directory = _load("directory.json")
    for r in directory["responders"]:
        if r["id"] == responder_id:
            return r
    return None


@tool
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
