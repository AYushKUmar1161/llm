from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from celery.utils.log import get_task_logger

from app.tasks.celery_app import celery_app

logger = get_task_logger(__name__)


def _estimate_tokens(data: Any) -> int:
    if not data:
        return 0
    if isinstance(data, str):
        return max(1, len(data) // 4)
    if isinstance(data, (dict, list)):
        try:
            import json
            serialized = json.dumps(data)
            return max(1, len(serialized) // 4)
        except Exception:
            return 0
    return 0


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(
    bind=True,
    name="app.tasks.run_agent.run_agent_background",
    max_retries=2,
    default_retry_delay=30,
    queue="agents",
    time_limit=600,
    soft_time_limit=540,
)
def run_agent_background(
    self,
    agent_type: str,
    input_data: Dict[str, Any],
    user_id: str,
    repo_id: Optional[str],
) -> Dict[str, Any]:
    """
    Background Celery task for running any agent.
    Creates an AgentRun record, executes the agent, updates the record with results.
    """
    logger.info("Running agent %s for user %s", agent_type, user_id)
    try:
        return _run_async(
            _async_run_agent(self, agent_type, input_data, user_id, repo_id)
        )
    except Exception as exc:
        logger.error("Agent run failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc)


async def _async_run_agent(
    task,
    agent_type: str,
    input_data: Dict[str, Any],
    user_id: str,
    repo_id: Optional[str],
) -> Dict[str, Any]:
    from app.core.database import get_session_factory
    from app.models.agent_run import AgentRun
    from sqlalchemy import select

    factory = get_session_factory()
    run_id = uuid.uuid4()
    started_at = datetime.now(timezone.utc)

    # Create AgentRun record
    async with factory() as session:
        run = AgentRun(
            id=run_id,
            user_id=uuid.UUID(user_id),
            repo_id=uuid.UUID(repo_id) if repo_id else None,
            agent_type=agent_type,
            status="running",
            input_data=input_data,
        )
        session.add(run)
        await session.commit()

    # Execute the agent
    output_data: Dict[str, Any] = {}
    error: Optional[str] = None
    tokens_input = _estimate_tokens(input_data)
    tokens_output = 0

    try:
        output_data = await _dispatch_agent(agent_type, input_data, repo_id)
        tokens_output = _estimate_tokens(output_data)
    except Exception as exc:
        error = str(exc)
        logger.error("Agent %s execution error: %s", agent_type, exc)

    completed_at = datetime.now(timezone.utc)
    duration = (completed_at - started_at).total_seconds()
    status = "completed" if error is None else "failed"

    # Update AgentRun record
    async with factory() as session:
        result = await session.execute(
            select(AgentRun).where(AgentRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if run:
            run.status = status
            run.output_data = output_data
            run.error = error
            run.tokens_input = tokens_input
            run.tokens_output = tokens_output
            run.duration_seconds = duration
            run.completed_at = completed_at
            await session.commit()

    return {
        "run_id": str(run_id),
        "status": status,
        "agent_type": agent_type,
        "output": output_data,
        "error": error,
        "duration_seconds": duration,
    }


async def _dispatch_agent(
    agent_type: str,
    input_data: Dict[str, Any],
    repo_id: Optional[str],
) -> Dict[str, Any]:
    if agent_type == "repo_architect":
        from app.agents.repo_architect import RepoArchitectAgent
        agent = RepoArchitectAgent()
        report = agent.analyze(repo_id or "", input_data.get("local_path"))
        return {
            "tech_stack": report.tech_stack,
            "mermaid_diagram": report.mermaid_diagram,
            "summary": report.summary,
            "main_components": report.main_components,
            "design_patterns": report.design_patterns,
        }

    elif agent_type == "code_understanding":
        from app.agents.code_understanding import CodeUnderstandingAgent
        agent = CodeUnderstandingAgent()
        explanation = await agent.explain(
            input_data.get("query", ""), repo_id or ""
        )
        return {"content": explanation.content, "sources": explanation.sources}

    elif agent_type == "feature_engineer":
        from app.agents.feature_engineer import FeatureEngineerAgent
        agent = FeatureEngineerAgent()
        plan = await agent.plan_feature(
            input_data.get("feature_description", ""), repo_id or ""
        )
        return {
            "summary": plan.summary,
            "implementation_steps": plan.implementation_steps,
            "impacted_files": plan.impacted_files,
            "code_changes": [
                {
                    "file_path": c.file_path,
                    "change_type": c.change_type,
                    "description": c.description,
                    "content": c.content[:2000],
                }
                for c in plan.code_changes
            ],
        }

    elif agent_type == "pr_reviewer":
        from app.agents.pr_reviewer import PRReviewAgent
        agent = PRReviewAgent()
        report = await agent.review(
            input_data.get("diff_content", ""),
            repo_id=repo_id,
            pr_title=input_data.get("title"),
            pr_description=input_data.get("description"),
        )
        return {
            "overall_score": report.overall_score,
            "risk_level": report.risk_level,
            "summary": report.summary,
            "total_issues": report.total_issues,
        }

    elif agent_type == "test_engineer":
        from app.agents.test_engineer import TestEngineerAgent
        agent = TestEngineerAgent()
        suite = await agent.generate_tests(
            input_data.get("file_content", ""),
            input_data.get("file_path", "unknown.py"),
            repo_id=repo_id,
            framework=input_data.get("framework"),
        )
        return {
            "unit_tests": suite.unit_tests,
            "edge_cases": suite.edge_cases,
            "framework": suite.framework,
            "coverage_estimate": suite.coverage_estimate,
        }

    elif agent_type == "security":
        from app.agents.security_agent import SecurityAgent
        agent = SecurityAgent()
        report = await agent.scan(
            repo_id or "",
            code_snippet=input_data.get("code_snippet"),
        )
        return {
            "summary": report.summary,
            "overall_severity": report.overall_severity,
            "total_findings": report.total_findings,
            "recommendations": report.recommendations,
        }

    elif agent_type == "doc_generator":
        from app.agents.doc_generator import DocGenerationAgent
        agent = DocGenerationAgent()
        doc_type = input_data.get("doc_type", "readme")
        if doc_type == "readme":
            content = await agent.generate_readme(repo_id or "")
        elif doc_type == "onboarding":
            content = await agent.generate_onboarding(repo_id or "")
        else:
            content = await agent.generate_readme(repo_id or "")
        return {"content": content, "doc_type": doc_type}

    else:
        raise ValueError(f"Unknown agent type: {agent_type}")
