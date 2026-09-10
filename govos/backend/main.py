from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import xml.etree.ElementTree as ET
from typing import Any

from dotenv import load_dotenv

load_dotenv()  # must run before agents.base reads GOVOS_*/OPENAI_* env vars at import time

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import incident_engine
from models import Incident
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

AUTO_TRIGGER_ENABLED = os.getenv("GOVOS_AUTO_TRIGGER", "true").lower() == "true"
AUTO_TRIGGER_INTERVAL_SECONDS = int(os.getenv("GOVOS_AUTO_TRIGGER_INTERVAL_SECONDS", "90"))

# Real South Delhi locations to draw from for auto-generated incidents —
# mirrors backend/data/wards.json. Every entry gets its own location so
# incidents actually spread across the map instead of clustering.
AUTO_TRIGGER_POOL: list[dict[str, Any]] = [
    {"scenario": "building_collapse", "location": "Satya Niketan", "location_id": "satya-niketan"},
    {"scenario": "building_collapse", "location": "Hauz Khas", "location_id": "hauz-khas"},
    {"scenario": "building_collapse", "location": "Munirka", "location_id": "munirka"},
    {"scenario": "building_collapse", "location": "Safdarjung Enclave", "location_id": "safdarjung-enclave"},
    {"scenario": "flood", "location": "Sarojini Nagar", "location_id": "sarojini-nagar", "zone": "South Delhi", "rainfall_intensity": "high", "expected_duration_hours": 4},
    {"scenario": "flood", "location": "Munirka", "location_id": "munirka", "zone": "South Delhi", "rainfall_intensity": "high", "expected_duration_hours": 4},
]

USE_REAL_NEWS_SIGNAL = os.getenv("GOVOS_USE_REAL_NEWS", "true").lower() == "true"
# India-wide (not Delhi-only) — a Delhi-specific building-collapse/flood
# headline on any given day is rare, so narrowing to "Delhi" starved this of
# matches almost every cycle. Broader search = the sim is actually grounded
# in a real headline most of the time instead of silently falling back to
# the synthetic pool. The real story's real location is never used for the
# simulated response — only the scenario *type* (flood vs collapse) — so
# this is safe to broaden without misrepresenting where a real event happened.
NEWS_RSS_URL = (
    "https://news.google.com/rss/search?q=India%20(building%20collapse%20OR%20structure%20collapse%20OR%20flood%20OR%20waterlogging)"
    "&hl=en-IN&gl=IN&ceid=IN:en"
)
NEWS_LOCALITY_IDS = {
    "satya niketan": ("Satya Niketan", "satya-niketan"),
    "safdarjung": ("Safdarjung Enclave", "safdarjung-enclave"),
    "sarojini nagar": ("Sarojini Nagar", "sarojini-nagar"),
    "munirka": ("Munirka", "munirka"),
    "hauz khas": ("Hauz Khas", "hauz-khas"),
}


async def _fetch_real_news_trigger() -> dict[str, Any] | None:
    """Looks for a real, current Delhi disaster-type headline via Google
    News RSS (public, no API key) and turns it into an incident trigger, so
    auto-generated incidents are grounded in a real external signal rather
    than only a fixed synthetic pool — the same role a real EventBridge
    weather/sensor feed would play. The headline is shown to the user as
    the *reason* the sim fired; the actual scenario still plays out at our
    own simulated South Delhi locations/offices, never the real story's
    real location or any real casualty details."""
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(NEWS_RSS_URL)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        for item in root.findall(".//item")[:25]:
            title_el = item.find("title")
            if title_el is None or not title_el.text:
                continue
            headline = title_el.text
            lower = headline.lower()

            if any(k in lower for k in ("flood", "waterlog", "heavy rain")):
                scenario = "flood"
            elif any(k in lower for k in ("collapse", "building", "fire", "blaze")):
                scenario = "building_collapse"
            else:
                continue

            # If the headline doesn't name one of our known localities,
            # pick one at random rather than always defaulting to the same
            # place — otherwise every unmatched headline piles up at Satya
            # Niketan.
            location, location_id = random.choice(list(NEWS_LOCALITY_IDS.values()))
            for needle, (name, loc_id) in NEWS_LOCALITY_IDS.items():
                if needle in lower:
                    location, location_id = name, loc_id
                    break

            return {
                "scenario": scenario,
                "location": location,
                "location_id": location_id,
                "zone": "South Delhi",
                "rainfall_intensity": "high",
                "expected_duration_hours": 4,
                "source_headline": headline,
            }
    except Exception:
        logger.exception("Real-news trigger fetch failed; falling back to synthetic pool")
    return None


