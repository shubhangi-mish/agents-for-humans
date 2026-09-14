from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()  # must run before agents.base reads GOVOS_*/OPENAI_* env vars at import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import incident_engine
import news_feed
from agents import signoff_call
from models import Comment, Incident, new_id, now
from store import get_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("govos")

app = FastAPI(title="GovOS")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

store = get_store()

# incident_id -> list of subscriber asyncio.Queue, for SSE fan-out
_subscribers: dict[str, list[asyncio.Queue]] = {}

# subscribers to "a new incident just started anywhere" — lets the frontend
# auto-follow live activity without a human clicking a trigger button.
_latest_subscribers: list[asyncio.Queue] = []

# subscribers to the live, geocoded Delhi news feed (news_feed.py) — separate
# from _latest_subscribers above, which only announces incidents the
# response engine is actually running.
_news_subscribers: list[asyncio.Queue] = []

PILOT_SIM_ENABLED = os.getenv("GOVOS_PILOT_SIM", "true").lower() == "true"

# Off by default: continuous background polling burns a real LLM call
# (locality extraction) plus a geocoding request per new headline whether or
# not anyone has the app open. The default path is on-demand only — see
# POST /news/refresh, which the frontend's Refresh button calls. Set this to
# "true" (and optionally tune the interval) if you actually want it to keep
# polling itself on a timer.
NEWS_FEED_BACKGROUND_POLLING = os.getenv("GOVOS_NEWS_FEED_BACKGROUND", "false").lower() == "true"
NEWS_FEED_POLL_INTERVAL_SECONDS = int(os.getenv("GOVOS_NEWS_FEED_INTERVAL_SECONDS", "180"))

# The response engine's five seeded pilot wards (see backend/data/wards.json)
# — the only places it can run the full task/approval simulation, since that
# depends on wards.json's schematic hospital/team layout. A real news item
# only ever triggers a pilot simulation when the story genuinely names one of
# these — matched against both the extracted locality and the raw headline.
# There is no random fallback: an unmatched headline just stays a real,
# unprocessed news pin (see news_feed.py) rather than getting assigned to a
# ward it was never actually about.
PILOT_WARDS: dict[str, tuple[str, str]] = {
    "satya niketan": ("Satya Niketan", "satya-niketan"),
    "safdarjung": ("Safdarjung Enclave", "safdarjung-enclave"),
    "sarojini nagar": ("Sarojini Nagar", "sarojini-nagar"),
    "munirka": ("Munirka", "munirka"),
    "hauz khas": ("Hauz Khas", "hauz-khas"),
}

# Which of news_feed.py's broader news kinds the response engine actually
# has a scenario/SOP for (see incident_engine.SCENARIO_TITLES and
# backend/data/sop_*.json). "crime" and "accident" news still show up as
# real, geocoded pins — they just don't get a full simulated government
# response yet, since the engine has no SOP written for them.
NEWS_KIND_TO_SCENARIO: dict[str, str] = {
    "collapse": "building_collapse",
    "flood": "flood",
    "fire": "fire",
}


def _match_pilot_ward(item: news_feed.NewsItem) -> tuple[str, str] | None:
    haystacks = [h.lower() for h in (item.locality, item.headline) if h]
    for needle, ward in PILOT_WARDS.items():
        if any(needle in h for h in haystacks):
            return ward
    return None


def _broadcast(incident: Incident, event_dict: dict[str, Any]) -> None:
    for q in _subscribers.get(incident.id, []):
        q.put_nowait(event_dict)


def _broadcast_latest(incident: Incident) -> None:
    for q in _latest_subscribers:
        q.put_nowait({"incident_id": incident.id, "title": incident.title, "scenario": incident.scenario})


# Locations with a simulation currently being started or run — closes the
# race where several articles about the same real, still-unfolding story (a
# dozen outlets all covering one building collapse) get processed in the
# same poll cycle and would otherwise all pass the "no active incident yet"
# check before the first one finishes saving. Set synchronously the moment
# a trigger is accepted, before the task that actually creates it even gets
# a turn to run.
_sim_triggering: set[str] = set()


def _has_active_incident_at(location: str) -> bool:
    """A real ongoing story (e.g. one building collapse) gets reported by a
    dozen different outlets over the following days — each is a genuinely
    new news item, but they're all the same real-world event, not a dozen
    separate incidents. Only start a new simulation for a location that
    doesn't already have one still running."""
    if location in _sim_triggering:
        return True
    return any(i.location == location and i.status != "resolved" for i in store.list())


