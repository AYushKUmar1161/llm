from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.core.llm_factory import llm_factory
from app.intelligence.retriever import RetrievedChunk, hybrid_retriever
from app.intelligence.reranker import reranker

logger = logging.getLogger(__name__)

_QUERY_EXPAND_PROMPT = """\
You are a query expansion assistant for a code search engine. 
Given the user's original question about a codebase, generate 3 alternative search queries 
that would help find the relevant code. Return ONLY the 3 queries, one per line, no numbering.

Original query: {query}

Alternative queries:"""

_SYSTEM_PROMPT = """\
You are CodeForge AI, an expert software engineer assistant with deep knowledge of the codebase.
Answer the user's question using the provided code context. Be specific, reference file paths and line numbers.
Format code examples in markdown code blocks with the appropriate language.
If the context doesn't contain enough information, say so clearly and provide general guidance."""


@dataclass
class RAGResult:
    answer: str
    sources: List[Dict[str, Any]]
    token_count: int
    query_expansions: List[str] = field(default_factory=list)
    retrieval_count: int = 0


class AdvancedRAGPipeline:
    """
    Full RAG pipeline: expand → retrieve → rerank → compress → generate.
    """

    def __init__(
        self,
        rerank_top_k: int = 5,
        retrieve_k: int = 10,
        max_context_tokens: int = 8000,
    ) -> None:
        self.rerank_top_k = rerank_top_k
        self.retrieve_k = retrieve_k
        self.max_context_tokens = max_context_tokens

    # ------------------------------------------------------------------
    # Step 1: Query expansion
    # ------------------------------------------------------------------

    async def query_expand(self, query: str) -> List[str]:
        try:
            llm = llm_factory.get_llm(temperature=0.3, streaming=False)
            prompt = _QUERY_EXPAND_PROMPT.format(query=query)
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([HumanMessage(content=prompt)]),
            )
            expansions = [
                line.strip()
                for line in response.content.strip().split("\n")
                if line.strip()
            ]
            return expansions[:3]
        except Exception as exc:
            logger.warning("Query expansion failed: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Step 2: Multi-query retrieval
    # ------------------------------------------------------------------

    async def retrieve(
        self, repo_id: str, query: str, expansions: Optional[List[str]] = None
    ) -> List[RetrievedChunk]:
        queries = [query] + (expansions or [])
        all_chunks: List[RetrievedChunk] = []
        seen_ids: set[str] = set()

        tasks = [
            hybrid_retriever.hybrid_search(repo_id, q, k=self.retrieve_k)
            for q in queries
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                logger.warning("Retrieval failed for one query: %s", result)
                continue
            for chunk in result:
                cid = f"{chunk.file_path}:{chunk.start_line}"
                if cid not in seen_ids:
                    seen_ids.add(cid)
                    all_chunks.append(chunk)

        # Sort by score descending
        all_chunks.sort(key=lambda c: c.score, reverse=True)
        return all_chunks[:self.retrieve_k * 2]

    # ------------------------------------------------------------------
    # Step 3–4: Rerank and compress
    # ------------------------------------------------------------------

    async def _rerank_and_compress(
        self, query: str, chunks: List[RetrievedChunk]
    ) -> tuple[str, List[RetrievedChunk]]:
        reranked = await reranker.rerank(query, chunks, top_k=self.rerank_top_k)
        context = await reranker.compress_context(
            query, reranked, max_tokens=self.max_context_tokens
        )
        return context, reranked

    # ------------------------------------------------------------------
    # Step 5: Generate answer
    # ------------------------------------------------------------------

    async def generate_answer(
        self,
        query: str,
        context: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        streaming: bool = True,
    ) -> AsyncGenerator[str, None]:
        llm = llm_factory.get_llm(temperature=0.1, streaming=streaming)

        messages = [SystemMessage(content=_SYSTEM_PROMPT)]

        # Add conversation history
        for msg in (conversation_history or []):
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

        # Add current query with context
        user_message = f"""Code Context:
{context}

---

Question: {query}"""
        messages.append(HumanMessage(content=user_message))

        async def _stream() -> AsyncGenerator[str, None]:
            if streaming and hasattr(llm, "astream"):
                async for chunk in llm.astream(messages):
                    if hasattr(chunk, "content") and chunk.content:
                        yield chunk.content
            else:
                response = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: llm.invoke(messages)
                )
                yield response.content

        async for token in _stream():
            yield token

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    async def run(
        self,
        repo_id: str,
        query: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> RAGResult:
        # Step 1: Expand
        expansions = await self.query_expand(query)

        # Step 2: Retrieve
        chunks = await self.retrieve(repo_id, query, expansions)

        if not chunks:
            return RAGResult(
                answer="I couldn't find relevant code in the repository for your query. "
                       "Please make sure the repository is indexed and try rephrasing your question.",
                sources=[],
                token_count=0,
                query_expansions=expansions,
                retrieval_count=0,
            )

        # Step 3-4: Rerank and compress
        context, reranked = await self._rerank_and_compress(query, chunks)

        # Step 5: Generate (collect full response for RAGResult)
        answer_parts: List[str] = []
        async for token in self.generate_answer(
            query, context, conversation_history, streaming=False
        ):
            answer_parts.append(token)

        answer = "".join(answer_parts)
        token_count = len(answer) // 4 + len(context) // 4  # rough estimate

        sources = [
            {
                "file": c.file_path,
                "start_line": c.start_line,
                "end_line": c.end_line,
                "symbol": c.symbol_name,
                "score": round(c.score, 4),
                "content": c.content[:500],
            }
            for c in reranked
        ]

        return RAGResult(
            answer=answer,
            sources=sources,
            token_count=token_count,
            query_expansions=expansions,
            retrieval_count=len(chunks),
        )


# Singleton
rag_pipeline = AdvancedRAGPipeline()
