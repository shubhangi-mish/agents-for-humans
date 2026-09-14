"""Live, geocoded Delhi news feed.

Independent of the simulated incident-response engine (incident_engine.py):
this pulls real headlines from Google News RSS covering Delhi generally —
fire, collapse, flood, crime, accidents, anything — not just the two
scenarios the response engine knows how to simulate a government reaction
for. Each new headline gets a cheap classification pass (keyword match for
"kind") and a locality-extraction pass (an LLM call naming the real Delhi
place the story is about), which is then geocoded via OpenStreetMap
Nominatim to a real lat/lng. If no real locality can be pinned down, the
item is still shown in the feed but never gets a map pin — there is no
fallback to a random or hardcoded location. Every pin on the map is either
a live incident the response engine is running, or a real news story
geocoded to where it actually happened.
"""

from __future__ import annotations

import logging
import time
import xml.etree.ElementTree as ET
from typing import Any, Callable

import httpx
from pydantic import BaseModel, Field

from agents import build_locality_agent
from agents.base import run_agent_turn
from models import new_id

logger = logging.getLogger("govos.news")

# Broad Delhi incident coverage — not limited to the response engine's two
# simulated scenarios. Excludes a couple of noisy unrelated categories that
# otherwise dominate a bare "Delhi" search.
NEWS_RSS_URL = (
    "https://news.google.com/rss/search?q=Delhi%20(fire%20OR%20blaze%20OR%20collapse%20OR%20"
    "flood%20OR%20waterlogging%20OR%20murder%20OR%20stabbing%20OR%20shooting%20OR%20accident%20"
    "OR%20crash%20OR%20blast%20OR%20stampede%20OR%20robbery%20OR%20crime%20OR%20mishap)%20"
    "-cricket%20-bollywood%20-IPL&hl=en-IN&gl=IN&ceid=IN:en"
)

KIND_KEYWORDS: dict[str, list[str]] = {
    "fire": ["fire", "blaze", "burn", "gutted"],
    "collapse": ["collapse", "collapsed", "caved in", "wall fell", "roof fell"],
    "flood": ["flood", "waterlog", "water-log", "heavy rain", "submerged"],
    "crime": ["murder", "stabbing", "stabbed", "shooting", "shot dead", "robbery", "killed", "assault", "crime"],
    "accident": ["accident", "crash", "collision", "run over", "hit by", "mishap"],
}

# west,north,east,south — biases Nominatim toward Delhi NCR without
# hard-excluding just outside it.
DELHI_VIEWBOX = "76.84,28.88,77.35,28.40"
NOMINATIM_USER_AGENT = "GovOS-Delhi-Sim/1.0 (hackathon demo, non-commercial)"

MAX_RECENT = 60

_seen_links: set[str] = set()
_recent_items: list["NewsItem"] = []
_geocode_cache: dict[str, tuple[float, float] | None] = {}


class NewsItem(BaseModel):
    id: str = Field(default_factory=lambda: new_id("news"))
    headline: str
    link: str
    source: str = "Google News"
    published: str | None = None
    kind: str = "other"
    locality: str | None = None
    lat: float | None = None
    lng: float | None = None
    fetched_at: float = Field(default_factory=time.time)


def _classify_kind(headline: str) -> str:
    lowered = headline.lower()
    for kind, keywords in KIND_KEYWORDS.items():
        if any(k in lowered for k in keywords):
            return kind
    return "other"


async def _extract_locality(headline: str) -> str | None:
    try:
        text = await run_agent_turn(build_locality_agent(), headline)
    except Exception:
        logger.exception("Locality extraction failed for headline: %s", headline)
        return None
    text = text.strip().strip(".\"'")
    if not text or text.upper() == "NONE" or len(text) > 60 or "\n" in text:
        return None
    return text


async def _geocode(locality: str) -> tuple[float, float] | None:
    if locality in _geocode_cache:
        return _geocode_cache[locality]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": f"{locality}, Delhi, India",
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "in",
                    "viewbox": DELHI_VIEWBOX,
                    "bounded": 1,
                },
                headers={"User-Agent": NOMINATIM_USER_AGENT},
            )
        resp.raise_for_status()
        results = resp.json()
        result = (float(results[0]["lat"]), float(results[0]["lon"])) if results else None
    except Exception:
        logger.exception("Geocoding failed for locality: %s", locality)
        result = None
    _geocode_cache[locality] = result
    return result


async def _fetch_headlines() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        resp = await client.get(NEWS_RSS_URL)
    resp.raise_for_status()
    root = ET.fromstring(resp.text)
    headlines = []
    for item in root.findall(".//item")[:30]:
        title_el, link_el, pub_el = item.find("title"), item.find("link"), item.find("pubDate")
        if title_el is None or not title_el.text or link_el is None or not link_el.text:
            continue
        headlines.append({
            "title": title_el.text,
            "link": link_el.text,
            "pubDate": pub_el.text if pub_el is not None else None,
        })
    return headlines


async def poll_once(broadcast: Callable[["NewsItem"], None]) -> int:
    """One polling cycle: fetch the RSS feed, process only headlines not
    seen before, geocode each, append to the recent list, and broadcast.
    Returns how many new items were found."""
    try:
        headlines = await _fetch_headlines()
    except Exception:
        logger.exception("News RSS fetch failed")
        return 0

    new_count = 0
    for h in headlines:
        if h["link"] in _seen_links:
            continue
        _seen_links.add(h["link"])
        new_count += 1

        kind = _classify_kind(h["title"])
        locality = await _extract_locality(h["title"])
        lat = lng = None
        if locality:
            geocoded = await _geocode(locality)
            if geocoded:
                lat, lng = geocoded

        news_item = NewsItem(
            headline=h["title"],
            link=h["link"],
            published=h["pubDate"],
            kind=kind,
            locality=locality,
            lat=lat,
            lng=lng,
        )
        _recent_items.append(news_item)
        del _recent_items[:-MAX_RECENT]
        broadcast(news_item)

    return new_count


def recent_items() -> list[NewsItem]:
    return list(reversed(_recent_items))
