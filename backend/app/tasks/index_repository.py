from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from celery import Task
from celery.utils.log import get_task_logger

from app.tasks.celery_app import celery_app

logger = get_task_logger(__name__)


def _publish_progress(repo_id: str, stage: str, progress: int, message: str) -> None:
    """Publish indexing progress to Redis pubsub."""
    try:
        import redis

        r = redis.from_url(
            __import__("app.core.config", fromlist=["settings"]).settings.REDIS_URL
        )
        channel = f"indexing:{repo_id}"
        payload = json.dumps({
            "stage": stage,
            "progress": progress,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        r.publish(channel, payload)
    except Exception as exc:
        logger.debug("Progress publish failed: %s", exc)


def _run_async(coro):
    """Run an async coroutine in a synchronous Celery task."""
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
    name="app.tasks.index_repository.index_repository_task",
    max_retries=3,
    default_retry_delay=60,
    queue="indexing",
    time_limit=3600,
    soft_time_limit=3300,
)
def index_repository_task(self: Task, repo_id: str, user_id: str) -> dict:
    """
    Full repository indexing pipeline:
    1. Clone/update repo
    2. List and read all files
    3. Parse AST symbols
    4. Chunk code
    5. Embed and store in ChromaDB
    6. Run repo architect analysis
    7. Update DB status
    """
    logger.info("Starting index for repo_id=%s user_id=%s", repo_id, user_id)
    _publish_progress(repo_id, "started", 0, "Indexing started")

    try:
        return _run_async(_async_index_repository(self, repo_id, user_id))
    except Exception as exc:
        logger.error("Indexing failed for repo %s: %s", repo_id, exc, exc_info=True)
        _run_async(_update_repo_status(repo_id, "failed", 0, str(exc)))
        raise self.retry(exc=exc)


async def _async_index_repository(task: Task, repo_id: str, user_id: str) -> dict:
    from app.core.config import settings
    from app.core.database import get_session_factory
    from app.models.repository import Repository
    from app.github.cloner import RepositoryCloner
    from app.intelligence.ast_parser import ASTParser
    from app.intelligence.chunker import ASTAwareChunker
    from app.intelligence.embedder import RepositoryEmbedder
    from sqlalchemy import select

    factory = get_session_factory()
    cloner = RepositoryCloner()
    parser = ASTParser()
    chunker = ASTAwareChunker()
    embedder = RepositoryEmbedder()

    # --- Load repo from DB ---
    async with factory() as session:
        result = await session.execute(
            select(Repository).where(Repository.id == uuid.UUID(repo_id))
        )
        repo = result.scalar_one_or_none()
        if repo is None:
            raise ValueError(f"Repository {repo_id} not found in database")

        github_url = repo.github_url
        token = repo.owner.github_token if repo.owner else None

    # --- Update status: indexing ---
    await _update_repo_status(repo_id, "indexing", 5)
    _publish_progress(repo_id, "cloning", 5, "Cloning repository...")

    # --- Step 1: Clone / update ---
    local_path = cloner.clone_repo(github_url, repo_id, token=token)
    _publish_progress(repo_id, "cloned", 15, "Repository cloned")

    # --- Step 2: List files ---
    files = cloner.list_files(local_path)
    total_files = len(files)
    logger.info("Found %d files to index", total_files)
    _publish_progress(repo_id, "listing", 20, f"Found {total_files} files")

    # --- Steps 3-4: Parse and chunk ---
    all_chunks = []
    total_lines = 0

    for i, rel_path in enumerate(files):
        content = cloner.read_file(local_path, rel_path)
        if not content:
            continue
        total_lines += content.count("\n")
        symbols = parser.parse_file(rel_path, content)
        chunks = chunker.chunk_file(rel_path, content, symbols)
        all_chunks.extend(chunks)

        if i % 50 == 0:
            progress = 20 + int((i / max(total_files, 1)) * 40)
            _publish_progress(
                repo_id, "parsing", progress,
                f"Parsed {i}/{total_files} files, {len(all_chunks)} chunks so far"
            )

    logger.info("Created %d chunks from %d files", len(all_chunks), total_files)
    _publish_progress(repo_id, "embedding", 60, f"Embedding {len(all_chunks)} chunks...")

    # --- Step 5: Embed ---
    embedded_count = await embedder.embed_repository(repo_id, all_chunks)
    _publish_progress(repo_id, "embedded", 80, f"Embedded {embedded_count} chunks")

    # --- Step 6: Run architect analysis ---
    _publish_progress(repo_id, "analyzing", 85, "Analyzing repository architecture...")
    from app.agents.repo_architect import RepoArchitectAgent

    architect = RepoArchitectAgent()
    arch_report = architect.analyze(repo_id, local_path)

    # --- Step 7: Update DB ---
    try:
        new_sha = cloner.update_repo(local_path)
    except Exception:
        new_sha = None

    await _update_repo_complete(
        repo_id=repo_id,
        total_files=total_files,
        total_lines=total_lines,
        tech_stack=arch_report.tech_stack,
        architecture_summary=arch_report.architecture_summary,
        local_path=local_path,
        last_commit_sha=new_sha,
    )

    # Store arch report in memory
    from app.agents.memory_agent import memory_agent
    await memory_agent.store_memory(
        repo_id=repo_id,
        memory_type="analysis",
        title="Repository Architecture Analysis",
        content=arch_report.summary,
        metadata={
            "mermaid_diagram": arch_report.mermaid_diagram,
            "main_components": arch_report.main_components,
        },
    )

    _publish_progress(repo_id, "complete", 100, "Indexing complete!")
    logger.info("Indexing complete for repo %s: %d files, %d chunks", repo_id, total_files, len(all_chunks))

    return {
        "repo_id": repo_id,
        "total_files": total_files,
        "total_lines": total_lines,
        "total_chunks": len(all_chunks),
        "embedded_chunks": embedded_count,
        "status": "ready",
    }


async def _update_repo_status(repo_id: str, status: str, progress: int, error: str = "") -> None:
    from app.core.database import get_session_factory
    from app.models.repository import Repository
    from sqlalchemy import select

    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(Repository).where(Repository.id == uuid.UUID(repo_id))
        )
        repo = result.scalar_one_or_none()
        if repo:
            repo.index_status = status
            repo.index_progress = progress
            if error and status == "failed":
                repo.tech_stack = {**(repo.tech_stack or {}), "error": error}
            await session.commit()


async def _update_repo_complete(
    repo_id: str,
    total_files: int,
    total_lines: int,
    tech_stack: dict,
    architecture_summary: str,
    local_path: str,
    last_commit_sha: Optional[str],
) -> None:
    from app.core.database import get_session_factory
    from app.models.repository import Repository
    from sqlalchemy import select

    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(Repository).where(Repository.id == uuid.UUID(repo_id))
        )
        repo = result.scalar_one_or_none()
        if repo:
            repo.index_status = "ready"
            repo.index_progress = 100
            repo.total_files = total_files
            repo.total_lines = total_lines
            repo.tech_stack = tech_stack
            repo.architecture_summary = architecture_summary
            repo.local_path = local_path
            repo.last_commit_sha = last_commit_sha
            repo.indexed_at = datetime.now(timezone.utc)
            await session.commit()
