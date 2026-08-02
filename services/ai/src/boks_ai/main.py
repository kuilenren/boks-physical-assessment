import uuid
from datetime import UTC, datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from .audit import append_audit
from .llm import LlmUnavailableError, complete
from .models import (
    AuditEvent,
    ChatRequest,
    ChatResponse,
    Citation,
    ClassifyRequest,
    IntentDecision,
    KnowledgeDocument,
)
from .rag import retrieve
from .safety import classify, refusal_content

load_dotenv(Path(__file__).resolve().parents[4] / ".env")

app = FastAPI(title="BOKS AI Service", version="0.1.0")

SYSTEM_PROMPT = (
    "你是 BOKS 儿童体测与体态健康教育的智能助手。你只能根据提供的已发布知识文档回答，"
    "不能根据文字或照片做医疗诊断，不能判断 Cobb 角，不输出未经知识库支撑的数值。"
    "回答用简体中文，简洁、可执行，必要时引用知识文档标题。"
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _refusal_response(request: ChatRequest, decision: IntentDecision) -> ChatResponse:
    return ChatResponse(
        content=refusal_content(request.content),
        citations=[],
        intent=decision.intent,
        intercepted=True,
    )


def _template_response(request: ChatRequest) -> ChatResponse:
    """无 LLM 时的确定性答复：基于检索命中给出来源，避免编造。"""
    documents: list[KnowledgeDocument] = request.documents
    hits = retrieve(documents, request.content)
    if not hits:
        return ChatResponse(
            content=(
                "我可以介绍 BOKS 体测、训练、体态拍摄流程和隐私控制。"
                "请告诉我你想了解体测、训练、体态还是隐私。"
            ),
            citations=[],
            intent="unknown",
            intercepted=False,
        )
    titles = "、".join(document.title for document, _ in hits[:3])
    return ChatResponse(
        content=(
            f"关于「{request.content}」，我找到以下已发布资料可供参考："
            f"{titles}。这里的内容仅用于健康教育，不替代医疗诊断。"
            "如果涉及疼痛、麻木等不适，请停止训练并咨询专业人员。"
        ),
        citations=[
            Citation(
                source_id=document.source_id,
                title=document.title,
                version=document.version,
            )
            for document, _ in hits[:3]
        ],
        intent="process",
        intercepted=False,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "boks-ai", "status": "ok", "version": "0.1.0"}


@app.post("/v1/classify")
def classify_request(request: ClassifyRequest) -> IntentDecision:
    return classify(request.content)


@app.post("/v1/chat")
def chat(request: ChatRequest) -> ChatResponse:
    decision = classify(request.content)
    event_id = str(uuid.uuid4())
    if decision.intercept:
        response = _refusal_response(request, decision)
    else:
        llm_used = False
        try:
            hits = retrieve(request.documents, request.content)
            context = "\n".join(
                f"[{document.title} v{document.version}] {document.content}"
                for document, _ in hits
            )
            answer = complete(
                SYSTEM_PROMPT,
                f"已发布资料：\n{context}\n\n问题：{request.content}",
            )
            llm_used = True
            response = ChatResponse(
                content=answer,
                citations=[
                    Citation(
                        source_id=document.source_id,
                        title=document.title,
                        version=document.version,
                    )
                    for document, _ in hits[:3]
                ],
                intent=decision.intent,
                intercepted=False,
            )
        except LlmUnavailableError:
            response = _template_response(request)
    append_audit(
        AuditEvent(
            event_id=event_id,
            intent=decision.intent,
            intercepted=decision.intercept,
            citation_ids=[item.source_id for item in response.citations],
            llm_used=llm_used if not decision.intercept else False,
            created_at=_now(),
        )
    )
    return response
