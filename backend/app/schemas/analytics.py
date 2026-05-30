from __future__ import annotations

from datetime import date
from typing import Any, Dict, List

from pydantic import BaseModel


class TokenUsagePoint(BaseModel):
    date: date
    tokens_input: int
    tokens_output: int
    total: int


class AgentUsageStat(BaseModel):
    agent_type: str
    run_count: int
    total_tokens: int
    avg_duration_seconds: float
    success_rate: float


class AnalyticsOverview(BaseModel):
    total_users: int
    total_repos: int
    total_conversations: int
    total_agent_runs: int
    total_tokens_used: int
    active_repos_this_week: int
    runs_this_week: int


class TokenUsage(BaseModel):
    daily: List[TokenUsagePoint]
    total_input: int
    total_output: int
    total_cost_usd: float


class AgentUsageStats(BaseModel):
    breakdown: List[AgentUsageStat]
    most_used: str
    total_runs: int


class RepoStats(BaseModel):
    repo_id: str
    total_queries: int
    total_agent_runs: int
    total_tokens: int
    top_agents: List[Dict[str, Any]]
    last_activity: str
