from __future__ import annotations

import asyncio
import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.llm_factory import llm_factory

logger = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    content: str
    file_path: str
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    start_line: int = 0
    end_line: int = 0
    symbol_name: Optional[str] = None
    chunk_type: str = "unknown"
    language: str = "unknown"


class HybridRetriever:
    """
    Combines dense (ChromaDB vector) search with BM25 sparse search
    using Reciprocal Rank Fusion (RRF).
    """

    def __init__(self, alpha: float = 0.7) -> None:
        self.alpha = alpha  # weight for dense scores in fusion

    # ------------------------------------------------------------------
    # Dense search (ChromaDB)
    # ------------------------------------------------------------------

    async def dense_search(
        self,
        repo_id: str,
        query: str,
        k: int = 20,
        where: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedChunk]:
        try:
            import chromadb

            client = await chromadb.AsyncHttpClient(
                host=settings.CHROMA_HOST,
                port=settings.CHROMA_PORT,
            )
            collection_name = f"repo_{repo_id.replace('-', '_')}"
            try:
                collection = await client.get_collection(collection_name)
            except Exception:
                logger.warning("Collection %s not found", collection_name)
                return []

            embeddings_model = llm_factory.get_embeddings()
            loop = asyncio.get_event_loop()
            query_embedding: List[float] = await loop.run_in_executor(
                None, lambda: embeddings_model.embed_query(query)
            )

            results = await collection.query(
                query_embeddings=[query_embedding],
                n_results=min(k, 100),
                include=["documents", "metadatas", "distances"],
                where=where or None,
            )

            chunks: List[RetrievedChunk] = []
            if results and results["documents"]:
                for doc, meta, dist in zip(
                    results["documents"][0],
                    results["metadatas"][0],
                    results["distances"][0],
                ):
                    # Convert cosine distance to similarity score
                    score = 1.0 - dist
                    chunks.append(
                        RetrievedChunk(
                            content=doc,
                            file_path=meta.get("file_path", ""),
                            score=score,
                            metadata=meta,
                            start_line=int(meta.get("start_line", 0)),
                            end_line=int(meta.get("end_line", 0)),
                            symbol_name=meta.get("symbol_name"),
                            chunk_type=meta.get("chunk_type", "unknown"),
                            language=meta.get("language", "unknown"),
                        )
                    )
            return chunks

        except Exception as exc:
            logger.error("Dense search failed: %s", exc)
            return []

    # ------------------------------------------------------------------
    # BM25 sparse search
    # ------------------------------------------------------------------

    def bm25_search(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        k: int = 20,
    ) -> List[RetrievedChunk]:
        if not chunks:
            return []
        try:
            from rank_bm25 import BM25Okapi

            tokenized_corpus = [c.content.lower().split() for c in chunks]
            bm25 = BM25Okapi(tokenized_corpus)
            tokenized_query = query.lower().split()
            scores = bm25.get_scores(tokenized_query)

            ranked = sorted(
                zip(scores, chunks), key=lambda x: x[0], reverse=True
            )
            results = []
            for score, chunk in ranked[:k]:
                rc = RetrievedChunk(
                    content=chunk.content,
                    file_path=chunk.file_path,
                    score=float(score),
                    metadata=chunk.metadata,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    symbol_name=chunk.symbol_name,
                    chunk_type=chunk.chunk_type,
                    language=chunk.language,
                )
                results.append(rc)
            return results
        except Exception as exc:
            logger.error("BM25 search failed: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Hybrid search with RRF
    # ------------------------------------------------------------------

    async def hybrid_search(
        self,
        repo_id: str,
        query: str,
        k: int = 10,
        alpha: Optional[float] = None,
    ) -> List[RetrievedChunk]:
        effective_alpha = alpha if alpha is not None else self.alpha
        dense_k = max(k * 2, 20)

        dense_results = await self.dense_search(repo_id, query, k=dense_k)
        bm25_results = self.bm25_search(query, dense_results, k=dense_k)

        fused = self._reciprocal_rank_fusion(
            dense_results, bm25_results, alpha=effective_alpha
        )
        return fused[:k]

    def _reciprocal_rank_fusion(
        self,
        dense: List[RetrievedChunk],
        sparse: List[RetrievedChunk],
        alpha: float = 0.7,
        k_rrf: int = 60,
    ) -> List[RetrievedChunk]:
        """RRF score = alpha * 1/(k+rank_dense) + (1-alpha) * 1/(k+rank_sparse)"""
        scores: Dict[str, float] = {}
        chunk_map: Dict[str, RetrievedChunk] = {}

        for rank, chunk in enumerate(dense):
            cid = f"{chunk.file_path}:{chunk.start_line}"
            scores[cid] = scores.get(cid, 0.0) + alpha / (k_rrf + rank + 1)
            chunk_map[cid] = chunk

        for rank, chunk in enumerate(sparse):
            cid = f"{chunk.file_path}:{chunk.start_line}"
            scores[cid] = scores.get(cid, 0.0) + (1 - alpha) / (k_rrf + rank + 1)
            if cid not in chunk_map:
                chunk_map[cid] = chunk

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        result = []
        for cid, score in ranked:
            chunk = chunk_map[cid]
            chunk.score = score
            result.append(chunk)
        return result

    # ------------------------------------------------------------------
    # Filters
    # ------------------------------------------------------------------

    def filter_by_file_type(
        self, results: List[RetrievedChunk], extensions: List[str]
    ) -> List[RetrievedChunk]:
        exts = {e.lstrip(".").lower() for e in extensions}
        return [
            r for r in results
            if r.file_path.rsplit(".", 1)[-1].lower() in exts
        ]

    def filter_by_symbol_type(
        self, results: List[RetrievedChunk], symbol_types: List[str]
    ) -> List[RetrievedChunk]:
        types = set(symbol_types)
        return [r for r in results if r.chunk_type in types]


# Singleton
hybrid_retriever = HybridRetriever()
