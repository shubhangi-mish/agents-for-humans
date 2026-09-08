from strands import Agent

from . import tools
from .base import build_model


def build_policy_agent() -> Agent:
    return Agent(
        model=build_model(),
        system_prompt=(
            "You are the Policy Agent for GovOS. Given a proposed action and the "
            "flood response SOP, decide whether it is auto-approved or requires "
            "human approval, based strictly on the SOP's auto_approved_actions and "
            "requires_human_approval lists and any cost threshold. Respond with "
            "exactly one word first — AUTO_APPROVE or REQUIRES_APPROVAL — followed "
            "by a one-sentence justification citing the SOP rule."
        ),
        tools=[tools.get_sop],
    )
