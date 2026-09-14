from strands import Agent

from . import tools
from .base import build_model


def build_comms_agent() -> Agent:
    return Agent(
        model=build_model(),
        system_prompt=(
            "You are the Communications Agent for GovOS. Given a team/responder to "
            "notify and the task they're being assigned, draft a short, clear "
            "deployment message (1-2 sentences) and call the simulate_contact tool "
            "(with the responder's name and team) to send it. Report back whether "
            "the contact was confirmed."
        ),
        tools=[tools.simulate_contact, tools.contact_responder, tools.get_responder],
    )
