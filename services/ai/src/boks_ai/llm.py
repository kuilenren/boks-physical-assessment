"""LLM 适配层：多 provider（deepseek / minimax）、受控调用、超时、降级。

没有配置密钥或调用失败时不阻塞主流程，返回 None，由上层回退到模板答复。
每个 provider 使用独立的 BOKS_AI_* 环境变量；BOKS_AI_PROVIDER 指定主 provider，
其余已配置的 provider 作为自动降级兜底。
"""

from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_TIMEOUT_SECONDS = 12.0

PROVIDER_NAMES = ("deepseek", "minimax")


class LlmUnavailableError(RuntimeError):
    """LLM 未配置或不可达。"""


def _env(provider: str, name: str) -> str:
    if provider == "minimax":
        return os.environ.get(f"BOKS_AI_MINIMAX_{name}", "")
    return os.environ.get(f"BOKS_AI_LLM_{name}", "")


def _endpoint(provider: str) -> str:
    base = _env(provider, "BASE_URL").rstrip("/")
    if not base:
        raise LlmUnavailableError(f"未配置 {provider} 的 BOKS_AI_*_BASE_URL")
    return base + "/chat/completions"


def _api_key(provider: str) -> str:
    return _env(provider, "API_KEY")


def _model(provider: str) -> str:
    return _env(provider, "MODEL")


def _provider_configured(provider: str) -> bool:
    try:
        return bool(_endpoint(provider) and _model(provider) and _api_key(provider))
    except LlmUnavailableError:
        return False


def configured_providers() -> list[str]:
    return [name for name in PROVIDER_NAMES if _provider_configured(name)]


def provider_order() -> list[str]:
    """主 provider 在前，其余已配置的作为降级兜底。"""
    available = configured_providers()
    primary = (os.environ.get("BOKS_AI_PROVIDER") or "").strip().lower()
    if primary not in PROVIDER_NAMES:
        primary = ""
    if not primary and available:
        primary = available[0]
    if not primary:
        return []
    order = [primary]
    for name in available:
        if name != primary:
            order.append(name)
    return order


def is_configured() -> bool:
    return bool(provider_order())


def complete(
    system_prompt: str,
    user_prompt: str,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> str:
    """按序调用主 provider，失败时依次降级到其他已配置 provider。"""
    order = provider_order()
    if not order:
        raise LlmUnavailableError("LLM 未配置（缺少端点、模型或密钥）。")
    last_error: Exception | None = None
    for provider in order:
        try:
            return _complete_one(provider, system_prompt, user_prompt, timeout)
        except LlmUnavailableError as error:
            last_error = error
            continue
    if last_error:
        raise last_error
    raise LlmUnavailableError("LLM 未配置（缺少端点、模型或密钥）。")


def _complete_one(
    provider: str,
    system_prompt: str,
    user_prompt: str,
    timeout: float,
) -> str:
    if not _provider_configured(provider):
        raise LlmUnavailableError(f"{provider} LLM 未配置。")
    payload: dict[str, Any] = {
        "model": _model(provider),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 800,
    }
    headers = {"Authorization": f"Bearer {_api_key(provider)}"}
    try:
        response = httpx.post(
            _endpoint(provider),
            json=payload,
            headers=headers,
            timeout=timeout,
        )
        response.raise_for_status()
        body = response.json()
        choices = body.get("choices") or []
        if not choices:
            raise LlmUnavailableError(f"{provider} LLM 返回空 choices。")
        content = (choices[0].get("message") or {}).get("content") or ""
        if not content.strip():
            raise LlmUnavailableError(f"{provider} LLM 返回空内容。")
        return content.strip()
    except LlmUnavailableError:
        raise
    except Exception as error:
        raise LlmUnavailableError(f"{provider} LLM 调用失败：{error}") from error
