from strands import Agent

from . import tools
from .base import build_model


def build_intel_agent() -> Agent:
    """Returns a fresh Intel Agent instance. Strands Agent objects hold their
    own conversation history, so each incident gets its own instance rather
    than sharing a module-level singleton across concurrent incidents."""
    return Agent(
        model=build_model(),
        system_prompt=(
            "You are the Intel Agent for GovOS, an autonomous neighborhood emergency "
            "operations system. Given an incident trigger, call your tools to determine "
            "which wards are affected and their risk level, and check hospital access "
            "status where relevant. Respond with a concise 2-3 sentence situation "
            "summary naming the specific wards and risk level. Do not speculate beyond "
            "what the tools return."
        ),
        tools=[tools.get_weather_feed, tools.get_affected_wards, tools.get_hospital_status],
    )
