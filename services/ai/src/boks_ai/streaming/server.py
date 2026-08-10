"""
流式 SSE 端点（OAI 兼容）+ NestJS 透传协议

NestJS 端通过 POST /v1/chat/conversations/:id/stream 接收请求，
本服务流式返回 SSE 事件：
  event: plan        data: {"steps":[...]}
  event: tool_call   data: {"id":"...","args":{...}}
  event: delta       data: {"delta":"..."}
  event: tool_result data: {"id":"...","ok":true,"citations":[...]}
  event: message     data: {"answer":"...","citations":[...]}
  event: done        data: {"trace_id":"...","usage":{...}}
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from boks_ai.embeddings.client import EMBED_DIM
from boks_ai.llm_router import (
    TASK_DEFAULTS,
    LlmMessage,
    LlmRequest,
    LlmUsage,
    is_configured,
    provider_order,
    stream,
)
from boks_ai.retrieval.hybrid import HybridRetriever, make_pg_pool
from boks_ai.safety import classify, refusal_content

app = FastAPI(title="BOKS AI Streaming", version="0.2.0")

_PG_POOL = None
_RETRIEVER: HybridRetriever | None = None


async def _ensure_pool() -> None:
    global _PG_POOL, _RETRIEVER
    if _PG_POOL is None:
        url = _pg_url()
        if not url:
            return
        _PG_POOL = await make_pg_pool(url)
        _RETRIEVER = HybridRetriever(_PG_POOL)


def _pg_url() -> str | None:
    import os

    return os.environ.get("BOKS_DATABASE_URL")


SYSTEM_PROMPT = (
    "你是 BOKS 儿童体测与体态健康教育的智能助手。你只能根据提供的已发布知识文档回答，"
    "不能根据文字或照片做医疗诊断，不能判断 Cobb 角，不输出未经知识库支撑的数值。"
    "回答用简体中文，简洁、可执行，必要时引用知识文档标题。"
)


class ChatStreamRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    child_grade: str | None = None
    audience: str | None = None
    conversation_id: str | None = None


@app.get("/health")
async def health() -> dict:
    return {
        "service": "boks-ai",
        "status": "ok",
        "version": "0.2.0",
        "providers": provider_order(),
        "embed_dim": EMBED_DIM,
    }


async def _sse_events(req: ChatStreamRequest) -> AsyncIterator[dict]:
    trace_id = str(uuid.uuid4())
    yield {"event": "trace", "data": json.dumps({"trace_id": trace_id})}

    decision = classify(req.content)
    if decision.intercept:
        yield {
            "event": "message",
            "data": json.dumps(
                {
                    "answer": refusal_content(req.content),
                    "citations": [],
                    "intent": decision.intent,
                    "intercepted": True,
                },
                ensure_ascii=False,
            ),
        }
        yield {"event": "done", "data": json.dumps({"trace_id": trace_id, "usage": None})}
        return

    # RAG
    await _ensure_pool()
    chunks = []
    if _RETRIEVER:
        try:
            chunks = await _RETRIEVER.retrieve(
                query=req.content,
                audience=req.audience,
                top_k=6,
                candidate_k=30,
            )
        except Exception as e:  # noqa: BLE001
            yield {"event": "tool_error", "data": json.dumps({"error": str(e)})}

    if chunks:
        yield {"event": "plan", "data": json.dumps({"steps": ["kb_search"]})}
        yield {
            "event": "tool_call",
            "data": json.dumps({"id": "kb_search", "args": {"query": req.content}}),
        }
        yield {
            "event": "tool_result",
            "data": json.dumps(
                {
                    "id": "kb_search",
                    "ok": True,
                    "citations": [
                        {"source_id": c.source_id, "title": c.title, "version": c.version}
                        for c in chunks[:3]
                    ],
                },
                ensure_ascii=False,
            ),
        }

    # LLM 流式
    context = "\n".join(f"[{c.title} v{c.version}] {c.content}" for c in chunks)
    messages = [
        LlmMessage(role="system", content=SYSTEM_PROMPT),
        LlmMessage(role="user", content=f"已发布资料：\n{context}\n\n问题：{req.content}"),
    ]
    llm_req = LlmRequest(
        task="chat",
        messages=messages,
        temperature=TASK_DEFAULTS["chat"]["temperature"],
        max_tokens=TASK_DEFAULTS["chat"]["max_tokens"],
        trace_id=trace_id,
    )

    full_answer = ""
    final_usage: LlmUsage | None = None
    if not is_configured():
        # LLM 未配置：返回 KB 模板
        if chunks:
            titles = "、".join(c.title for c in chunks[:3])
            full_answer = (
                f"关于「{req.content}」，我找到以下已发布资料可供参考：{titles}。"
                "这里的内容仅用于健康教育，不替代医疗诊断。"
                "如果涉及疼痛、麻木等不适，请停止训练并咨询专业人员。"
            )
        else:
            full_answer = "我可以介绍 BOKS 体测、训练、体态拍摄流程和隐私控制。请告诉我你想了解体测、训练、体态还是隐私。"
        yield {"event": "delta", "data": json.dumps({"delta": full_answer}, ensure_ascii=False)}
    else:
        try:
            import httpx

            async with httpx.AsyncClient() as client:
                async for chunk in stream(llm_req, client=client):
                    if chunk.delta:
                        full_answer += chunk.delta
                        yield {
                            "event": "delta",
                            "data": json.dumps({"delta": chunk.delta}, ensure_ascii=False),
                        }
                    if chunk.usage:
                        final_usage = chunk.usage
        except Exception as e:  # noqa: BLE001
            yield {"event": "tool_error", "data": json.dumps({"error": f"llm: {e}"})}
            full_answer = "AI 服务暂时不可用，请稍后重试。"

    citations = [
        {"source_id": c.source_id, "title": c.title, "version": c.version} for c in chunks[:3]
    ]
    yield {
        "event": "message",
        "data": json.dumps(
            {
                "answer": full_answer,
                "citations": citations,
                "intent": decision.intent,
                "intercepted": False,
            },
            ensure_ascii=False,
        ),
    }

    usage_payload = None
    if final_usage:
        usage_payload = {
            "prompt_tokens": final_usage.prompt_tokens,
            "completion_tokens": final_usage.completion_tokens,
            "cost_cny": final_usage.cost_cny,
        }
    yield {"event": "done", "data": json.dumps({"trace_id": trace_id, "usage": usage_payload})}


@app.post("/v1/chat")
async def chat_legacy(req: ChatStreamRequest):
    """非流式版本（兼容旧 client）。返回完整 message。"""
    citations = []
    intercepted = False
    intent = "process"
    answer = ""
    async for ev in _sse_events(req):
        if ev["event"] == "message":
            data = json.loads(ev["data"])
            answer = data.get("answer", "")
            citations = data.get("citations", [])
            intercepted = bool(data.get("intercepted"))
            intent = data.get("intent", "process")
    return {"content": answer, "citations": citations, "intent": intent, "intercepted": intercepted}


@app.post("/v1/chat/stream")
async def chat_stream(req: ChatStreamRequest):
    async def event_gen():
        async for ev in _sse_events(req):
            yield f"event: {ev['event']}\ndata: {ev['data']}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
