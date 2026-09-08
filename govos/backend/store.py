from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Protocol

from models import Incident

LOCAL_STATE_DIR = Path(__file__).parent / ".local_state"


class IncidentStore(Protocol):
    def save(self, incident: Incident) -> None: ...
    def get(self, incident_id: str) -> Incident | None: ...
    def list(self) -> list[Incident]: ...


class LocalJSONStore:
    """Zero-setup store for local dev: one JSON file per incident.
    Swap for DynamoDBStore when deploying to AWS.
    """

    def __init__(self, directory: Path = LOCAL_STATE_DIR) -> None:
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path(self, incident_id: str) -> Path:
        return self.directory / f"{incident_id}.json"

    def save(self, incident: Incident) -> None:
        with self._lock:
            self._path(incident.id).write_text(
                incident.model_dump_json(indent=2), encoding="utf-8"
            )

    def get(self, incident_id: str) -> Incident | None:
        path = self._path(incident_id)
        if not path.exists():
            return None
        return Incident.model_validate_json(path.read_text(encoding="utf-8"))

    def list(self) -> list[Incident]:
        incidents = []
        for path in sorted(self.directory.glob("*.json")):
            incidents.append(Incident.model_validate_json(path.read_text(encoding="utf-8")))
        return incidents


class DynamoDBStore:
    """Production store backed by DynamoDB, table `govos-incidents` with
    partition key `incident_id` (string). The whole Incident is stored as a
    JSON string in a single `payload` attribute — simplest correct option
    for a document-shaped record that changes shape as the app evolves;
    swap for a normalized schema if you need to query into tasks/events
    directly from DynamoDB later.

    Requires AWS credentials to be configured (env vars, shared config, or
    an execution role when running on App Runner / AgentCore / Lambda).
    """

    def __init__(self, table_name: str | None = None) -> None:
        import boto3  # imported lazily so local dev doesn't need it

        self._table_name = table_name or os.getenv("GOVOS_TABLE", "govos-incidents")
        self._table = boto3.resource(
            "dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1")
        ).Table(self._table_name)

    def save(self, incident: Incident) -> None:
        self._table.put_item(
            Item={"incident_id": incident.id, "payload": incident.model_dump_json()}
        )

    def get(self, incident_id: str) -> Incident | None:
        resp = self._table.get_item(Key={"incident_id": incident_id})
        item = resp.get("Item")
        if item is None:
            return None
        return Incident.model_validate_json(item["payload"])

    def list(self) -> list[Incident]:
        resp = self._table.scan()
        return [Incident.model_validate_json(item["payload"]) for item in resp.get("Items", [])]


def get_store() -> IncidentStore:
    if os.getenv("GOVOS_STORE", "local") == "dynamodb":
        return DynamoDBStore()
    return LocalJSONStore()
