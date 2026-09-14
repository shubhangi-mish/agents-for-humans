from strands import Agent

from .base import build_model


def build_locality_agent() -> Agent:
    """Returns a fresh Locality Agent instance — single-shot use per
    headline (see news_feed.py), never reused across calls, so one
    headline's context never bleeds into the next extraction. Its only job
    is naming the real Delhi place a headline is actually about, so the
    live news map never has to guess or fall back to a random location."""
    return Agent(
        model=build_model(),
        system_prompt=(
            "You extract the specific Delhi locality, neighborhood, colony, "
            "or area name a news headline is about — e.g. 'Mustafabad', "
            "'Old Delhi', 'Rohini', 'Connaught Place', 'Dwarka Sector 12'. "
            "Reply with ONLY that name, nothing else — no punctuation, no "
            "explanation. If the headline does not name a specific Delhi "
            "locality (e.g. it only says 'Delhi' generally, or isn't about "
            "Delhi at all), reply with exactly: NONE"
        ),
    )
