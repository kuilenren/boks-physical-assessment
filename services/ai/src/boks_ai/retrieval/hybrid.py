"""
Hybrid Retriever（pgvector + BM25 + RRF 融合）
数据源：boks.boks_knowledge_chunks（pgvector 768 维 + JSONB bm25_terms）
"""
from __future__ import annotations

from dataclasses import dataclass

import asyncpg

from ..embeddings.client import get_embedder
from .bm25 import BM25Index


@dataclass
class RetrievedChunk:
    chunk_id: str
    source_id: str
    version_id: str
    version: str
    title: str
    ordinal: int
    content: str
    rrf_score: float
    vector_score: float
    bm25_score: float


def reciprocal_rank_fusion(rank_lists: list[list[str]], k: int = 60) -> dict[str, float]:
    fused: dict[str, float] = {}
    for rl in rank_lists:
        for rank, item in enumerate(rl, start=1):
            fused[item] = fused.get(item, 0.0) + 1.0 / (k + rank)
    return fused


class HybridRetriever:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self.pool = pool
        self._bm25_cache: BM25Index | None = None
        self._bm25_chunks: dict[str, RetrievedChunk] = {}

    async def _load_chunks(self, *, audience: str | None = None) -> list[RetrievedChunk]:
        sql = """
        SELECT c.id, v.source_id, v.id AS version_id, v.version, v.title,
               c.ordinal, c.content
        FROM boks.boks_knowledge_chunks c
        JOIN boks.boks_knowledge_versions v ON v.id = c.version_id
        WHERE v.status = 'published'
        """
        params: list = []
        if audience:
            sql += " AND ($1 = ANY(v.audience) OR 'parent' = ANY(v.audience))"
            params.append(audience)
        sql += " ORDER BY v.published_at DESC, c.ordinal"
        rows = await self.pool.fetch(sql, *params)
        return [
            RetrievedChunk(
                chunk_id=r["id"],
                source_id=r["source_id"],
                version_id=r["version_id"],
                version=r["version"],
                title=r["title"],
                ordinal=r["ordinal"],
                content=r["content"],
                rrf_score=0.0,
                vector_score=0.0,
                bm25_score=0.0,
            )
            for r in rows
        ]

    async def _build_bm25(self, chunks: list[RetrievedChunk]) -> None:
        self._bm25_cache = BM25Index()
        self._bm25_chunks = {}
        for ch in chunks:
            self._bm25_chunks[ch.chunk_id] = ch
            self._bm25_cache.add(ch.content)

    async def retrieve(
        self,
        *,
        query: str,
        audience: str | None = None,
        top_k: int = 6,
        candidate_k: int = 30,
    ) -> list[RetrievedChunk]:
        chunks = await self._load_chunks(audience=audience)
        if not chunks:
            return []

        # 1) 向量召回
        embedder = get_embedder()
        query_vec = embedder.embed(query)
        vec_rows = await self.pool.fetch(
            """
            SELECT c.id, 1 - (c.embedding <=> $1::vector) AS cosine
            FROM boks.boks_knowledge_chunks c
            JOIN boks.boks_knowledge_versions v ON v.id = c.version_id
            WHERE v.status = 'published'
            ORDER BY c.embedding <=> $1::vector
            LIMIT $2
            """,
            query_vec,
            candidate_k,
        )
        vec_rank: list[str] = [r["id"] for r in vec_rows]
        vec_score: dict[str, float] = {r["id"]: float(r["cosine"]) for r in vec_rows}

        # 2) BM25 召回
        await self._build_bm25(chunks)
        bm25_hits = self._bm25_cache.top_k(query, k=candidate_k)
        bm25_rank: list[str] = [chunks[i].chunk_id for i, _ in bm25_hits]
        bm25_score_map: dict[str, float] = {chunks[i].chunk_id: s for i, s in bm25_hits}

        # 3) RRF 融合
        fused = reciprocal_rank_fusion([vec_rank, bm25_rank], k=60)
        top_ids = sorted(fused.keys(), key=lambda x: fused[x], reverse=True)[:top_k]

        by_id = {ch.chunk_id: ch for ch in chunks}
        results: list[RetrievedChunk] = []
        for cid in top_ids:
            ch = by_id.get(cid)
            if not ch:
                continue
            ch.rrf_score = fused[cid]
            ch.vector_score = vec_score.get(cid, 0.0)
            ch.bm25_score = bm25_score_map.get(cid, 0.0)
            results.append(ch)
        return results


async def make_pg_pool(url: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(url, min_size=1, max_size=10, command_timeout=10)