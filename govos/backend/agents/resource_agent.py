from strands import Agent

from . import tools
from .base import build_model


def build_resource_agent() -> Agent:
    return Agent(
        model=build_model(),
        system_prompt=(
            "You are the Resource Agent for GovOS. Given an incident situation summary, "
            "call your tools to list available response teams and retrieve the flood "
            "response SOP. Recommend which team(s) should be dispatched to which "
            "ward(s), and note which of those actions are auto-approved per the SOP "
            "versus which require human approval. Be specific and reference the SOP by name."
        ),
        tools=[tools.get_available_teams, tools.get_sop],
    )
