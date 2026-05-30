from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings
from app.core.database import init_db, get_redis, close_redis
from app.api.v1 import router as api_v1_router

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan Events
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Context manager handling application startup and shutdown events."""
    logger.info("Initializing databases and external clients...")
    try:
        # Initialize PostgreSQL DB
        await init_db()
        logger.info("PostgreSQL databases connected successfully.")
    except Exception as e:
        logger.critical("PostgreSQL database connection failed: %s", e)

    try:
        # Initialize Redis
        redis_client = get_redis()
        await redis_client.ping()
        logger.info("Redis cache client connected successfully.")
    except Exception as e:
        logger.warning("Redis cache client connection failed: %s", e)

    yield  # Runs the application

    logger.info("Closing databases and caching connections...")
    await close_redis()
    logger.info("Cleanup complete. Shutdown complete.")


# ---------------------------------------------------------------------------
# FastAPI Setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CodeForge AI API",
    description="Autonomous Software Engineer & Repository Intelligence Platform API Server",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    openapi_url="/api/v1/openapi.json",
)

# ---------------------------------------------------------------------------
# Middlewares
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Exception Handlers
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled global exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred on the server. Please check the logs or contact an administrator.",
            "error_type": type(exc).__name__,
        },
    )


# ---------------------------------------------------------------------------
# Prometheus Instrumentation
# ---------------------------------------------------------------------------
Instrumentator().instrument(app).expose(app, include_in_schema=False)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", status_code=status.HTTP_200_OK, tags=["system"])
async def health_check():
    """Simple system health and status endpoint."""
    redis_status = "unhealthy"
    try:
        await get_redis().ping()
        redis_status = "healthy"
    except Exception:
        pass

    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat() if "datetime" in globals() else None,
        "services": {
            "database": "connected",
            "cache": redis_status,
        },
        "environment": settings.APP_ENV,
    }


# Include v1 API router
app.include_router(api_v1_router, prefix="/api/v1")
