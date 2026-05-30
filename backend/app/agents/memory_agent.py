from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select

from app.core.database import get_session_factory
from app.core.llm_factory import llm_factory
from app.models.memory import RepositoryMemory

logger = logging.getLogger(__name__)

_COMPRESS_PROMPT = """\
Summarize the following conversation into a concise paragraph that captures
the key topics discussed, decisions made, and any code-related context.
Keep it under 200 words.

Messages:
{messages}

Summary:"""

_CONTEXT_PROMPT = """\
Based on the stored memories about this repository, provide a concise context summary
that would be useful for answering code questions.

Memories:
{memories}

Context summary:"""


class MemoryAgent:
    """
    Stores and retrieves repository-level memories using PostgreSQL for persistence
    and ChromaDB for semantic retrieval.
    """

    async def store_memory(
        self,
        repo_id: str,
        memory_type: str,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> RepositoryMemory:
        factory = get_session_factory()
        async with factory() as session:
            memory = RepositoryMemory(
                id=uuid.uuid4(),
                repo_id=uuid.UUID(repo_id),
                memory_type=memory_type,
                title=title,
                content=content,
                metadata_=metadata or {},
            )

            # Try to store embedding in ChromaDB for semantic search
            try:
                embedding_id = await self._store_embedding(repo_id, memory)
                memory.embedding_id = embedding_id
            except Exception as exc:
                logger.warning("Failed to store memory embedding: %s", exc)

            session.add(memory)
            await session.commit()
            await session.refresh(memory)
            return memory

    async def retrieve_relevant_memory(
        self,
        repo_id: str,
        query: str,
        limit: int = 5,
    ) -> List[RepositoryMemory]:
        """Retrieve memories using both semantic search (ChromaDB) and DB fallback."""
        factory = get_session_factory()

        # Try semantic search first
        try:
            embedding_ids = await self._semantic_search_memory(repo_id, query, limit)
            if embedding_ids:
                async with factory() as session:
                    result = await session.execute(
                        select(RepositoryMemory)
                        .where(RepositoryMemory.repo_id == uuid.UUID(repo_id))
                        .where(RepositoryMemory.embedding_id.in_(embedding_ids))
                        .limit(limit)
                    )
                    memories = result.scalars().all()
                    if memories:
                        return list(memories)
        except Exception as exc:
            logger.warning("Semantic memory search failed, falling back to DB: %s", exc)

        # Fallback: recent memories from DB
        async with factory() as session:
            result = await session.execute(
                select(RepositoryMemory)
                .where(RepositoryMemory.repo_id == uuid.UUID(repo_id))
                .order_by(RepositoryMemory.created_at.desc())
                .limit(limit)
            )
            return list(result.scalars().all())

    async def compress_conversation(
        self, messages: List[Dict[str, str]]
    ) -> str:
        """Summarize a list of conversation messages into a compact string."""
        if not messages:
            return ""

        llm = llm_factory.get_llm(temperature=0.1, streaming=False)
        messages_text = "\n".join(
            f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}"
            for m in messages
        )
        prompt = _COMPRESS_PROMPT.format(messages=messages_text[:6000])

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([HumanMessage(content=prompt)]),
            )
            return response.content.strip()
        except Exception as exc:
            logger.error("Conversation compression failed: %s", exc)
            return " | ".join(
                m.get("content", "")[:100] for m in messages[-3:]
            )

    async def get_repo_context(self, repo_id: str) -> str:
        """Aggregate recent repository memories into a single context string."""
        factory = get_session_factory()
        async with factory() as session:
            result = await session.execute(
                select(RepositoryMemory)
                .where(RepositoryMemory.repo_id == uuid.UUID(repo_id))
                .order_by(RepositoryMemory.created_at.desc())
                .limit(10)
            )
            memories = result.scalars().all()

        if not memories:
            return "No repository memories available."

        llm = llm_factory.get_llm(temperature=0.1, streaming=False)
        memories_text = "\n\n".join(
            f"[{m.memory_type}] {m.title}:\n{m.content[:500]}"
            for m in memories
        )
        prompt = _CONTEXT_PROMPT.format(memories=memories_text[:5000])

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([HumanMessage(content=prompt)]),
            )
            return response.content.strip()
        except Exception as exc:
            logger.error("Repo context generation failed: %s", exc)
            return memories_text[:2000]

    # ------------------------------------------------------------------
    # ChromaDB integration
    # ------------------------------------------------------------------

    async def _store_embedding(self, repo_id: str, memory: RepositoryMemory) -> str:
        import chromadb
        from app.core.config import settings

        client = await chromadb.AsyncHttpClient(
            host=settings.CHROMA_HOST, port=settings.CHROMA_PORT
        )
        collection_name = f"memory_{repo_id.replace('-', '_')}"
        collection = await client.get_or_create_collection(name=collection_name)

        embeddings_model = llm_factory.get_embeddings()
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            None, lambda: embeddings_model.embed_documents([memory.content])[0]
        )

        embedding_id = str(memory.id)
        await collection.upsert(
            ids=[embedding_id],
            embeddings=[embedding],
            documents=[memory.content],
            metadatas=[{
                "title": memory.title,
                "memory_type": memory.memory_type,
                "repo_id": repo_id,
            }],
        )
        return embedding_id

    async def _semantic_search_memory(
        self, repo_id: str, query: str, limit: int
    ) -> List[str]:
        import chromadb
        from app.core.config import settings

        client = await chromadb.AsyncHttpClient(
            host=settings.CHROMA_HOST, port=settings.CHROMA_PORT
        )
        collection_name = f"memory_{repo_id.replace('-', '_')}"
        try:
            collection = await client.get_collection(collection_name)
        except Exception:
            return []

        embeddings_model = llm_factory.get_embeddings()
        loop = asyncio.get_event_loop()
        query_embedding = await loop.run_in_executor(
            None, lambda: embeddings_model.embed_query(query)
        )

        results = await collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            include=["ids"],
        )
        return results.get("ids", [[]])[0]


# Singleton
memory_agent = MemoryAgent()
