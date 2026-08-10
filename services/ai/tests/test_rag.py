from boks_ai.models import KnowledgeDocument
from boks_ai.rag import retrieve


def make_document(source_id: str, title: str, content: str) -> KnowledgeDocument:
    return KnowledgeDocument(
        source_id=source_id,
        version="v1",
        title=title,
        content=content,
    )


def test_retrieve_ranks_relevant_document_first() -> None:
    documents = [
        make_document("a", "肺活量测试标准", "肺活量测试要求学生在统一测试日完成吹气。"),
        make_document("b", "照片拍摄要求", "体态照片需要在自然光下正面侧面拍摄。"),
    ]
    hits = retrieve(documents, "体态照片怎么拍？")
    assert hits
    assert hits[0][0].source_id == "b"


def test_retrieve_returns_empty_for_irrelevant_query() -> None:
    documents = [make_document("a", "肺活量测试标准", "肺活量测试要求学生在统一测试日完成吹气。")]
    hits = retrieve(documents, "天气怎么样")
    assert hits == []


def test_retrieve_honors_top_k() -> None:
    documents = [make_document(str(i), f"文档 {i}", f"训练计划第 {i} 周的内容。") for i in range(5)]
    hits = retrieve(documents, "训练计划")
    assert len(hits) <= 3


def test_retrieve_empty_documents() -> None:
    assert retrieve([], "训练") == []
