
import pytest

from boks_ai.llm import LlmUnavailableError, complete, is_configured


def test_unconfigured_is_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in [
        "BOKS_AI_LLM_BASE_URL",
        "BOKS_AI_LLM_API_KEY",
        "BOKS_AI_LLM_MODEL",
    ]:
        monkeypatch.delenv(name, raising=False)
    assert is_configured() is False


def test_complete_raises_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BOKS_AI_LLM_BASE_URL", raising=False)
    with pytest.raises(LlmUnavailableError):
        complete("sys", "user")


def test_complete_raises_on_connection_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BOKS_AI_LLM_BASE_URL", "http://127.0.0.1:1")
    monkeypatch.setenv("BOKS_AI_LLM_API_KEY", "test-key")
    monkeypatch.setenv("BOKS_AI_LLM_MODEL", "test-model")
    with pytest.raises(LlmUnavailableError):
        complete("sys", "user", timeout=1.0)
