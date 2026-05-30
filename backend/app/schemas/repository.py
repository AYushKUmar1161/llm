from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class RepositoryCreate(BaseModel):
    github_url: str = Field(..., description="GitHub repository URL")
    default_branch: str = Field(default="main")


class RepositoryUpdate(BaseModel):
    description: Optional[str] = None
    default_branch: Optional[str] = None


class IndexStatus(BaseModel):
    repo_id: uuid.UUID
    index_status: str
    index_progress: int
    total_files: int
    total_lines: int
    indexed_at: Optional[datetime] = None
    error: Optional[str] = None


class RepositoryStats(BaseModel):
    total_files: int
    total_lines: int
    language: Optional[str] = None
    tech_stack: Dict[str, Any] = {}
    stars: int
    is_private: bool


class RepositoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    github_url: str
    name: str
    full_name: str
    description: Optional[str] = None
    default_branch: str
    language: Optional[str] = None
    stars: int
    is_private: bool
    index_status: str
    index_progress: int
    total_files: int
    total_lines: int
    tech_stack: Dict[str, Any] = {}
    architecture_summary: Optional[str] = None
    last_commit_sha: Optional[str] = None
    indexed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class FileTreeNode(BaseModel):
    name: str
    path: str
    is_dir: bool
    children: Optional[List["FileTreeNode"]] = None
    size: Optional[int] = None
    language: Optional[str] = None


FileTreeNode.model_rebuild()
