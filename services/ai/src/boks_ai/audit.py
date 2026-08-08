"""审计日志：记录 AI 服务的调用决策，不落原文。

设计约束：不存储用户输入原文，只存事件、意图、是否拦截、引用来源、是否使用 LLM。
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from .models import AuditEvent


def audit_log_path() -> Path:
    return Path(os.environ.get("BOKS_AI_AUDIT_PATH", "boks_ai_audit.log"))


def append_audit(event: AuditEvent, path: Path | None = None) -> None:
    """追加一条审计事件到 JSONL 日志。"""
    path = path or audit_log_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event.model_dump(), ensure_ascii=False) + "\n")
