import json
from datetime import UTC, datetime

from boks_ai.audit import append_audit
from boks_ai.models import AuditEvent


def test_audit_append_writes_jsonl(tmp_path) -> None:
    log = tmp_path / "audit.log"
    event = AuditEvent(
        event_id="evt-1",
        intent="medical",
        intercepted=True,
        citation_ids=[],
        llm_used=False,
        created_at=datetime.now(UTC).isoformat(),
    )
    append_audit(event, log)
    lines = log.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["intercepted"] is True
    assert payload["intent"] == "medical"
    assert "content" not in payload
