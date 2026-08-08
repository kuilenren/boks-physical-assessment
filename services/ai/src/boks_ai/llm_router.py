"""
LLM Router（多 provider + 超时 + 重试 + 降级 + token 计数）

替换 llm.py 的 if-else 手写实现，行为兼容。
Provider: deepseek / minimax；按 BOKS_AI_PROVIDER 选主，其余降级。
"""
from __future__ import annotations
import os
import asyncio
import hashlib
import json
import time
from dataclasses import dataclass, asdict, field
from typing import AsyncIterator, Literal, Any

import httpx

TaskName = Literal["chat", "classify", "rerank", "summary", "extract", "embed"]
ToneName = Literal["calm_teacher", "warm_companion", "concise_official"]

DEFAULT_TIMEOUT_S = 30.0
PROVIDERS = ("deepseek", "minimax")


class LlmUnavailableError(RuntimeError):
    """LLM 未配置或不可达。"""


@dataclass(frozen=True)
class LlmMessage:
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    name: str | None = None
    tool_call_id: str | None = None


@dataclass(frozen=True)
class LlmUsage:
    prompt_tokens: int
    completion_tokens: int
    cost_cny: float


@dataclass(frozen=True)
class LlmRequest:
    task: TaskName
    messages: list[LlmMessage]
    temperature: float = 0.3
    max_tokens: int = 900
    timeout_s: float = DEFAULT_TIMEOUT_S
    trace_id: str | None = None
    family_id: str | None = None


@dataclass(frozen=True)
class LlmChunk:
    delta: str
    finish_reason: str | None = None
    usage: LlmUsage | None = None


# Task-level defaults
TASK_DEFAULTS: dict[str, dict[str, Any]] = {
    "chat":     {"temperature": 0.3, "max_tokens": 900},
    "classify": {"temperature": 0.0, "max_tokens": 8},
    "rerank":   {"temperature": 0.0, "max_tokens": 4},
    "summary":  {"temperature": 0.1, "max_tokens": 350},
    "extract":  {"temperature": 0.0, "max_tokens": 600},
    "embed":    {"temperature": 0.0, "max_tokens": 1},
}

# Cost (CNY per 1k tokens) — 估算，仅作看板
COST_PER_1K = {
    ("deepseek", "in"):  0.001,
    ("deepseek", "out"): 0.002,
    ("minimax", "in"):   0.010,
    ("minimax", "out"):  0.030,
}


def _env(p: str, k: str) -> str:
    if p == "minimax":
        return os.environ.get(f"BOKS_AI_MINIMAX_{k}", "")
    return os.environ.get(f"BOKS_AI_LLM_{k}", "") or os.environ.get(f"BOKS_AI_DEEPSEEK_{k}", "")


def _endpoint(p: str) -> str:
    base = _env(p, "BASE_URL").rstrip("/")
    if not base:
        raise LlmUnavailableError(f"未配置 {p} BASE_URL")
    return base + "/chat/completions"


def _model(p: str) -> str:
    return _env(p, "MODEL")


def _api_key(p: str) -> str:
    return _env(p, "API_KEY")


def configured_providers() -> list[str]:
    return [n for n in PROVIDERS if _model(n) and _api_key(n) and _env(n, "BASE_URL")]


def provider_order() -> list[str]:
    available = configured_providers()
    primary = (os.environ.get("BOKS_AI_PROVIDER") or "").strip().lower()
    if primary not in PROVIDERS:
        primary = available[0] if available else ""
    if not primary:
        return []
    return [primary] + [n for n in available if n != primary]


def is_configured() -> bool:
    return bool(provider_order())


def _cost(provider: str, prompt_tokens: int, completion_tokens: int) -> float:
    return round(
        prompt_tokens / 1000 * COST_PER_1K.get((provider, "in"), 0.01)
        + completion_tokens / 1000 * COST_PER_1K.get((provider, "out"), 0.02),
        6,
    )


def _extract_usage(provider: str, body: dict[str, Any]) -> LlmUsage | None:
    u = body.get("usage")
    if not isinstance(u, dict):
        return None
    pt = int(u.get("prompt_tokens") or 0)
    ct = int(u.get("completion_tokens") or 0)
    return LlmUsage(prompt_tokens=pt, completion_tokens=ct, cost_cny=_cost(provider, pt, ct))


async def _complete_one(
    provider: str,
    req: LlmRequest,
    client: httpx.AsyncClient,
) -> AsyncIterator[LlmChunk]:
    payload = {
        "model": _model(provider),
        "messages": [asdict(m) for m in req.messages],
        "stream": True,
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {_api_key(provider)}",
        "Content-Type": "application/json",
    }
    full_usage: LlmUsage | None = None
    async with client.stream(
        "POST",
        _endpoint(provider),
        json=payload,
        headers=headers,
        timeout=req.timeout_s,
    ) as resp:
        if resp.status_code >= 400:
            body = await resp.aread()
            raise LlmUnavailableError(f"{provider} HTTP {resp.status_code}: {body[:200]!r}")
        buffer = ""
        async for line in resp.aiter_lines():
            if not line or not line.startswith("data:"):
                continue
            chunk = line[5:].strip()
            if chunk == "[DONE]":
                break
            try:
                obj = json.loads(chunk)
            except json.JSONDecodeError:
                continue
            choices = obj.get("choices") or []
            if choices:
                delta = (choices[0].get("delta") or {}).get("content") or ""
                fr = choices[0].get("finish_reason")
                if delta or fr:
                    yield LlmChunk(delta=delta, finish_reason=fr)
            if "usage" in obj and obj["usage"]:
                full_usage = _extract_usage(provider, obj)


async def stream(req: LlmRequest, *, client: httpx.AsyncClient | None = None) -> AsyncIterator[LlmChunk]:
    order = provider_order()
    if not order:
        raise LlmUnavailableError("LLM 未配置（缺少端点、模型或密钥）。")
    owns_client = client is None
    if owns_client:
        client = httpx.AsyncClient()
    try:
        last_error: Exception | None = None
        for provider in order:
            delay = 1.0
            for attempt in range(3):
                try:
                    async for chunk in _complete_one(provider, req, client):
                        yield chunk
                    return
                except LlmUnavailableError as e:
                    last_error = e
                    if attempt < 2:
                        await asyncio.sleep(delay)
                        delay *= 2
                    continue
        if last_error:
            raise last_error
        raise LlmUnavailableError("所有 provider 均失败")
    finally:
        if owns_client and client is not None:
            await client.aclose()


def cache_key(prompt_id: str, tone: ToneName, query: str) -> str:
    return hashlib.sha256(f"{prompt_id}|{tone}|{query}".encode("utf-8")).hexdigest()