def _broadcast_news(item: news_feed.NewsItem) -> None:
    for q in _news_subscribers:
        q.put_nowait(json.loads(item.model_dump_json()))

    scenario = NEWS_KIND_TO_SCENARIO.get(item.kind)
    if not PILOT_SIM_ENABLED or scenario is None:
        return

    matched = _match_pilot_ward(item)
    if matched is not None:
        location, location_id = matched
        trigger: dict[str, Any] = {
            "scenario": scenario,
            "location": location,
            "location_id": location_id,
            "zone": "South Delhi",
            "rainfall_intensity": "high",
            "expected_duration_hours": 4,
            "source_headline": item.headline,
        }
    elif item.district and item.lat is not None and item.lng is not None:
        # Anywhere else in Delhi the story genuinely geocoded to — runs the
        # same live agent pipeline against the district's real jurisdiction
        # and a synthesized-but-real responder roster (see
        # incident_engine._resolve_jurisdiction / _responders_for) instead
        # of the pilot wards' fixed schematic data.
        location = item.locality or item.district
        trigger = {
            "scenario": scenario,
            "location": location,
            "district": item.district,
            "lat": item.lat,
            "lng": item.lng,
            "source_headline": item.headline,
        }
    else:
        return

    if _has_active_incident_at(location):
        return
    _sim_triggering.add(location)
    asyncio.create_task(_start_incident_sim(trigger))


async def _start_incident_sim(trigger: dict[str, Any]) -> None:
    try:
        incident = await incident_engine.start_incident(trigger)
        store.save(incident)
        _broadcast_latest(incident)
        logger.info(
            "Real news matched %s — running full simulation for %s: %r",
            trigger["location"], incident.id, trigger["source_headline"],
        )
        await _run_and_stream(incident, trigger)
    finally:
        _sim_triggering.discard(trigger["location"])


async def _news_feed_loop() -> None:
    """Polls the real Delhi news feed on its own schedule — the single
    source of truth for everything on the map. Every headline is a real
    story, geocoded to where it actually happened; the ones that genuinely
    name one of the response engine's pilot wards also get a full simulated
    government response (via _broadcast_news above), the rest just show up
    as real, unprocessed news pins."""
    while True:
        try:
            found = await news_feed.poll_once(_broadcast_news)
            if found:
                logger.info("News feed: %d new Delhi headline(s)", found)
        except Exception:
            logger.exception("News feed loop iteration failed")
        await asyncio.sleep(NEWS_FEED_POLL_INTERVAL_SECONDS)


async def _run_and_stream(incident: Incident, trigger: dict) -> None:
    """Runs the incident phases, saving + broadcasting after each step."""
    sent = 0

    def flush(label: str) -> None:
        nonlocal sent
        store.save(incident)
        for evt in incident.events[sent:]:
            _broadcast(incident, {"type": "event", "phase": label, "event": json.loads(evt.model_dump_json())})
        sent = len(incident.events)
        _broadcast(incident, {"type": "state", "phase": label, "incident": json.loads(incident.model_dump_json())})

    try:
        await incident_engine.run_intel_phase(incident, trigger)
        flush("intel")

        await incident_engine.run_resource_phase(incident)
        flush("resource")

        await incident_engine.run_dispatch_phase(incident)
        flush("dispatch")

        await incident_engine.simulate_hospital_task_failure(incident)
        flush("failure_and_escalation")

        _place_signoff_calls(incident)
    except Exception:
        logger.exception("Incident run failed for %s", incident.id)
        incident.log("system", "error", "Incident processing failed — see server logs.")
        flush("error")


# Chief Minister, Government of NCT of Delhi — must match frontend/lib/personas.ts's
# CURRENT_ACTOR exactly, since a phone confirmation is attributed as that same actor.
SIGNOFF_ACTOR_NAME = os.getenv("CALLE_SIGNOFF_ACTOR_NAME", "Chief Minister, Government of NCT of Delhi")


def _place_signoff_calls(incident: Incident) -> None:
    """Fires a real (or, unconfigured, dry-run) sign-off phone call for
    every DDMA-tier approval this incident just auto-authorized — DDMA is
    chaired by the Chief Minister, so this is a decision made in that
    person's name before they've actually seen it. Fire-and-forget: the
    incident already resolved itself autonomously: this call can only
    confirm that stands or override it, never block or delay it."""
    for approval in incident.approvals:
        if approval.authority_tier and "DDMA" in approval.authority_tier and not approval.overridden_by:
            asyncio.create_task(_run_signoff_call(incident.id, approval.id))


