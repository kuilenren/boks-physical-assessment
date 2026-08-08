"""
Knowledge Sync：从 PG 读取已发布的知识库版本，重新切分 + embedding + 写回 chunks
- chunking：512 字符 + 64 重叠，按段落优先
- embedding：BGE-M3 / multilingual-e5-base（768 维）
- 入库：boks.boks_knowledge_chunks
"""
from __future__ import annotations

import re

import asyncpg

from .embeddings.client import get_embedder

CHUNK_SIZE = 512
CHUNK_OVERLAP = 64
MIN_CHUNK = 64


def chunk_text(text: str) -> list[str]:
    text = text.strip()
    if len(text) <= CHUNK_SIZE:
        return [text] if len(text) >= MIN_CHUNK else []

    chunks: list[str] = []
    # 按段落优先
    paragraphs = re.split(r"\n\s*\n", text)
    current = ""
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if len(current) + len(p) + 1 <= CHUNK_SIZE:
            current = f"{current}\n{p}".strip()
        else:
            if current:
                chunks.append(current)
            if len(p) > CHUNK_SIZE:
                # 长段落硬切
                for i in range(0, len(p), CHUNK_SIZE - CHUNK_OVERLAP):
                    sub = p[i : i + CHUNK_SIZE]
                    if len(sub) >= MIN_CHUNK:
                        chunks.append(sub)
                current = ""
            else:
                current = p
    if current and len(current) >= MIN_CHUNK:
        chunks.append(current)
    return chunks


def bm25_terms_json(content: str) -> dict[str, int]:
    from .retrieval.bm25 import tokenize
    tokens = tokenize(content)
    out: dict[str, int] = {}
    for t in tokens:
        out[t] = out.get(t, 0) + 1
    return out


async def sync_published(pool: asyncpg.Pool) -> int:
    embedder = get_embedder()
    rows = await pool.fetch(
        """
        SELECT id, source_id, version, title, content
        FROM boks.boks_knowledge_versions
        WHERE status = 'published'
        ORDER BY published_at DESC
        """,
    )
    total = 0
    async with pool.acquire() as conn, conn.transaction():
            for row in rows:
                # 已有 chunks 则跳过
                existing = await conn.fetchval(
                    "SELECT COUNT(*) FROM boks.boks_knowledge_chunks WHERE version_id = $1",
                    row["id"],
                )
                if existing and existing > 0:
                    total += int(existing)
                    continue
                pieces = chunk_text(row["content"])
                if not pieces:
                    continue
                vectors = embedder.embed_batch(pieces)
                for ordinal, (piece, vec) in enumerate(zip(pieces, vectors)):
                    chunk_id = f"{row['id']}-{ordinal:04d}"
                    bm25 = bm25_terms_json(piece)
                    await conn.execute(
                        """
                        INSERT INTO boks.boks_knowledge_chunks
                          (id, version_id, ordinal, section, content, token_count, embedding, bm25_terms, metadata)
                        VALUES ($1,$2,$3,$4,$5,$6,$7::vector,$8,$9)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        chunk_id,
                        row["id"],
                        ordinal,
                        None,
                        piece,
                        len(piece),
                        vec,
                        bm25,
                        {"title": row["title"], "source_id": row["source_id"]},
                    )
                    total += 1
    return total