def _broadcast(incident: Incident, event_dict: dict[str, Any]) -> None:
    for q in _subscribers.get(incident.id, []):
        q.put_nowait(event_dict)


def _broadcast_latest(incident: Incident) -> None:
    for q in _latest_subscribers:
        q.put_nowait({"incident_id": incident.id, "title": incident.title, "scenario": incident.scenario})


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
    except Exception:
        logger.exception("Incident run failed for %s", incident.id)
        incident.log("system", "error", "Incident processing failed — see server logs.")
        flush("error")


class TriggerPayload(BaseModel):
    scenario: str = "building_collapse"  # "building_collapse" | "flood"
    location: str = "Satya Niketan"
    location_id: str = "satya-niketan"
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


async def _auto_trigger_loop() -> None:
    """Simulates a live city feed: periodically starts a new incident, exactly
    like a real EventBridge weather/sensor feed would, with no human clicking
    anything. Prefers a real current news signal (see
    _fetch_real_news_trigger) and falls back to the synthetic location pool
    when no matching headline is found this cycle."""
    while True:
        await asyncio.sleep(AUTO_TRIGGER_INTERVAL_SECONDS)
        try:
            trigger = await _fetch_real_news_trigger() if USE_REAL_NEWS_SIGNAL else None
            source = "live news"
            if trigger is None:
                trigger = dict(random.choice(AUTO_TRIGGER_POOL))
                source = "synthetic feed"
            incident = await incident_engine.start_incident(trigger)
            store.save(incident)
            _broadcast_latest(incident)
            logger.info("Auto-triggered incident %s (source=%s): %s", incident.id, source, trigger)
            await _run_and_stream(incident, trigger)
        except Exception:
            logger.exception("Auto-trigger loop iteration failed")


@app.on_event("startup")
async def _start_background_tasks() -> None:
    if AUTO_TRIGGER_ENABLED:
        asyncio.create_task(_auto_trigger_loop())


@app.get("/incidents")
async def list_incidents() -> list[dict[str, Any]]:
    return [json.loads(i.model_dump_json()) for i in store.list()]


@app.get("/incidents/{incident_id}")
async def get_incident(incident_id: str) -> dict[str, Any]:
    incident = store.get(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return json.loads(incident.model_dump_json())


class ApprovalDecision(BaseModel):
    approval_id: str
    approve: bool


@app.post("/incidents/{incident_id}/approve")
async def approve(incident_id: str, decision: ApprovalDecision) -> dict[str, Any]:
    """Field Command override. Every authorization the incident needed was
    already resolved by the real office that holds it (see
    incident_engine._policy_check) the moment it came up — this endpoint is
    the rare veto path for a human watching to override that after the
    fact, never something the incident waits on to proceed."""
    incident = store.get(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")

    sent = len(incident.events)
    await incident_engine.resolve_approval(incident, decision.approval_id, decision.approve)
    store.save(incident)
    for evt in incident.events[sent:]:
        _broadcast(incident, {"type": "event", "phase": "approval", "event": json.loads(evt.model_dump_json())})
    _broadcast(incident, {"type": "state", "phase": "approval", "incident": json.loads(incident.model_dump_json())})
    return json.loads(incident.model_dump_json())


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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
