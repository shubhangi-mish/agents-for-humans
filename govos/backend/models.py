from __future__ import annotations

import time
import uuid
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def now() -> float:
    return time.time()


class IncidentStatus(str, Enum):
    ACTIVE = "active"
    PAUSED_FOR_APPROVAL = "paused_for_approval"
    RESOLVED = "resolved"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ESCALATED = "escalated"


class Event(BaseModel):
    id: str = Field(default_factory=lambda: new_id("evt"))
    ts: float = Field(default_factory=now)
    agent: str
    kind: str  # e.g. "reasoning", "tool_call", "decision", "message", "system"
    text: str
    data: dict[str, Any] = Field(default_factory=dict)


class Task(BaseModel):
    id: str = Field(default_factory=lambda: new_id("task"))
    title: str
    owner_agent: str
    status: TaskStatus = TaskStatus.PENDING
    ward: Optional[str] = None
    created_at: float = Field(default_factory=now)
    updated_at: float = Field(default_factory=now)
    notes: list[str] = Field(default_factory=list)


class Approval(BaseModel):
    id: str = Field(default_factory=lambda: new_id("appr"))
    reason: str
    evidence: list[str] = Field(default_factory=list)
    action_summary: str
    amount_inr: Optional[float] = None
    status: str = "pending"  # pending | approved | rejected
    # which real office autonomously authorized this, and under what
    # delegated-authority tier — set when the policy engine resolves the
    # action itself instead of waiting on a person. None for the rare
    # case a human later overrides via /approve.
    authorized_by: Optional[str] = None
    authority_tier: Optional[str] = None
    resume_token: Optional[str] = None
    created_at: float = Field(default_factory=now)
    resolved_at: Optional[float] = None


class Incident(BaseModel):
    id: str = Field(default_factory=lambda: new_id("inc"))
    title: str
    scenario: str = "building_collapse"
    location: str = "Satya Niketan"
    # set when this incident was auto-triggered off a real news headline
    # rather than the synthetic location pool — see main.py's
    # _fetch_real_news_trigger. None for manual/synthetic triggers.
    source_headline: Optional[str] = None
    severity: str = "high"
    status: IncidentStatus = IncidentStatus.ACTIVE
    # Real coordinates for incidents outside the five pilot wards (see
    # incident_engine.start_incident) — the frontend map pins here when set,
    # falling back to the pilot wards' fixed lookup table otherwise. None
    # for a pilot-ward incident, which doesn't need it.
    lat: Optional[float] = None
    lng: Optional[float] = None
    affected_wards: list[str] = Field(default_factory=list)
    tasks: list[Task] = Field(default_factory=list)
    approvals: list[Approval] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    # arbitrary bag the orchestrator uses to remember where it left off
    plan_state: dict[str, Any] = Field(default_factory=dict)
    created_at: float = Field(default_factory=now)
    updated_at: float = Field(default_factory=now)

    def log(self, agent: str, kind: str, text: str, **data: Any) -> Event:
        evt = Event(agent=agent, kind=kind, text=text, data=data)
        self.events.append(evt)
        self.updated_at = now()
        return evt
