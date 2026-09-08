from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

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


def _broadcast(incident: Incident, event_dict: dict[str, Any]) -> None:
    for q in _subscribers.get(incident.id, []):
        q.put_nowait(event_dict)


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
    zone: str = "South Delhi"
    rainfall_intensity: str = "high"
    expected_duration_hours: int = 4


@app.post("/events/incident")
async def trigger_incident(payload: TriggerPayload) -> dict[str, str]:
    """Manual/test trigger with a plain JSON body. Use /events/eventbridge for
    the real EventBridge-triggered path."""
    incident = await incident_engine.start_incident(payload.model_dump())
    store.save(incident)
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
    asyncio.create_task(_run_and_stream(incident, trigger))
    return {"incident_id": incident.id}


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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
