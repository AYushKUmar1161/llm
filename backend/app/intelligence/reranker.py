from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm_factory import llm_factory
from app.intelligence.retriever import RetrievedChunk

logger = logging.getLogger(__name__)

_SCORING_PROMPT = """\
You are a code relevance scorer. Given a user query and a code snippet, rate the relevance on a scale from 0.0 to 1.0.
Respond with ONLY a single float number, e.g. 0.85.

Query: {query}

Code snippet:
```
{snippet}
```

Relevance score (0.0 - 1.0):"""

_COMPRESS_PROMPT = """\
You are a code context compressor. Given a query and multiple code chunks, produce a concise context string
that contains the most relevant information to answer the query. Include file paths and line numbers as references.
Keep the result under {max_tokens} tokens. Preserve all important code logic and symbol names.

Query: {query}

Code chunks:
{chunks}

Compressed context:"""


class CrossEncoderReranker:
    """
    Uses an LLM (GPT-4o-mini) to score and rerank retrieved chunks.
    """

    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model

    def _get_llm(self):
        try:
            return llm_factory.get_llm(
                provider="openai", model=self.model, temperature=0.0, streaming=False
            )
        except Exception:
            return llm_factory.get_llm(temperature=0.0, streaming=False)

    async def _score_chunk(self, llm, query: str, chunk: RetrievedChunk) -> float:
        snippet = chunk.content[:2000]  # Limit snippet size
        prompt = _SCORING_PROMPT.format(query=query, snippet=snippet)
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([HumanMessage(content=prompt)]),
            )
            text = response.content.strip()
            return float(text)
        except Exception as exc:
            logger.debug("Failed to score chunk: %s", exc)
            return chunk.score  # Fall back to original score

    async def rerank(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        top_k: int = 5,
    ) -> List[RetrievedChunk]:
        if not chunks:
            return []

        llm = self._get_llm()

        # Batch scoring with concurrency limit
        semaphore = asyncio.Semaphore(5)

        async def score_with_limit(chunk: RetrievedChunk) -> tuple[float, RetrievedChunk]:
            async with semaphore:
                score = await self._score_chunk(llm, query, chunk)
                return score, chunk

        tasks = [score_with_limit(c) for c in chunks]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        scored: List[tuple[float, RetrievedChunk]] = []
        for result in results:
            if isinstance(result, Exception):
                logger.warning("Scoring exception: %s", result)
            else:
                scored.append(result)

        scored.sort(key=lambda x: x[0], reverse=True)
        reranked = []
        for score, chunk in scored[:top_k]:
            chunk.score = score
            reranked.append(chunk)

        return reranked

    async def compress_context(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        max_tokens: int = 8000,
    ) -> str:
        if not chunks:
            return ""

        chunks_text = "\n\n---\n\n".join(
            f"File: {c.file_path} (lines {c.start_line}-{c.end_line})\n{c.content}"
            for c in chunks
        )

        llm = self._get_llm()
        prompt = _COMPRESS_PROMPT.format(
            query=query,
            chunks=chunks_text[:max_tokens * 4],  # rough char limit
            max_tokens=max_tokens,
        )

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([HumanMessage(content=prompt)]),
            )
            return response.content
        except Exception as exc:
            logger.error("Context compression failed: %s", exc)
            # Fallback: concatenate top chunks up to max_tokens
            result_parts = []
            total_chars = 0
            max_chars = max_tokens * 4
            for chunk in chunks:
                ref = f"\n[{chunk.file_path}:{chunk.start_line}-{chunk.end_line}]\n"
                snippet = chunk.content
                if total_chars + len(ref) + len(snippet) > max_chars:
                    break
                result_parts.append(ref + snippet)
                total_chars += len(ref) + len(snippet)
            return "\n".join(result_parts)


# Singleton
reranker = CrossEncoderReranker()
