from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMFactory:
    """Central factory for creating LLM and embedding instances."""

    def get_llm(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.1,
        streaming: bool = True,
    ):
        """
        Return a LangChain chat model for the given provider.
        Falls back through available providers if the primary is misconfigured.
        """
        resolved_provider = provider or settings.DEFAULT_LLM_PROVIDER
        providers_to_try = self._build_fallback_chain(resolved_provider)

        last_exc: Optional[Exception] = None
        for prov in providers_to_try:
            try:
                return self._create_chat_model(prov, model, temperature, streaming)
            except Exception as exc:
                logger.warning("LLM provider '%s' unavailable: %s", prov, exc)
                last_exc = exc

        raise RuntimeError(
            f"No LLM provider available. Last error: {last_exc}"
        )

    def _create_chat_model(
        self,
        provider: str,
        model: Optional[str],
        temperature: float,
        streaming: bool,
    ):
        if provider == "openai":
            from langchain_openai import ChatOpenAI

            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not configured")
            return ChatOpenAI(
                model=model or settings.OPENAI_MODEL,
                temperature=temperature,
                streaming=streaming,
                api_key=settings.OPENAI_API_KEY,
            )

        elif provider == "google":
            from langchain_google_genai import ChatGoogleGenerativeAI

            if not settings.GOOGLE_API_KEY:
                raise ValueError("GOOGLE_API_KEY not configured")
            return ChatGoogleGenerativeAI(
                model=model or settings.GEMINI_MODEL,
                temperature=temperature,
                streaming=streaming,
                google_api_key=settings.GOOGLE_API_KEY,
            )

        elif provider == "anthropic":
            from langchain_anthropic import ChatAnthropic

            if not settings.ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY not configured")
            return ChatAnthropic(
                model=model or settings.ANTHROPIC_MODEL,
                temperature=temperature,
                streaming=streaming,
                anthropic_api_key=settings.ANTHROPIC_API_KEY,
            )

        else:
            raise ValueError(f"Unknown provider: {provider}")

    def _build_fallback_chain(self, primary: str) -> list[str]:
        all_providers = ["openai", "google", "anthropic"]
        chain = [primary]
        for p in all_providers:
            if p != primary:
                chain.append(p)
        return chain

    def get_embeddings(self, provider: Optional[str] = None):
        """Return LangChain embeddings for the given provider."""
        resolved = provider or settings.DEFAULT_LLM_PROVIDER

        if resolved == "openai":
            from langchain_openai import OpenAIEmbeddings

            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not configured")
            return OpenAIEmbeddings(
                model=settings.OPENAI_EMBEDDING_MODEL,
                api_key=settings.OPENAI_API_KEY,
            )

        elif resolved == "google":
            from langchain_google_genai import GoogleGenerativeAIEmbeddings

            if not settings.GOOGLE_API_KEY:
                raise ValueError("GOOGLE_API_KEY not configured")
            return GoogleGenerativeAIEmbeddings(
                model="models/embedding-001",
                google_api_key=settings.GOOGLE_API_KEY,
            )

        # Fallback: try OpenAI, then Google
        for fallback in ["openai", "google"]:
            if fallback == resolved:
                continue
            try:
                return self.get_embeddings(fallback)
            except Exception:
                pass

        raise RuntimeError("No embedding provider available")

    def get_available_providers(self) -> list[str]:
        """Return list of providers that have API keys configured."""
        available: list[str] = []
        if settings.OPENAI_API_KEY:
            available.append("openai")
        if settings.GOOGLE_API_KEY:
            available.append("google")
        if settings.ANTHROPIC_API_KEY:
            available.append("anthropic")
        return available


# Singleton
llm_factory = LLMFactory()
