from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional
import secrets


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_ENV: str = Field(default="development")
    DEBUG: bool = Field(default=False)
    SECRET_KEY: str = Field(default_factory=lambda: secrets.token_hex(32))

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/codeforge"
    )

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # ChromaDB
    CHROMA_HOST: str = Field(default="localhost")
    CHROMA_PORT: int = Field(default=8000)

    # LLM Provider
    DEFAULT_LLM_PROVIDER: str = Field(default="openai")  # openai | google | anthropic

    # OpenAI
    OPENAI_API_KEY: Optional[str] = Field(default=None)
    OPENAI_MODEL: str = Field(default="gpt-4o")
    OPENAI_EMBEDDING_MODEL: str = Field(default="text-embedding-3-small")

    # Google / Gemini
    GOOGLE_API_KEY: Optional[str] = Field(default=None)
    GEMINI_MODEL: str = Field(default="gemini-1.5-pro")

    # Anthropic
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None)
    ANTHROPIC_MODEL: str = Field(default="claude-3-5-sonnet-20241022")

    # GitHub OAuth
    GITHUB_CLIENT_ID: Optional[str] = Field(default=None)
    GITHUB_CLIENT_SECRET: Optional[str] = Field(default=None)

    # JWT
    JWT_SECRET_KEY: str = Field(default_factory=lambda: secrets.token_hex(32))
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # Repositories storage
    REPOS_BASE_PATH: str = Field(default="/tmp/codeforge_repos")

    # LangSmith
    LANGCHAIN_API_KEY: Optional[str] = Field(default=None)
    LANGCHAIN_TRACING_V2: bool = Field(default=False)

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = Field(default=60)

    # CORS
    ALLOWED_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:5173",
        ]
    )


settings = Settings()