async def _run_signoff_call(incident_id: str, approval_id: str) -> None:
    incident = store.get(incident_id)
    if incident is None:
        return
    approval = next((a for a in incident.approvals if a.id == approval_id), None)
    if approval is None:
        return

    result = await signoff_call.request_signoff_call(
        actor_name=SIGNOFF_ACTOR_NAME,
        incident_id=incident_id,
        approval_id=approval_id,
        incident_title=incident.title,
        action_summary=approval.action_summary,
        authority_tier=approval.authority_tier or "",
        amount_inr=approval.amount_inr,
    )
    logger.info(
        "Sign-off call for %s/%s -> %s%s",
        incident_id, approval_id, result["decision"], " (dry run)" if result["dry_run"] else "",
    )

    if result["decision"] in ("confirm", "override"):
        # Same function the dashboard's Confirm/Override buttons call — a
        # phone decision is just another caller of the one place that
        # actually mutates an approval's status.
        await incident_engine.resolve_approval(
            incident, approval_id, result["decision"] == "confirm", f"{SIGNOFF_ACTOR_NAME} (via phone)"
        )
        store.save(incident)
        _broadcast(incident, {"type": "state", "phase": "signoff_call", "incident": json.loads(incident.model_dump_json())})


class TriggerPayload(BaseModel):
    scenario: str = "building_collapse"  # "building_collapse" | "flood" | "fire"
    location: str = "Satya Niketan"
    # Pilot-ward path: set location_id to one of wards.json's five seeded
    # localities. City-wide path: leave location_id unset and set district
    # (+ optionally lat/lng) instead — see incident_engine._resolve_jurisdiction.
    location_id: str | None = None
    district: str | None = None
    lat: float | None = None
    lng: float | None = None
    zone: str = "South Delhi"
    rainfall_intensity: str = "high"
    expected_duration_hours: int = 4


@app.post("/events/incident")
async def trigger_incident(payload: TriggerPayload) -> dict[str, str]:
    """Manual/test trigger with a plain JSON body. Use /events/eventbridge for
    the real EventBridge-triggered path."""
    incident = await incident_engine.start_incident(payload.model_dump())
    store.save(incident)
    _broadcast_latest(incident)
    asyncio.create_task(_run_and_stream(incident, payload.model_dump()))
    return {"incident_id": incident.id}


@app.post("/events/eventbridge")
async def eventbridge_trigger(envelope: dict[str, Any]) -> dict[str, str]:
    """Target for an EventBridge rule routed through an API destination (HTTP
    POST). The rule's input transformer should forward the event's `detail`
    object as the request body — see deploy/deploy.sh for the rule setup.
    Falls back to treating the whole body as the trigger payload if there's
    no `detail` key, so this also works for a manual curl test."""
    trigger = envelope.get("detail", envelope)
    incident = await incident_engine.start_incident(trigger)
    store.save(incident)
    _broadcast_latest(incident)
    asyncio.create_task(_run_and_stream(incident, trigger))
    return {"incident_id": incident.id}


@app.on_event("startup")
async def _start_background_tasks() -> None:
    if NEWS_FEED_BACKGROUND_POLLING:
        asyncio.create_task(_news_feed_loop())


@app.get("/incidents")
async def list_incidents() -> list[dict[str, Any]]:
    return [json.loads(i.model_dump_json()) for i in store.list()]


@app.get("/audit")
async def audit_log() -> list[dict[str, Any]]:
    """Every authorization across every incident, newest first — the CM's
    (or any signed-in authority's) city-wide oversight view of who signed
    off on what, and whether anyone has since overridden it. Flattens
    Approval records out of their incidents rather than making a caller
    fetch every incident individually to reconstruct this."""
    rows: list[dict[str, Any]] = []
    for incident in store.list():
        for approval in incident.approvals:
            rows.append({
                "incident_id": incident.id,
                "incident_title": incident.title,
                "incident_status": incident.status,
                **json.loads(approval.model_dump_json()),
            })
    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return rows


