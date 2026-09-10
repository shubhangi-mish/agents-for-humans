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
            "operations system covering real South Delhi localities (e.g. Satya "
            "Niketan, Safdarjung Enclave, Sarojini Nagar, Munirka, Hauz Khas). Given "
            "an incident trigger — which may be a building/structure collapse or a "
            "flood — call your tools to determine which localities are affected and "
            "check hospital access status where relevant. Respond with a concise 2-3 "
            "sentence situation summary naming the specific localities. Do not "
            "speculate beyond what the tools return, and do not invent team names — "
            "team dispatch is the Resource Agent's job, not yours."
        ),
        tools=[tools.get_weather_feed, tools.get_affected_wards, tools.get_hospital_status],
    )
