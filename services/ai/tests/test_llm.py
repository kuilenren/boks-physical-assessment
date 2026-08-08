
import pytest

from boks_ai.llm import (
    LlmUnavailableError,
    complete,
    configured_providers,
    is_configured,
    provider_order,
)


def _clear(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in [
        "BOKS_AI_LLM_BASE_URL",
        "BOKS_AI_LLM_API_KEY",
        "BOKS_AI_LLM_MODEL",
        "BOKS_AI_MINIMAX_BASE_URL",
        "BOKS_AI_MINIMAX_API_KEY",
        "BOKS_AI_MINIMAX_MODEL",
        "BOKS_AI_PROVIDER",
    ]:
        monkeypatch.delenv(name, raising=False)


def test_unconfigured_is_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear(monkeypatch)
    assert is_configured() is False
    assert configured_providers() == []
    assert provider_order() == []


def test_complete_raises_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear(monkeypatch)
    with pytest.raises(LlmUnavailableError):
        complete("sys", "user")


def test_deepseek_configured_only(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("BOKS_AI_LLM_BASE_URL", "http://127.0.0.1:1")
    monkeypatch.setenv("BOKS_AI_LLM_API_KEY", "test-key")
    monkeypatch.setenv("BOKS_AI_LLM_MODEL", "test-model")
    assert configured_providers() == ["deepseek"]
    assert provider_order() == ["deepseek"]


def test_minimax_configured_only(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("BOKS_AI_MINIMAX_BASE_URL", "http://127.0.0.1:1")
    monkeypatch.setenv("BOKS_AI_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("BOKS_AI_MINIMAX_MODEL", "MiniMax-M3")
    assert configured_providers() == ["minimax"]
    assert provider_order() == ["minimax"]


def test_both_configured_primary_deepseek(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("BOKS_AI_LLM_BASE_URL", "http://127.0.0.1:1")
    monkeypatch.setenv("BOKS_AI_LLM_API_KEY", "test-key")
    monkeypatch.setenv("BOKS_AI_LLM_MODEL", "test-model")
    monkeypatch.setenv("BOKS_AI_MINIMAX_BASE_URL", "http://127.0.0.1:2")
    monkeypatch.setenv("BOKS_AI_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("BOKS_AI_MINIMAX_MODEL", "MiniMax-M3")
    monkeypatch.setenv("BOKS_AI_PROVIDER", "deepseek")
    assert provider_order() == ["deepseek", "minimax"]


def test_both_configured_primary_minimax(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("BOKS_AI_LLM_BASE_URL", "http://127.0.0.1:1")
    monkeypatch.setenv("BOKS_AI_LLM_API_KEY", "test-key")
    monkeypatch.setenv("BOKS_AI_LLM_MODEL", "test-model")
    monkeypatch.setenv("BOKS_AI_MINIMAX_BASE_URL", "http://127.0.0.1:2")
    monkeypatch.setenv("BOKS_AI_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("BOKS_AI_MINIMAX_MODEL", "MiniMax-M3")
    monkeypatch.setenv("BOKS_AI_PROVIDER", "minimax")
    assert provider_order() == ["minimax", "deepseek"]


def test_complete_raises_on_connection_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("BOKS_AI_LLM_BASE_URL", "http://127.0.0.1:1")
    monkeypatch.setenv("BOKS_AI_LLM_API_KEY", "test-key")
    monkeypatch.setenv("BOKS_AI_LLM_MODEL", "test-model")
    with pytest.raises(LlmUnavailableError):
        complete("sys", "user", timeout=1.0)
