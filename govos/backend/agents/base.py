"""Shared Strands Agent runner helper.

NOTE: this targets Strands Agents SDK's documented synchronous call pattern
(`Agent(...)` then `agent(prompt)` returning an `AgentResult` whose `str()`
is the final text). Strands is a fast-moving open source SDK — if your
installed `strands-agents` version exposes a different call shape (e.g. an
async-native `invoke_async`), this is the one place to adjust; every agent
module goes through this single function.
"""

from __future__ import annotations

import asyncio
import os

from strands import Agent
from strands.models import BedrockModel

MODEL_ID = os.getenv(
    "GOVOS_MODEL_ID", "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
)
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")


def build_model() -> BedrockModel:
    return BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION)


async def run_agent_turn(agent: Agent, prompt: str) -> str:
    """Runs one turn of a Strands agent (including any tool calls it makes)
    and returns its final text response. Strands agents are synchronous
    callables, so this offloads the call to a worker thread to avoid
    blocking the FastAPI event loop."""
    result = await asyncio.to_thread(agent, prompt)
    return str(result)
