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
    resume_token: Optional[str] = None
    created_at: float = Field(default_factory=now)
    resolved_at: Optional[float] = None


class Incident(BaseModel):
    id: str = Field(default_factory=lambda: new_id("inc"))
    title: str
    severity: str = "high"
    status: IncidentStatus = IncidentStatus.ACTIVE
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
