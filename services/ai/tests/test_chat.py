from fastapi.testclient import TestClient

from boks_ai.main import app

client = TestClient(app)


def make_document(source_id: str, title: str, content: str) -> dict[str, str]:
    return {
        "source_id": source_id,
        "version": "v1",
        "title": title,
        "content": content,
    }


def test_chat_refuses_red_flag() -> None:
    response = client.post(
        "/v1/chat",
        json={"content": "孩子训练后疼痛和麻木，可以诊断吗？", "documents": []},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["intercepted"] is True
    assert "不能" in payload["content"]
    assert "停止训练" in payload["content"]


def test_chat_degrades_to_template_with_citations() -> None:
    response = client.post(
        "/v1/chat",
        json={
            "content": "如何安排训练？",
            "documents": [
                make_document("kb-1", "训练计划说明", "训练计划按周拆分，包含目标和打卡。")
            ],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["intercepted"] is False
    assert payload["citations"][0]["source_id"] == "kb-1"


def test_classify_endpoint() -> None:
    response = client.post("/v1/classify", json={"content": "孩子夜间疼痛怎么办？"})
    assert response.status_code == 200
    assert response.json()["intercept"] is True
