from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    title: str = Field(default="New Conversation")
    repo_id: Optional[uuid.UUID] = None


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    repo_id: Optional[uuid.UUID] = None
    title: str
    is_archived: bool
    message_count: int
    created_at: datetime
    updated_at: datetime


class ConversationWithMessages(ConversationResponse):
    messages: List["MessageResponse"] = []


class MessageCreate(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str = Field(..., min_length=1)
    agent_type: Optional[str] = None
    repo_id: Optional[uuid.UUID] = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    agent_type: Optional[str] = None
    sources: List[Dict[str, Any]] = []
    token_count: int
    created_at: datetime


ConversationWithMessages.model_rebuild()
