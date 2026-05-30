from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def verify_github_signature(
    payload: bytes, signature: str, secret: str
) -> bool:
    """
    Verify that the GitHub webhook payload matches the X-Hub-Signature-256 header.
    """
    if not signature.startswith("sha256="):
        return False
    expected = (
        "sha256="
        + hmac.new(
            secret.encode("utf-8"),
            msg=payload,
            digestmod=hashlib.sha256,
        ).hexdigest()
    )
    return hmac.compare_digest(expected, signature)


async def handle_push(payload: Dict[str, Any]) -> Optional[str]:
    """
    Handle a GitHub push event.
    Dispatches an index_repository_task Celery task for the affected repo.
    Returns the task ID or None if skipped.
    """
    repo_full_name: str = payload.get("repository", {}).get("full_name", "")
    ref: str = payload.get("ref", "")
    head_sha: str = payload.get("after", "")
    pusher: str = payload.get("pusher", {}).get("name", "unknown")

    if not repo_full_name:
        logger.warning("Push event missing repository.full_name")
        return None

    logger.info(
        "Push event for %s ref=%s sha=%s pusher=%s",
        repo_full_name,
        ref,
        head_sha[:8],
        pusher,
    )

    try:
        from app.tasks.index_repository import index_repository_task
        from app.core.database import get_session_factory
        from app.models.repository import Repository
        from sqlalchemy import select

        async_session = get_session_factory()
        async with async_session() as session:
            result = await session.execute(
                select(Repository).where(Repository.full_name == repo_full_name)
            )
            repo = result.scalar_one_or_none()
            if repo is None:
                logger.info("Repository %s not tracked, skipping.", repo_full_name)
                return None

            task = index_repository_task.delay(str(repo.id), str(repo.owner_id))
            logger.info(
                "Dispatched index_repository_task %s for repo %s",
                task.id,
                repo_full_name,
            )
            return task.id
    except Exception as exc:
        logger.error("Failed to handle push event: %s", exc)
        return None


async def handle_pull_request(payload: Dict[str, Any]) -> Optional[str]:
    """
    Handle a GitHub pull_request event.
    Dispatches a PR analysis task.
    """
    action: str = payload.get("action", "")
    pr = payload.get("pull_request", {})
    repo_full_name: str = payload.get("repository", {}).get("full_name", "")
    pr_number: int = pr.get("number", 0)

    if action not in ("opened", "synchronize", "reopened"):
        logger.debug("Ignoring PR action: %s", action)
        return None

    logger.info("PR event: %s #%d in %s", action, pr_number, repo_full_name)

    try:
        from app.tasks.run_agent import run_agent_background

        diff_url = pr.get("diff_url", "")
        task = run_agent_background.delay(
            "pr_reviewer",
            {
                "pr_number": pr_number,
                "repo_full_name": repo_full_name,
                "diff_url": diff_url,
                "title": pr.get("title", ""),
                "description": pr.get("body", ""),
            },
            "system",
            None,
        )
        return task.id
    except Exception as exc:
        logger.error("Failed to handle PR event: %s", exc)
        return None


async def handle_issues(payload: Dict[str, Any]) -> None:
    """Store GitHub issue event in the database."""
    action: str = payload.get("action", "")
    issue = payload.get("issue", {})
    repo_full_name: str = payload.get("repository", {}).get("full_name", "")

    logger.info(
        "Issue event: %s #%d in %s",
        action,
        issue.get("number", 0),
        repo_full_name,
    )
    # Store in memory/DB if needed for future retrieval
    # For now, just log — agents can query GitHub API directly
