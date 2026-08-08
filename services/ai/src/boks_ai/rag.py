"""检索增强（RAG）：只读已发布知识库，按查询检索最相关片段。

不读取任何敏感原文，只对调用方传入的、已发布的文档做检索。
中文不做分词，改用字符 bigram 重叠，兼容中英文混排。
"""

from __future__ import annotations

from .models import KnowledgeDocument


def _bigrams(text: str) -> set[str]:
    normalized = "".join(ch for ch in text.lower() if not ch.isspace())
    if len(normalized) < 2:
        return {normalized} if normalized else set()
    return {normalized[i : i + 2] for i in range(len(normalized) - 1)}


def _score_document(query: str, document: KnowledgeDocument) -> float:
    query_bigrams = _bigrams(query)
    if not query_bigrams:
        return 0.0
    title_bigrams = _bigrams(document.title)
    content_bigrams = _bigrams(document.content)
    title_overlap = len(query_bigrams & title_bigrams) / len(query_bigrams)
    content_overlap = len(query_bigrams & content_bigrams) / len(query_bigrams)
    # 标题命中权重更高，避免长文档天然高分。
    return title_overlap * 0.4 + content_overlap * 0.6


def retrieve(
    documents: list[KnowledgeDocument],
    query: str,
    top_k: int = 3,
    min_score: float = 0.05,
) -> list[tuple[KnowledgeDocument, float]]:
    """返回按相关度降序的 (文档, 得分) 列表，分数低于阈值的剔除。"""
    scored = [
        (document, _score_document(query, document)) for document in documents
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    return [(document, score) for document, score in scored if score >= min_score][
        :top_k
    ]
