from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator
from typing import Annotated, Any, Dict, List, Optional

from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from typing_extensions import TypedDict

from app.core.llm_factory import llm_factory

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------

_INTENTS = [
    "ANALYZE_REPO",
    "EXPLAIN_CODE",
    "ADD_FEATURE",
    "REVIEW_CODE",
    "GENERATE_TESTS",
    "SECURITY_SCAN",
    "GENERATE_DOCS",
    "GENERAL_CHAT",
]

_CLASSIFY_PROMPT = f"""\
You are an intent classifier for a code intelligence assistant.
Classify the user's message into exactly one of these intents:
{", ".join(_INTENTS)}

Respond with ONLY the intent name, no explanation.

User message: {{message}}
Intent:"""

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    repo_id: Optional[str]
    user_id: str
    intent: Optional[str]
    agent_result: Optional[dict]
    context: Optional[str]
    sources: list
    conversation_history: list


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class OrchestratorAgent:
    """
    LangGraph-based orchestrator that classifies intent and routes to
    the appropriate specialized agent.
    """

    def __init__(self) -> None:
        self._graph = self._build_graph()

    def _build_graph(self) -> Any:
        builder = StateGraph(AgentState)

        builder.add_node("classify_intent", self._classify_intent)
        builder.add_node("route_to_agent", self._route_to_agent)
        builder.add_node("format_response", self._format_response)

        builder.set_entry_point("classify_intent")
        builder.add_edge("classify_intent", "route_to_agent")
        builder.add_edge("route_to_agent", "format_response")
        builder.add_edge("format_response", END)

        return builder.compile()

    # ------------------------------------------------------------------
    # Nodes
    # ------------------------------------------------------------------

    async def _classify_intent(self, state: AgentState) -> AgentState:
        messages = state["messages"]
        if not messages:
            state["intent"] = "GENERAL_CHAT"
            return state

        last_message = messages[-1]
        content = last_message.content if hasattr(last_message, "content") else str(last_message)

        try:
            llm = llm_factory.get_llm(temperature=0.0, streaming=False)
            prompt = _CLASSIFY_PROMPT.format(message=content)
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([HumanMessage(content=prompt)]),
            )
            intent = response.content.strip().upper()
            if intent not in _INTENTS:
                intent = "GENERAL_CHAT"
            state["intent"] = intent
        except Exception as exc:
            logger.warning("Intent classification failed: %s", exc)
            state["intent"] = "GENERAL_CHAT"

        return state

    async def _route_to_agent(self, state: AgentState) -> AgentState:
        intent = state.get("intent", "GENERAL_CHAT")
        repo_id = state.get("repo_id")
        messages = state["messages"]
        last_content = (
            messages[-1].content if messages and hasattr(messages[-1], "content") else ""
        )

        try:
            result = await self._dispatch(intent, last_content, repo_id, state)
            state["agent_result"] = result
            if "sources" in result:
                state["sources"] = result["sources"]
            if "context" in result:
                state["context"] = result["context"]
        except Exception as exc:
            logger.error("Agent dispatch failed for intent %s: %s", intent, exc)
            state["agent_result"] = {"error": str(exc), "answer": None}

        return state

    async def _format_response(self, state: AgentState) -> AgentState:
        result = state.get("agent_result") or {}
        answer = result.get("answer") or result.get("output") or result.get("error", "I encountered an error processing your request.")

        state["messages"] = state["messages"] + [AIMessage(content=answer)]
        return state

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------

    async def _dispatch(
        self, intent: str, query: str, repo_id: Optional[str], state: AgentState
    ) -> Dict[str, Any]:
        history = state.get("conversation_history", [])

        if intent == "ANALYZE_REPO" and repo_id:
            from app.agents.repo_architect import RepoArchitectAgent
            agent = RepoArchitectAgent()
            report = await asyncio.get_event_loop().run_in_executor(
                None, lambda: agent.analyze(repo_id, None)
            )
            return {"answer": report.summary, "context": report.architecture_summary}

        elif intent in ("EXPLAIN_CODE", "GENERAL_CHAT") and repo_id:
            from app.agents.code_understanding import CodeUnderstandingAgent
            agent = CodeUnderstandingAgent()
            explanation = await agent.explain(query, repo_id)
            return {
                "answer": explanation.content,
                "sources": explanation.sources,
                "context": explanation.context,
            }

        elif intent == "ADD_FEATURE" and repo_id:
            from app.agents.feature_engineer import FeatureEngineerAgent
            agent = FeatureEngineerAgent()
            plan = await agent.plan_feature(query, repo_id)
            return {"answer": plan.summary, "context": str(plan.implementation_steps)}

        elif intent == "REVIEW_CODE":
            from app.agents.pr_reviewer import PRReviewAgent
            agent = PRReviewAgent()
            report = await agent.review(query)
            return {"answer": report.summary, "context": str(report.suggestions)}

        elif intent == "GENERATE_TESTS":
            from app.agents.test_engineer import TestEngineerAgent
            agent = TestEngineerAgent()
            suite = await agent.generate_tests(query, "unknown.py")
            return {"answer": suite.unit_tests}

        elif intent == "SECURITY_SCAN" and repo_id:
            from app.agents.security_agent import SecurityAgent
            agent = SecurityAgent()
            report = await agent.scan(repo_id)
            return {"answer": report.summary}

        elif intent == "GENERATE_DOCS" and repo_id:
            from app.agents.doc_generator import DocGenerationAgent
            agent = DocGenerationAgent()
            readme = await agent.generate_readme(repo_id, None)
            return {"answer": readme}

        else:
            # Generic RAG chat
            if repo_id:
                from app.intelligence.rag_pipeline import rag_pipeline
                rag_result = await rag_pipeline.run(repo_id, query, history)
                return {
                    "answer": rag_result.answer,
                    "sources": rag_result.sources,
                }
            else:
                llm = llm_factory.get_llm(temperature=0.2, streaming=False)
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: llm.invoke([
                        SystemMessage(content="You are CodeForge AI, a helpful software engineering assistant."),
                        HumanMessage(content=query),
                    ]),
                )
                return {"answer": response.content}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run(self, state: AgentState) -> AgentState:
        return await self._graph.ainvoke(state)

    async def stream(self, state: AgentState) -> AsyncGenerator[str, None]:
        """Stream agent response tokens."""
        result_state = await self.run(state)
        messages = result_state.get("messages", [])
        if messages:
            last = messages[-1]
            content = last.content if hasattr(last, "content") else str(last)
            # Simulate streaming for the final answer
            words = content.split(" ")
            for i, word in enumerate(words):
                yield word + (" " if i < len(words) - 1 else "")
                await asyncio.sleep(0)  # yield control


# Singleton
orchestrator = OrchestratorAgent()
