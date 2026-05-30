from __future__ import annotations

import uuid
import logging
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.agent_run import AgentRun
from app.models.repository import Repository
from app.models.conversation import Conversation
from app.schemas.analytics import (
    AnalyticsOverview,
    TokenUsage,
    TokenUsagePoint,
    AgentUsageStats,
    AgentUsageStat,
    RepoStats,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/overview", response_model=AnalyticsOverview)
async def get_analytics_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve aggregate usage statistics across all projects, tokens, and agents."""
    # Counts
    user_count_stmt = select(func.count(User.id))
    user_count_res = await db.execute(user_count_stmt)
    total_users = user_count_res.scalar_one_or_none() or 0

    repo_count_stmt = select(func.count(Repository.id)).where(Repository.owner_id == current_user.id)
    repo_count_res = await db.execute(repo_count_stmt)
    total_repos = repo_count_res.scalar_one_or_none() or 0

    conv_count_stmt = select(func.count(Conversation.id)).where(Conversation.user_id == current_user.id)
    conv_count_res = await db.execute(conv_count_stmt)
    total_conversations = conv_count_res.scalar_one_or_none() or 0

    runs_count_stmt = select(func.count(AgentRun.id)).where(AgentRun.user_id == current_user.id)
    runs_count_res = await db.execute(runs_count_stmt)
    total_agent_runs = runs_count_res.scalar_one_or_none() or 0

    # Token sum
    tokens_sum_stmt = select(
        func.sum(AgentRun.tokens_input + AgentRun.tokens_output)
    ).where(AgentRun.user_id == current_user.id)
    tokens_sum_res = await db.execute(tokens_sum_stmt)
    total_tokens_used = tokens_sum_res.scalar_one_or_none() or 0

    # Weekly stats
    one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    active_repos_week_stmt = select(func.count(func.distinct(Repository.id))).where(
        Repository.owner_id == current_user.id,
        Repository.updated_at >= one_week_ago,
    )
    active_repos_week_res = await db.execute(active_repos_week_stmt)
    active_repos_this_week = active_repos_week_res.scalar_one_or_none() or 0

    runs_week_stmt = select(func.count(AgentRun.id)).where(
        AgentRun.user_id == current_user.id,
        AgentRun.created_at >= one_week_ago,
    )
    runs_week_res = await db.execute(runs_week_stmt)
    runs_this_week = runs_week_res.scalar_one_or_none() or 0

    return AnalyticsOverview(
        total_users=total_users,
        total_repos=total_repos,
        total_conversations=total_conversations,
        total_agent_runs=total_agent_runs,
        total_tokens_used=total_tokens_used,
        active_repos_this_week=active_repos_this_week,
        runs_this_week=runs_this_week,
    )


@router.get("/token-usage", response_model=TokenUsage)
async def get_token_usage_chart(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve structured daily token consumption data for chart visualization."""
    today = date.today()
    daily_points: List[TokenUsagePoint] = []
    total_input = 0
    total_output = 0

    # Let's generate a list of the last 7 days and gather token usage for each day
    for i in range(6, -1, -1):
        target_date = today - timedelta(days=i)
        start_datetime = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
        end_datetime = datetime.combine(target_date, datetime.max.time(), tzinfo=timezone.utc)

        stmt = select(
            func.sum(AgentRun.tokens_input),
            func.sum(AgentRun.tokens_output)
        ).where(
            AgentRun.user_id == current_user.id,
            AgentRun.created_at >= start_datetime,
            AgentRun.created_at <= end_datetime,
        )
        res = await db.execute(stmt)
        row = res.one_or_none()

        inp = 0
        out = 0
        if row:
            inp = row[0] or 0
            out = row[1] or 0

        total_input += inp
        total_output += out

        daily_points.append(
            TokenUsagePoint(
                date=target_date,
                tokens_input=inp,
                tokens_output=out,
                total=inp + out,
            )
        )

    # Calculate mock token cost (estimate: $0.005 per 1k input, $0.015 per 1k output)
    estimated_cost = (total_input * 0.000005) + (total_output * 0.000015)

    return TokenUsage(
        daily=daily_points,
        total_input=total_input,
        total_output=total_output,
        total_cost_usd=round(estimated_cost, 4),
    )


@router.get("/agent-usage", response_model=AgentUsageStats)
async def get_agent_usage_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve run statistics and performance breakdown across all agent types."""
    stmt = select(
        AgentRun.agent_type,
        func.count(AgentRun.id),
        func.sum(AgentRun.tokens_input + AgentRun.tokens_output),
        func.avg(AgentRun.duration_seconds),
        func.sum(func.cast(AgentRun.status == "completed", func.Integer)),
    ).where(AgentRun.user_id == current_user.id).group_by(AgentRun.agent_type)

    res = await db.execute(stmt)
    rows = res.all()

    breakdown: List[AgentUsageStat] = []
    total_runs = 0
    most_used = "None"
    max_runs = 0

    for row in rows:
        agent_type = row[0]
        run_count = row[1] or 0
        total_tokens = row[2] or 0
        avg_dur = float(row[3] or 0.0)
        completed_count = row[4] or 0

        success_rate = (completed_count / run_count) if run_count > 0 else 0.0
        total_runs += run_count

        if run_count > max_runs:
            max_runs = run_count
            most_used = agent_type

        breakdown.append(
            AgentUsageStat(
                agent_type=agent_type,
                run_count=run_count,
                total_tokens=total_tokens,
                avg_duration_seconds=round(avg_dur, 2),
                success_rate=round(success_rate, 2),
            )
        )

    # Standard default agents if breakdown is empty
    if not breakdown:
        most_used = "Orchestrator"

    return AgentUsageStats(
        breakdown=breakdown,
        most_used=most_used,
        total_runs=total_runs,
    )


@router.get("/repo-stats/{repo_id}", response_model=RepoStats)
async def get_repository_analytics(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve repository-specific search, query volume, and agent run statistics."""
    # Verify repo exists and belongs to user
    repo_stmt = select(Repository).where(
        Repository.id == repo_id, Repository.owner_id == current_user.id
    )
    repo_res = await db.execute(repo_stmt)
    repo = repo_res.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found",
        )

    # Count conversations
    queries_stmt = select(func.count(Conversation.id)).where(
        Conversation.repo_id == repo_id, Conversation.user_id == current_user.id
    )
    queries_res = await db.execute(queries_stmt)
    total_queries = queries_res.scalar_one_or_none() or 0

    # Count agent runs for repo
    runs_stmt = select(func.count(AgentRun.id)).where(
        AgentRun.repo_id == repo_id, AgentRun.user_id == current_user.id
    )
    runs_res = await db.execute(runs_stmt)
    total_agent_runs = runs_res.scalar_one_or_none() or 0

    # Token sum for repo
    tokens_stmt = select(
        func.sum(AgentRun.tokens_input + AgentRun.tokens_output)
    ).where(AgentRun.repo_id == repo_id, AgentRun.user_id == current_user.id)
    tokens_res = await db.execute(tokens_stmt)
    total_tokens = tokens_res.scalar_one_or_none() or 0

    # Top agents
    top_agents_stmt = select(
        AgentRun.agent_type,
        func.count(AgentRun.id)
    ).where(
        AgentRun.repo_id == repo_id, AgentRun.user_id == current_user.id
    ).group_by(AgentRun.agent_type).order_by(func.count(AgentRun.id).desc()).limit(3)
    top_agents_res = await db.execute(top_agents_stmt)
    top_agents = [{"agent": row[0], "runs": row[1]} for row in top_agents_res.all()]

    last_activity = repo.updated_at.isoformat()

    return RepoStats(
        repo_id=str(repo_id),
        total_queries=total_queries,
        total_agent_runs=total_agent_runs,
        total_tokens=total_tokens,
        top_agents=top_agents,
        last_activity=last_activity,
    )
