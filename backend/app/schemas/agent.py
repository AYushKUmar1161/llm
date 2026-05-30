from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AgentType(str, Enum):
    REPO_ARCHITECT = "repo_architect"
    CODE_UNDERSTANDING = "code_understanding"
    FEATURE_ENGINEER = "feature_engineer"
    PR_REVIEWER = "pr_reviewer"
    TEST_ENGINEER = "test_engineer"
    SECURITY = "security"
    DOC_GENERATOR = "doc_generator"
    MEMORY = "memory"


class AgentRunRequest(BaseModel):
    agent_type: AgentType
    repo_id: Optional[uuid.UUID] = None
    conversation_id: Optional[uuid.UUID] = None
    input_data: Dict[str, Any] = Field(default_factory=dict)


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    repo_id: Optional[uuid.UUID] = None
    conversation_id: Optional[uuid.UUID] = None
    agent_type: str
    status: str
    input_data: Dict[str, Any]
    output_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    tokens_input: int
    tokens_output: int
    duration_seconds: Optional[float] = None
    langsmith_run_id: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class PRReviewRequest(BaseModel):
    diff_content: str = Field(..., description="Unified diff content")
    repo_id: Optional[uuid.UUID] = None
    pr_title: Optional[str] = None
    pr_description: Optional[str] = None


class SecurityScanRequest(BaseModel):
    repo_id: Optional[uuid.UUID] = None
    code_snippet: Optional[str] = None
    language: Optional[str] = None


class GenerateTestsRequest(BaseModel):
    file_content: str
    file_path: str
    repo_id: Optional[uuid.UUID] = None
    framework: Optional[str] = None  # pytest | jest


class GenerateDocsRequest(BaseModel):
    repo_id: uuid.UUID
    doc_type: str = Field(default="readme")  # readme | api | architecture | onboarding


class FeaturePlanRequest(BaseModel):
    feature_description: str = Field(..., min_length=10)
    repo_id: uuid.UUID