@app.get("/incidents/{incident_id}")
async def get_incident(incident_id: str) -> dict[str, Any]:
    incident = store.get(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return json.loads(incident.model_dump_json())


class ApprovalDecision(BaseModel):
    approval_id: str
    approve: bool
    # Who is actually doing this override, e.g. "Chief Minister, GNCTD" —
    # the frontend sends the signed-in persona's name+role here so the
    # audit trail records a real actor, not an anonymous "Field Command".
    actor: str = "Field Command"


@app.post("/incidents/{incident_id}/approve")
async def approve(incident_id: str, decision: ApprovalDecision) -> dict[str, Any]:
    """Human override, attributed to whoever is signed in. Every
    authorization the incident needed was already resolved by the real
    office that holds it (see incident_engine._policy_check) the moment it
    came up — this endpoint is the rare veto path for someone with real
    standing to override that after the fact, never something the incident
    waits on to proceed."""
    incident = store.get(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")

    sent = len(incident.events)
    await incident_engine.resolve_approval(incident, decision.approval_id, decision.approve, decision.actor)
    store.save(incident)
    for evt in incident.events[sent:]:
        _broadcast(incident, {"type": "event", "phase": "approval", "event": json.loads(evt.model_dump_json())})
    _broadcast(incident, {"type": "state", "phase": "approval", "incident": json.loads(incident.model_dump_json())})
    return json.loads(incident.model_dump_json())


class CommentPayload(BaseModel):
    author: str
    author_role: str
    text: str


@app.post("/incidents/{incident_id}/comments")
async def add_comment(incident_id: str, payload: CommentPayload) -> dict[str, Any]:
    """Any signed-in authority can leave a note on an incident — it's
    appended to the incident's own record, so every other authority who
    opens this incident sees it too. No per-viewer visibility filtering:
    a shared record is the point."""
    incident = store.get(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")

    comment = Comment(author=payload.author, author_role=payload.author_role, text=payload.text)
    incident.comments.append(comment)
    incident.updated_at = comment.created_at
    store.save(incident)
    _broadcast(incident, {"type": "state", "phase": "comment", "incident": json.loads(incident.model_dump_json())})
    return json.loads(incident.model_dump_json())


# City-wide directives — a signed-in authority messaging a specific real
# office directly, independent of any one incident (unlike Comments, which
# are scoped to an incident). In-memory only: this is a lightweight
# messaging log for the demo, not part of the audit-of-record the way
# approvals/comments are, so it doesn't survive a restart.
_directives: list[dict[str, Any]] = []


class DirectivePayload(BaseModel):
    from_actor: str
    from_role: str
    to_office: str
    text: str


@app.get("/directives")
async def list_directives() -> list[dict[str, Any]]:
    return list(reversed(_directives))


@app.post("/directives")
async def send_directive(payload: DirectivePayload) -> dict[str, Any]:
    directive = {
        "id": new_id("dir"),
        "from_actor": payload.from_actor,
        "from_role": payload.from_role,
        "to_office": payload.to_office,
        "text": payload.text,
        "created_at": now(),
    }
    _directives.append(directive)
    return directive


@app.get("/stream/{incident_id}")
async def stream(incident_id: str):
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.setdefault(incident_id, []).append(queue)

    incident = store.get(incident_id)
    if incident is not None:
        queue.put_nowait({"type": "state", "phase": "snapshot", "incident": json.loads(incident.model_dump_json())})

    async def event_generator():
        try:
            while True:
                data = await queue.get()
                yield {"event": data["type"], "data": json.dumps(data)}
        finally:
            _subscribers[incident_id].remove(queue)

    return EventSourceResponse(event_generator())


@app.get("/stream/latest")
async def stream_latest():
    """Announces every new incident (manual, EventBridge, or auto-triggered)
    as it starts, so the frontend can auto-follow live activity instead of
    requiring a human to trigger and pick an incident."""
    queue: asyncio.Queue = asyncio.Queue()
    _latest_subscribers.append(queue)

    async def event_generator():
        try:
            while True:
                data = await queue.get()
                yield {"event": "new_incident", "data": json.dumps(data)}
        finally:
            _latest_subscribers.remove(queue)

    return EventSourceResponse(event_generator())


@app.get("/news")
async def list_news() -> list[dict[str, Any]]:
    """Recent real Delhi headlines, newest first — same items the
    /stream/news SSE feed announces as they're found. Never itself triggers
    a poll (see POST /news/refresh) — just returns whatever's already
    cached, so opening the app costs nothing."""
    return [json.loads(i.model_dump_json()) for i in news_feed.recent_items()]


_news_refresh_lock = asyncio.Lock()


@app.post("/news/refresh")
async def refresh_news() -> dict[str, int]:
    """On-demand poll — the Refresh button's target. This is the only place
    that spends an LLM/geocoding call by default now (see
    NEWS_FEED_BACKGROUND_POLLING): nothing runs on a timer unless a person
    (or a re-enabled background loop) actually asks for it. Locked so a
    double-click doesn't fire two overlapping RSS fetches."""
    if _news_refresh_lock.locked():
        return {"new_items": 0}
    async with _news_refresh_lock:
        return {"new_items": await news_feed.poll_once(_broadcast_news)}


@app.get("/stream/news")
async def stream_news():
    """Live feed of real Delhi news items as news_feed.py finds them —
    powers the frontend's news side panel and its map pins."""
    queue: asyncio.Queue = asyncio.Queue()
    _news_subscribers.append(queue)

    async def event_generator():
        try:
            while True:
                data = await queue.get()
                yield {"event": "news_item", "data": json.dumps(data)}
        finally:
            _news_subscribers.remove(queue)

    return EventSourceResponse(event_generator())


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
