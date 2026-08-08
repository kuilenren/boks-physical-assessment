"""
BM25 简易实现（jieba 0.42 中文分词 + 自定义 BOKS 词表）
不依赖 rank_bm25，避免额外依赖
"""
from __future__ import annotations

import math
import re
from collections import Counter

try:
    import jieba
    _JIEBA_AVAILABLE = True
except ImportError:
    _JIEBA_AVAILABLE = False

# BOKS 领域词表（防止专业术语被错误切分）
_BOKS_TERMS = [
    "BMI", "肺活量", "坐位体前屈", "仰卧起坐", "引体向上", "立定跳远",
    "50米跑", "50米×8", "800米", "1000米", "1分钟跳绳", "沙包",
    "国家学生体质健康标准", "国民体质测定", "脊柱侧弯", "体态",
    "Cobb角", "扁平足", "X型腿", "O型腿", "圆肩", "驼背",
    "骨盆前倾", "膝超伸", "高低肩", "训练计划", "体测", "打卡",
    "监护人", "知识库", "标准评分",
]
for term in _BOKS_TERMS:
    if _JIEBA_AVAILABLE:
        jieba.add_word(term)


def tokenize(text: str) -> list[str]:
    """中文 + 英文混排分词"""
    if not _JIEBA_AVAILABLE:
        # 退化：字符 bigram
        t = re.sub(r"\s+", "", text.lower())
        return [t[i : i + 2] for i in range(len(t) - 1)]
    t = re.sub(r"[^\w\u4e00-\u9fff]+", " ", text.lower())
    return [w for w in jieba.cut(t) if w.strip() and len(w.strip()) > 0]


class BM25Index:
    """轻量 BM25（Okapi）"""

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self.docs: list[list[str]] = []
        self.doc_lens: list[int] = []
        self.avgdl: float = 0.0
        self.df: Counter[str] = Counter()
        self.n_docs: int = 0

    def add(self, doc: str) -> int:
        tokens = tokenize(doc)
        idx = self.n_docs
        self.docs.append(tokens)
        self.doc_lens.append(len(tokens))
        for term in set(tokens):
            self.df[term] += 1
        self.n_docs += 1
        self.avgdl = sum(self.doc_lens) / self.n_docs if self.n_docs else 0
        return idx

    def score(self, query: str, doc_idx: int) -> float:
        q_tokens = tokenize(query)
        if not q_tokens:
            return 0.0
        doc = self.docs[doc_idx]
        dl = self.doc_lens[doc_idx]
        tf = Counter(doc)
        score = 0.0
        for qt in q_tokens:
            f = tf.get(qt, 0)
            if f == 0:
                continue
            n_q = self.df.get(qt, 0)
            idf = math.log(1 + (self.n_docs - n_q + 0.5) / (n_q + 0.5))
            norm = 1 - self.b + self.b * dl / (self.avgdl or 1)
            score += idf * (f * (self.k1 + 1)) / (f + self.k1 * norm)
        return score

    def top_k(self, query: str, k: int = 10) -> list[tuple[int, float]]:
        scored = [(i, self.score(query, i)) for i in range(self.n_docs)]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:k]