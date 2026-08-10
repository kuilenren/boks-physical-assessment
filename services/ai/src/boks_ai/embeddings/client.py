"""
Embedding 客户端（sentence-transformers 真实 BGE-M3，本地 CPU）
- 模型：BAAI/bge-m3（中文优化，1024 维）— 本轮统一使用 768 维（与 pgvector 列匹配）
- 实际加载：intfloat/multilingual-e5-base（CPU 友好，768 维）；可通过 BOKS_EMBED_MODEL 覆盖
- 缓存：本地 sqlite（生产可换 Redis）
"""

from __future__ import annotations

import hashlib
import os
import sqlite3
from collections.abc import Sequence
from pathlib import Path

EMBED_DIM = 768
DEFAULT_MODEL = os.environ.get("BOKS_EMBED_MODEL", "intfloat/multilingual-e5-base")
CACHE_PATH = Path(os.environ.get("BOKS_EMBED_CACHE", "./runtime/embed-cache.db"))
CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)


def _ensure_cache() -> sqlite3.Connection:
    conn = sqlite3.connect(str(CACHE_PATH))
    conn.execute(
        """CREATE TABLE IF NOT EXISTS embed_cache (
        key TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        vector BLOB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )"""
    )
    conn.commit()
    return conn


_CACHE_CONN: sqlite3.Connection | None = None


def _cache_conn() -> sqlite3.Connection:
    global _CACHE_CONN
    if _CACHE_CONN is None:
        _CACHE_CONN = _ensure_cache()
    return _CACHE_CONN


def _key(text: str, model: str) -> str:
    return hashlib.sha256(f"{model}|{text}".encode()).hexdigest()


def _pack(vec: Sequence[float]) -> bytes:
    import struct

    return struct.pack(f"{len(vec)}f", *vec)


def _unpack(buf: bytes, dim: int = EMBED_DIM) -> list[float]:
    import struct

    return list(struct.unpack(f"{dim}f", buf))


class EmbeddingClient:
    """Sentence-Transformers 包装（懒加载）"""

    def __init__(self, model_name: str = DEFAULT_MODEL) -> None:
        self.model_name = model_name
        self._model: object | None = None

    def _ensure_model(self) -> None:
        if self._model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name, device="cpu")
        except (ImportError, Exception) as e:  # noqa: BLE001 - 有意兜底回退
            # 回退：哈希伪 embedding（仅占位，使开发环境可跑通 RAG 流程）
            import sys

            print(
                f"[embed] sentence-transformers unavailable ({e}); falling back to hash embedding",
                file=sys.stderr,
            )
            self._model = _HashEmbedding(EMBED_DIM)

    def _embed_uncached(self, text: str) -> list[float]:
        return self._embed_batch_uncached([text])[0]

    def _embed_batch_uncached(self, texts: list[str]) -> list[list[float]]:
        model = self._model
        if isinstance(model, _HashEmbedding):
            return [model.encode(t) for t in texts]
        # E5 模型要求 "query: " / "passage: " 前缀
        is_e5 = "e5" in self.model_name.lower()
        inputs = [f"query: {t}" if is_e5 else t for t in texts] if texts else []
        if not inputs:
            return []
        vectors = model.encode(inputs, normalize_embeddings=True)  # type: ignore[attr-defined]
        return [v.tolist() for v in vectors]


class _HashEmbedding:
    """确定性伪 embedding（开发/离线 fallback）：SHA256 → float 数组"""

    def __init__(self, dim: int) -> None:
        self.dim = dim

    def encode(self, text: str) -> list[float]:
        import hashlib

        h = hashlib.sha512(text.encode("utf-8")).digest()
        out = []
        for i in range(self.dim):
            b = h[i % len(h)]
            out.append((b - 128) / 128.0)
        # normalize
        norm = sum(x * x for x in out) ** 0.5 or 1
        return [x / norm for x in out]

    def embed(self, text: str) -> list[float]:
        self._ensure_model()
        key = _key(text, self.model_name)
        cur = _cache_conn().cursor()
        cur.execute(
            "SELECT vector FROM embed_cache WHERE key=? AND model=?", (key, self.model_name)
        )
        row = cur.fetchone()
        if row:
            return _unpack(row[0])
        vec = self._embed_uncached(text)
        cur.execute(
            "INSERT OR REPLACE INTO embed_cache(key, model, vector) VALUES(?,?,?)",
            (key, self.model_name, _pack(vec)),
        )
        _cache_conn().commit()
        return vec

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        self._ensure_model()
        results: list[list[float] | None] = [None] * len(texts)
        miss_idx: list[int] = []
        miss_texts: list[str] = []
        cur = _cache_conn().cursor()
        for i, t in enumerate(texts):
            key = _key(t, self.model_name)
            cur.execute(
                "SELECT vector FROM embed_cache WHERE key=? AND model=?", (key, self.model_name)
            )
            row = cur.fetchone()
            if row:
                results[i] = _unpack(row[0])
            else:
                miss_idx.append(i)
                miss_texts.append(t)
        if miss_texts:
            vectors = self._embed_batch_uncached(miss_texts)
            for idx, vec in zip(miss_idx, vectors):
                results[idx] = vec
                key = _key(texts[idx], self.model_name)
                cur.execute(
                    "INSERT OR REPLACE INTO embed_cache(key, model, vector) VALUES(?,?,?)",
                    (key, self.model_name, _pack(vec)),
                )
            _cache_conn().commit()
        return [r for r in results if r is not None]


_singleton: EmbeddingClient | None = None


def get_embedder() -> EmbeddingClient:
    global _singleton
    if _singleton is None:
        _singleton = EmbeddingClient()
    return _singleton
