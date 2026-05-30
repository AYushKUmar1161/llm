from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional

import chromadb

from app.core.config import settings
from app.core.llm_factory import llm_factory
from app.intelligence.chunker import CodeChunk

logger = logging.getLogger(__name__)

_BATCH_SIZE = 100


class RepositoryEmbedder:
    """
    Embeds code chunks into ChromaDB using the configured embedding provider.
    Uses chromadb.AsyncHttpClient for non-blocking I/O.
    """

    def __init__(self) -> None:
        self._client: Optional[chromadb.AsyncHttpClient] = None

    async def _get_client(self) -> chromadb.AsyncHttpClient:
        if self._client is None:
            self._client = await chromadb.AsyncHttpClient(
                host=settings.CHROMA_HOST,
                port=settings.CHROMA_PORT,
            )
        return self._client

    def _collection_name(self, repo_id: str) -> str:
        return f"repo_{repo_id.replace('-', '_')}"

    async def _get_or_create_collection(self, repo_id: str):
        client = await self._get_client()
        name = self._collection_name(repo_id)
        return await client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def embed_repository(self, repo_id: str, chunks: List[CodeChunk]) -> int:
        """Embed all chunks for a repo (clears existing collection first)."""
        client = await self._get_client()
        name = self._collection_name(repo_id)

        # Drop existing collection
        try:
            await client.delete_collection(name)
        except Exception:
            pass

        collection = await client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

        return await self._upsert_chunks(collection, chunks)

    async def update_chunks(self, repo_id: str, chunks: List[CodeChunk]) -> int:
        """Upsert chunks (used for incremental updates)."""
        collection = await self._get_or_create_collection(repo_id)
        return await self._upsert_chunks(collection, chunks)

    async def delete_repository(self, repo_id: str) -> None:
        client = await self._get_client()
        name = self._collection_name(repo_id)
        try:
            await client.delete_collection(name)
        except Exception as exc:
            logger.warning("Could not delete ChromaDB collection %s: %s", name, exc)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _upsert_chunks(self, collection, chunks: List[CodeChunk]) -> int:
        embeddings_model = llm_factory.get_embeddings()
        total = 0

        for batch_start in range(0, len(chunks), _BATCH_SIZE):
            batch = chunks[batch_start : batch_start + _BATCH_SIZE]
            texts = [c.content for c in batch]
            ids = [c.chunk_id for c in batch]
            metadatas = [self._build_metadata(c) for c in batch]

            # Embed synchronously in executor to avoid blocking event loop
            loop = asyncio.get_event_loop()
            embeddings: List[List[float]] = await loop.run_in_executor(
                None, lambda t=texts: embeddings_model.embed_documents(t)
            )

            await collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas,
            )
            total += len(batch)
            logger.debug("Embedded batch %d-%d", batch_start, batch_start + len(batch))

        return total

    def _build_metadata(self, chunk: CodeChunk) -> Dict[str, Any]:
        meta: Dict[str, Any] = {
            "file_path": chunk.file_path,
            "start_line": chunk.start_line,
            "end_line": chunk.end_line,
            "chunk_type": chunk.chunk_type,
            "language": chunk.language,
        }
        if chunk.symbol_name:
            meta["symbol_name"] = chunk.symbol_name
        # Flatten metadata (only string/int/float/bool values for Chroma)
        for k, v in chunk.metadata.items():
            if isinstance(v, (str, int, float, bool)):
                meta[k] = v
            elif isinstance(v, list):
                meta[k] = ",".join(str(x) for x in v)
        return meta


# Singleton
repository_embedder = RepositoryEmbedder()
