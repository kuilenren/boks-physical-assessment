import pytest

from boks_ai.models import IntentDecision
from boks_ai.safety import RED_FLAG_PATTERNS, classify, refusal_content


def test_classify_intercepts_pain_and_numbness() -> None:
    decision = classify("孩子训练后疼痛和麻木，可以诊断吗？")
    assert decision.intercept is True
    assert decision.intent == "medical"


def test_classify_intercepts_emergency() -> None:
    decision = classify("孩子突然呼吸困难，喘不上气。")
    assert decision.intercept is True


def test_classify_intercepts_cobb_angle_question() -> None:
    decision = classify("报告里说脊柱侧弯 20 度，严重吗？")
    assert decision.intercept is True


def test_classify_allows_process_question() -> None:
    decision = classify("如何查看体测报告？")
    assert decision.intercept is False
    assert decision.intent == "process"


def test_classify_unknown_conservative() -> None:
    decision = classify("你好")
    assert decision.intercept is False
    assert decision.intent == "unknown"


def test_refusal_mentions_next_steps() -> None:
    content = refusal_content("孩子训练后疼痛和麻木，可以诊断吗？")
    assert "不能" in content
    assert "停止训练" in content
    assert "就医" in content


@pytest.mark.parametrize(
    "phrase",
    ["疼痛", "麻木", "夜间疼痛", "呼吸困难", "急症", "诊断", "Cobb 角"],
)
def test_every_red_flag_pattern_intercepts(phrase: str) -> None:
    decision = classify(f"孩子{phrase}，怎么办？")
    assert decision.intercept is True, phrase


@pytest.mark.parametrize("label, pattern", RED_FLAG_PATTERNS)
def test_red_flag_patterns_are_compiled(label: str, pattern: object) -> None:
    assert label
    assert pattern is not None


def test_intent_decision_model_fields() -> None:
    decision = IntentDecision(intercept=True, intent="medical", reason="x")
    assert decision.model_dump()["intercept"] is True
