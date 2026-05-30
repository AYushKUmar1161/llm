from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    github_url: Mapped[str] = mapped_column(String(512), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_branch: Mapped[str] = mapped_column(String(128), nullable=False, default="main")
    language: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    stars: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Indexing status
    index_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending"
    )  # pending | indexing | ready | failed
    index_progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_files: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_lines: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    tech_stack: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    architecture_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    local_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    last_commit_sha: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    indexed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now, server_default=func.now()
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="repositories")

    def __repr__(self) -> str:
        return f"<Repository id={self.id} full_name={self.full_name}>"
