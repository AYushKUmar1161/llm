from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.repository import Repository
from app.models.memory import RepositoryMemory
from app.schemas.repository import (
    RepositoryCreate,
    RepositoryResponse,
    RepositoryUpdate,
    IndexStatus,
    FileTreeNode,
)
from app.schemas.conversation import ConversationResponse

router = APIRouter()


def parse_github_url(url: str) -> tuple[str, str]:
    """Parse github url to extract owner/repo and repo name."""
    url = url.strip()
    # Handle ssh urls git@github.com:owner/repo.git
    if url.startswith("git@"):
        match = re.search(r"github\.com[:/]([^/]+)/([^.]+)(?:\.git)?", url)
        if match:
            return f"{match.group(1)}/{match.group(2)}", match.group(2)
    # Handle HTTP urls https://github.com/owner/repo.git
    match = re.search(r"github\.com/([^/]+)/([^/.]+)(?:\.git)?", url)
    if match:
        return f"{match.group(1)}/{match.group(2)}", match.group(2)

    raise ValueError("Invalid GitHub repository URL format")


@router.post("", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
async def connect_repository(
    repo_in: RepositoryCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Connect a new GitHub repository to the workspace and trigger indexing."""
    try:
        full_name, name = parse_github_url(repo_in.github_url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Check if this repository is already connected by this user
    stmt = select(Repository).where(
        Repository.full_name == full_name, Repository.owner_id == current_user.id
    )
    res = await db.execute(stmt)
    existing_repo = res.scalar_one_or_none()
    if existing_repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repository is already connected for this account.",
        )

    # Create new repository record
    repo = Repository(
        owner_id=current_user.id,
        github_url=repo_in.github_url,
        name=name,
        full_name=full_name,
        default_branch=repo_in.default_branch,
        index_status="pending",
        index_progress=0,
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    # Trigger Celery background indexing task with local background thread fallback
    try:
        from app.tasks.index_repository import index_repository_task
        index_repository_task.delay(str(repo.id), str(current_user.id))
    except Exception as exc:
        from app.tasks.index_repository import _async_index_repository
        background_tasks.add_task(_async_index_repository, None, str(repo.id), str(current_user.id))

    return repo


@router.get("", response_model=List[RepositoryResponse])
async def list_repositories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all connected repositories for the current user."""
    stmt = select(Repository).where(Repository.owner_id == current_user.id).order_by(Repository.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repository(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed information about a connected repository."""
    stmt = select(Repository).where(Repository.id == repo_id, Repository.owner_id == current_user.id)
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_repository(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect a repository and delete its associated data."""
    stmt = select(Repository).where(Repository.id == repo_id, Repository.owner_id == current_user.id)
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    # Drop vector DB collection
    try:
        from app.intelligence.embedder import RepositoryEmbedder
        # We can try to delete vector store collections
        embedder = RepositoryEmbedder()
        import asyncio
        asyncio.create_task(embedder.delete_repository(str(repo.id)))
    except Exception:
        pass

    # Delete local cloned files if exists
    if repo.local_path and os.path.exists(repo.local_path):
        import shutil
        try:
            shutil.rmtree(repo.local_path, ignore_errors=True)
        except Exception:
            pass

    await db.delete(repo)
    await db.commit()
    return None


@router.post("/{repo_id}/reindex", response_model=RepositoryResponse)
@router.post("/{repo_id}/index", response_model=RepositoryResponse)
async def reindex_repository(
    repo_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Force re-indexing of a connected repository."""
    stmt = select(Repository).where(Repository.id == repo_id, Repository.owner_id == current_user.id)
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    repo.index_status = "pending"
    repo.index_progress = 0
    await db.commit()
    await db.refresh(repo)

    # Trigger Celery background indexing task with local background thread fallback
    try:
        from app.tasks.index_repository import index_repository_task
        index_repository_task.delay(str(repo.id), str(current_user.id))
    except Exception:
        from app.tasks.index_repository import _async_index_repository
        background_tasks.add_task(_async_index_repository, None, str(repo.id), str(current_user.id))

    return repo


@router.get("/{repo_id}/status", response_model=IndexStatus)
@router.get("/{repo_id}/index-status", response_model=IndexStatus)
async def get_index_status(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the current indexing status and progress of a repository."""
    stmt = select(Repository).where(Repository.id == repo_id, Repository.owner_id == current_user.id)
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    return IndexStatus(
        repo_id=repo.id,
        index_status=repo.index_status,
        index_progress=repo.index_progress,
        total_files=repo.total_files,
        total_lines=repo.total_lines,
        indexed_at=repo.indexed_at,
    )


@router.get("/{repo_id}/architecture")
async def get_architecture_report(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the parsed repository architectural analysis report."""
    stmt = select(Repository).where(Repository.id == repo_id, Repository.owner_id == current_user.id)
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    if not repo.architecture_summary and repo.index_status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Architecture analysis is not ready yet. Please wait for indexing to complete.",
        )

    # Let's see if there is an architecture memory entry or parsed json
    import json
    tech_stack = repo.tech_stack
    summary = repo.architecture_summary or "No architecture analysis found."

    # Look for a repository memory entry of type 'analysis' or 'architecture'
    stmt_mem = select(RepositoryMemory).where(
        RepositoryMemory.repo_id == repo.id,
        RepositoryMemory.memory_type == "analysis"
    )
    res_mem = await db.execute(stmt_mem)
    memories = res_mem.scalars().all()

    mermaid_diagram = ""
    for mem in memories:
        if "mermaid_diagram" in mem.metadata_:
            mermaid_diagram = mem.metadata_["mermaid_diagram"]
            break
        elif "mermaid" in mem.metadata_:
            mermaid_diagram = mem.metadata_["mermaid"]
            break
        elif "graph" in mem.metadata_:
            mermaid_diagram = mem.metadata_["graph"]
            break

    if not mermaid_diagram and "graph TD" in summary:
        # Extract mermaid from summary if inline
        match = re.search(r"```mermaid\n(.*?)\n```", summary, re.DOTALL)
        if match:
            mermaid_diagram = match.group(1)

    return {
        "summary": summary,
        "tech_stack": tech_stack,
        "mermaid_diagram": mermaid_diagram or "graph TD\n    A[No Diagram Generated]",
    }


@router.get("/{repo_id}/files", response_model=List[FileTreeNode])
@router.get("/{repo_id}/tree", response_model=List[FileTreeNode])
async def get_file_tree(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the full file explorer directory tree structure of the repository."""
    stmt = select(Repository).where(Repository.id == repo_id, Repository.owner_id == current_user.id)
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    if not repo.local_path or not os.path.exists(repo.local_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repository cloned path is unavailable.",
        )

    base_path = repo.local_path

    def build_tree(current_dir: str) -> List[FileTreeNode]:
        nodes = []
        try:
            entries = sorted(os.scandir(current_dir), key=lambda e: (not e.is_dir(), e.name))
        except OSError:
            return nodes

        for entry in entries:
            # Exclude folders
            if entry.name in {
                ".git",
                "node_modules",
                "__pycache__",
                "dist",
                "build",
                ".next",
                "venv",
                ".env",
            }:
                continue

            rel_path = os.path.relpath(entry.path, base_path).replace("\\", "/")
            if entry.is_dir():
                children = build_tree(entry.path)
                nodes.append(
                    FileTreeNode(
                        name=entry.name,
                        path=rel_path,
                        is_dir=True,
                        children=children,
                    )
                )
            else:
                ext = os.path.splitext(entry.name)[1].lower()
                lang_map = {
                    ".py": "python",
                    ".js": "javascript",
                    ".ts": "typescript",
                    ".tsx": "typescript",
                    ".jsx": "javascript",
                    ".java": "java",
                    ".html": "html",
                    ".css": "css",
                    ".md": "markdown",
                    ".json": "json",
                }
                nodes.append(
                    FileTreeNode(
                        name=entry.name,
                        path=rel_path,
                        is_dir=False,
                        size=entry.stat().st_size,
                        language=lang_map.get(ext, "text"),
                    )
                )
        return nodes

    return build_tree(base_path)


@router.get("/{repo_id}/memory")
async def get_repository_memory(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve long-term memory logs and ADR entries for this repository."""
    stmt = select(Repository).where(Repository.id == repo_id, Repository.owner_id == current_user.id)
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    stmt_mem = select(RepositoryMemory).where(RepositoryMemory.repo_id == repo.id).order_by(RepositoryMemory.created_at.desc())
    res_mem = await db.execute(stmt_mem)
    memories = res_mem.scalars().all()

    return [
        {
            "id": m.id,
            "memory_type": m.memory_type,
            "title": m.title,
            "content": m.content,
            "metadata": m.metadata_,
            "created_at": m.created_at,
        }
        for m in memories
    ]


@router.get("/{repo_id}/conversations", response_model=List[ConversationResponse])
async def list_repository_conversations(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations for a specific repository."""
    from app.models.conversation import Conversation

    stmt = select(Conversation).where(
        Conversation.user_id == current_user.id,
        Conversation.repo_id == repo_id,
        Conversation.is_archived == False
    ).order_by(Conversation.updated_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()
