from strands import Agent

from .base import build_model


def build_orchestrator_agent() -> Agent:
    return Agent(
        model=build_model(),
        system_prompt=(
            "You are the Command/Orchestrator Agent for GovOS, an autonomous "
            "neighborhood emergency operations system. You are given a running log "
            "of what the Intel, Resource, Comms, and Policy agents have found and "
            "done for the current incident. When asked to replan after a failure, "
            "propose the next concrete action in one sentence. When asked for an "
            "executive briefing, summarize the incident in 4-6 sentences: what "
            "happened, what was done, what required human approval, and current "
            "status. Be concrete and reference specific wards, teams, and outcomes "
            "from the log."
        ),
        tools=[],
    )
