"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuditRow, Directive, Incident, NewsItem, StreamMessage } from "./types";

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

/** Live list of every incident the city map shows as a trigger point.
 * Polls (cheap — local JSON store) so status/severity stay fresh, and also
 * listens on /stream/latest so a brand-new incident's pin appears
 * immediately instead of waiting for the next poll tick. */
export function useIncidentList(): Incident[] {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetch(`${API}/incidents`)
        .then((r) => r.json())
        .then((list: Incident[]) => {
          if (!cancelled) setIncidents(list);
        })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 5000);

    const source = new EventSource(`${API}/stream/latest`);
    source.addEventListener("new_incident", () => refresh());

    return () => {
      cancelled = true;
      clearInterval(interval);
      source.close();
    };
  }, []);

  return incidents;
}

export async function triggerIncident(payload: {
  scenario?: string;
  location?: string;
  location_id?: string;
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

const MAX_NEWS_ITEMS = 60;

/** De-dupes by `link` (the real, stable identity of a story) rather than
 * `id` (which is freshly minted per broadcast) — a backend restart resets
 * its own seen-links memory and will re-announce the same real headlines as
 * "new", so the frontend has to be the one place duplicates can't survive.
 * Keeps the first (most complete/most recent) copy of each link. */
function dedupeByLink(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    out.push(item);
  }
  return out;
}

/** Live feed of real Delhi news — independent of the incident list above.
 * Loads the recent snapshot once, then appends whatever news_feed.py finds
 * on /stream/news as it's found. Every item here is a real headline; ones
 * with lat/lng attached were successfully geocoded to a real locality and
 * get a map pin, the rest still show in the feed without one. */
export function useNewsFeed(): NewsItem[] {
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API}/news`)
      .then((r) => r.json())
      .then((list: NewsItem[]) => {
        if (cancelled) return;
        setItems(dedupeByLink(list));
        // Nothing polls itself on a timer (see refreshNews below) — but an
        // empty cache on first load is a confusing "is this broken?" dead
        // end, not a cost concern, so this fires exactly one poll the
        // first time anyone opens the app to an empty feed.
        if (list.length === 0) refreshNews().catch(() => {});
      })
      .catch(() => {});

    const source = new EventSource(`${API}/stream/news`);
    source.addEventListener("news_item", (raw) => {
      const item: NewsItem = JSON.parse((raw as MessageEvent).data);
      setItems((prev) => dedupeByLink([item, ...prev]).slice(0, MAX_NEWS_ITEMS));
    });

    return () => {
      cancelled = true;
      source.close();
    };
  }, []);

  return items;
}

/** On-demand poll — the Refresh button's target. Nothing polls itself on a
 * timer by default (see backend/main.py's NEWS_FEED_BACKGROUND_POLLING);
 * this is the only thing that spends a real LLM/geocoding call, and only
 * when someone actually asks for it. New items arrive back through the
 * already-open /stream/news connection useNewsFeed listens on — this call
 * just triggers the poll, it doesn't need to return the items itself. */
export async function refreshNews(): Promise<{ new_items: number }> {
  const res = await fetch(`${API}/news/refresh`, { method: "POST" });
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  return res.json();
}

export async function resolveApproval(
  incidentId: string,
  approvalId: string,
  approve: boolean,
  actor: string
): Promise<Incident> {
  const res = await fetch(`${API}/incidents/${incidentId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approval_id: approvalId, approve, actor }),
  });
  if (!res.ok) throw new Error(`approve failed: ${res.status}`);
  return res.json();
}

/** Posts a note from the signed-in persona onto an incident — every other
 * authority who opens it sees the same comment thread, since it's stored
 * on the incident itself, not per-viewer. The new state comes back over
 * the already-open /stream/{id} connection, so callers don't need to do
 * anything with this function's return value. */
export async function postComment(
  incidentId: string,
  author: string,
  authorRole: string,
  text: string,
  taggedOffice: string | null = null
): Promise<Incident> {
  const res = await fetch(`${API}/incidents/${incidentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ author, author_role: authorRole, text, tagged_office: taggedOffice }),
  });
  if (!res.ok) throw new Error(`comment failed: ${res.status}`);
  return res.json();
}

/** The CM's (or any signed-in authority's) city-wide oversight view — every
 * authorization across every incident, newest first, refetched on demand
 * rather than streamed (this is a low-frequency "check the record" view,
 * not something that needs live push updates). */
export function useAuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch(`${API}/audit`)
      .then((r) => r.json())
      .then((list: AuditRow[]) => setRows(list))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, loading, refresh };
}

/** City-wide directives — a signed-in authority messaging a specific real
 * office directly, independent of any one incident. Refetched on demand,
 * same low-frequency pattern as the audit log. */
export function useDirectives() {
  const [directives, setDirectives] = useState<Directive[]>([]);

  const refresh = useCallback(() => {
    fetch(`${API}/directives`)
      .then((r) => r.json())
      .then((list: Directive[]) => setDirectives(list))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { directives, refresh };
}

export async function sendDirective(
  fromActor: string,
  fromRole: string,
  toOffice: string,
  text: string
): Promise<Directive> {
  const res = await fetch(`${API}/directives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from_actor: fromActor, from_role: fromRole, to_office: toOffice, text }),
  });
  if (!res.ok) throw new Error(`send directive failed: ${res.status}`);
  return res.json();
}
