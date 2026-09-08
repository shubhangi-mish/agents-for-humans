"use client";

import { useEffect, useRef, useState } from "react";
import { Incident, StreamMessage } from "./types";

const API = process.env.NEXT_PUBLIC_GOVOS_API ?? "http://localhost:8080";

export function useEventStream(incidentId: string | null) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!incidentId) return;

    const source = new EventSource(`${API}/stream/${incidentId}`);
    sourceRef.current = source;

    const handle = (raw: MessageEvent) => {
      const msg: StreamMessage = JSON.parse(raw.data);
      if (msg.type === "state" && msg.incident) {
        setIncident(msg.incident);
      }
    };

    source.addEventListener("state", handle as EventListener);
    source.addEventListener("event", handle as EventListener);

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [incidentId]);

  return incident;
}

export async function triggerIncident(payload: {
  zone?: string;
  rainfall_intensity?: string;
  expected_duration_hours?: number;
}): Promise<{ incident_id: string }> {
  const res = await fetch(`${API}/events/incident`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`trigger failed: ${res.status}`);
  return res.json();
}

export async function resolveApproval(
  incidentId: string,
  approvalId: string,
  approve: boolean
): Promise<Incident> {
  const res = await fetch(`${API}/incidents/${incidentId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approval_id: approvalId, approve }),
  });
  if (!res.ok) throw new Error(`approve failed: ${res.status}`);
  return res.json();
}
