from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.agent_run import AgentRun
from app.models.repository import Repository
from app.schemas.agent import (
    AgentRunRequest,
    AgentRunResponse,
    PRReviewRequest,
    SecurityScanRequest,
    GenerateTestsRequest,
    GenerateDocsRequest,
    FeaturePlanRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/run", response_model=AgentRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_agent(
    req: AgentRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger any specialized agent to run in the background via Celery."""
    # Validate repository if provided
    if req.repo_id:
        stmt = select(Repository).where(
            Repository.id == req.repo_id, Repository.owner_id == current_user.id
        )
        res = await db.execute(stmt)
        if not res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found or does not belong to you.",
            )

    # Log and create AgentRun state
    run = AgentRun(
        user_id=current_user.id,
        repo_id=req.repo_id,
        conversation_id=req.conversation_id,
        agent_type=req.agent_type.value,
        status="running",
        input_data=req.input_data,
        tokens_input=0,
        tokens_output=0,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Dispatch to Celery background worker
    try:
        from app.tasks.run_agent import run_agent_background
        run_agent_background.delay(
            req.agent_type.value,
            req.input_data,
            str(current_user.id),
            str(req.repo_id) if req.repo_id else None,
        )
    except Exception as exc:
        logger.warning("Celery dispatch failed, running mock state: %s", exc)
        # Mock background task success if celery not available
        pass

    return run


@router.get("/runs", response_model=List[AgentRunResponse])
async def list_agent_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve history of all agent runs triggered by current user."""
    stmt = select(AgentRun).where(AgentRun.user_id == current_user.id).order_by(AgentRun.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
async def get_agent_run(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed logs and output of a specific agent run."""
    stmt = select(AgentRun).where(AgentRun.id == run_id, AgentRun.user_id == current_user.id)
    res = await db.execute(stmt)
    run = res.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent run record not found",
        )
    return run


@router.post("/pr-review")
async def pr_review_endpoint(
    req: PRReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Review pull request diff and generate structured feedback."""
    from app.agents.pr_reviewer import PRReviewAgent
    agent = PRReviewAgent()
    try:
        report = await agent.review(req.diff_content, req.repo_id)
        # Store agent run in DB
        run = AgentRun(
            user_id=current_user.id,
            repo_id=req.repo_id,
            agent_type="pr_reviewer",
            status="completed",
            input_data={"diff_len": len(req.diff_content)},
            output_data={
                "overall_score": report.overall_score,
                "risk_level": report.risk_level,
                "complexity_score": report.complexity_score,
                "security_issues": [str(i) for i in report.security_issues],
                "performance_issues": [str(i) for i in report.performance_issues],
                "suggestions": [str(i) for i in report.suggestions],
            },
            completed_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.commit()
        return report
    except Exception as e:
        logger.error("PR Review failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PR Review failed: {str(e)}",
        )


@router.post("/security-scan")
async def security_scan_endpoint(
    req: SecurityScanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Perform security scanning for secrets and vulnerabilities in code snippet or repository."""
    from app.agents.security_agent import SecurityAgent
    agent = SecurityAgent()
    try:
        if req.code_snippet:
            report = await agent.scan(None, code_snippet=req.code_snippet)
        elif req.repo_id:
            # Verify repo ownership
            stmt = select(Repository).where(
                Repository.id == req.repo_id, Repository.owner_id == current_user.id
            )
            res = await db.execute(stmt)
            repo = res.scalar_one_or_none()
            if not repo:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Repository not found",
                )
            report = await agent.scan(str(repo.id))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either repo_id or code_snippet must be specified.",
            )

        run = AgentRun(
            user_id=current_user.id,
            repo_id=req.repo_id,
            agent_type="security",
            status="completed",
            input_data={"snippet_scan": req.code_snippet is not None},
            output_data={
                "overall_severity": report.overall_severity,
                "secrets_count": len(report.secrets),
                "vulnerabilities_count": len(report.vulnerabilities),
            },
            completed_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.commit()
        return report
    except Exception as e:
        logger.error("Security scan failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Security scan failed: {str(e)}",
        )


@router.post("/generate-tests")
async def generate_tests_endpoint(
    req: GenerateTestsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-generate high-coverage test cases for provided code file."""
    from app.agents.test_engineer import TestEngineerAgent
    agent = TestEngineerAgent()
    try:
        suite = await agent.generate_tests(req.file_content, req.file_path, req.repo_id)
        run = AgentRun(
            user_id=current_user.id,
            repo_id=req.repo_id,
            agent_type="test_engineer",
            status="completed",
            input_data={"file_path": req.file_path},
            output_data={
                "framework": suite.framework,
                "coverage_estimate": suite.coverage_estimate,
                "unit_tests_len": len(suite.unit_tests),
            },
            completed_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.commit()
        return suite
    except Exception as e:
        logger.error("Test generation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test generation failed: {str(e)}",
        )


@router.post("/generate-docs")
async def generate_docs_endpoint(
    req: GenerateDocsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate high-quality documentation (README, API reference, onboarding guides)."""
    # Verify repository ownership
    stmt = select(Repository).where(
        Repository.id == req.repo_id, Repository.owner_id == current_user.id
    )
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found or does not belong to you.",
        )

    from app.agents.doc_generator import DocGenerationAgent
    agent = DocGenerationAgent()
    try:
        if req.doc_type == "readme":
            content = await agent.generate_readme(str(repo.id), None)
        elif req.doc_type == "onboarding":
            content = await agent.generate_onboarding(str(repo.id))
        elif req.doc_type == "architecture":
            content = await agent.generate_architecture_doc(None)
        else:
            content = await agent.generate_api_docs([], "")

        run = AgentRun(
            user_id=current_user.id,
            repo_id=req.repo_id,
            agent_type="doc_generator",
            status="completed",
            input_data={"doc_type": req.doc_type},
            output_data={"content_len": len(content)},
            completed_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.commit()
        return {"content": content}
    except Exception as e:
        logger.error("Doc generation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Doc generation failed: {str(e)}",
        )


@router.post("/feature-plan")
async def feature_plan_endpoint(
    req: FeaturePlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Plan and generate working, unified code changes for a feature description."""
    # Verify repository ownership
    stmt = select(Repository).where(
        Repository.id == req.repo_id, Repository.owner_id == current_user.id
    )
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found or does not belong to you.",
        )

    from app.agents.feature_engineer import FeatureEngineerAgent
    agent = FeatureEngineerAgent()
    try:
        plan = await agent.plan_feature(req.feature_description, str(repo.id))
        run = AgentRun(
            user_id=current_user.id,
            repo_id=req.repo_id,
            agent_type="feature_engineer",
            status="completed",
            input_data={"feature": req.feature_description},
            output_data={
                "impacted_files_count": len(plan.impacted_files),
                "unified_diff_len": len(plan.unified_diff),
            },
            completed_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.commit()
        return plan
    except Exception as e:
        logger.error("Feature planning failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Feature planning failed: {str(e)}",
        )
