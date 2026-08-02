"""LLM 适配层：受控 provider、超时、降级。

没有配置密钥或调用失败时不阻塞主流程，返回 None，由上层回退到模板答复。
"""

from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_TIMEOUT_SECONDS = 12.0


class LlmUnavailableError(RuntimeError):
    """LLM 未配置或不可达。"""


def _endpoint() -> str:
    base = os.environ.get("BOKS_AI_LLM_BASE_URL", "").rstrip("/")
    if not base:
        raise LlmUnavailableError("未配置 BOKS_AI_LLM_BASE_URL")
    return base + "/chat/completions"


def _api_key() -> str:
    return os.environ.get("BOKS_AI_LLM_API_KEY", "")


def _model() -> str:
    return os.environ.get("BOKS_AI_LLM_MODEL", "")


def is_configured() -> bool:
    return bool(_endpoint_or_none() and _model() and _api_key())


def _endpoint_or_none() -> str:
    try:
        return _endpoint()
    except LlmUnavailableError:
        return ""


def complete(
    system_prompt: str,
    user_prompt: str,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> str:
    """调用受控 provider 生成回复；任何失败抛出 LlmUnavailableError。"""
    if not is_configured():
        raise LlmUnavailableError("LLM 未配置（缺少端点、模型或密钥）。")
    payload: dict[str, Any] = {
        "model": _model(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 800,
    }
    headers = {"Authorization": f"Bearer {_api_key()}"}
    try:
        response = httpx.post(
            _endpoint(),
            json=payload,
            headers=headers,
            timeout=timeout,
        )
        response.raise_for_status()
        body = response.json()
        choices = body.get("choices") or []
        if not choices:
            raise LlmUnavailableError("LLM 返回空 choices。")
        content = (choices[0].get("message") or {}).get("content") or ""
        if not content.strip():
            raise LlmUnavailableError("LLM 返回空内容。")
        return content.strip()
    except LlmUnavailableError:
        raise
    except Exception as error:
        raise LlmUnavailableError(f"LLM 调用失败：{error}") from error
