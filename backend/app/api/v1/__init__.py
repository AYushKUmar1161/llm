from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.repos import router as repos_router
from app.api.v1.chat import router as chat_router
from app.api.v1.agents import router as agents_router
from app.api.v1.analytics import router as analytics_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(repos_router, prefix="/repos", tags=["repos"])
router.include_router(repos_router, prefix="/repositories", tags=["repositories"])
router.include_router(chat_router, prefix="/chat", tags=["chat"])
router.include_router(chat_router, prefix="/conversations", tags=["conversations"])
router.include_router(agents_router, prefix="/agents", tags=["agents"])
router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
