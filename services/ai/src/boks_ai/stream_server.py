"""
流式 AI 服务入口（替换 main.py 的同步端点）
启动：uvicorn boks_ai.streaming.server:app --host 0.0.0.0 --port 8001
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from boks_ai.streaming.server import app  # noqa: F401

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("boks_ai.streaming.server:app", host="0.0.0.0", port=8001, reload=False)
