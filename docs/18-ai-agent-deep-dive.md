# BOKS AI Agent 深度审查与重建设计（增量深化 #1）

> **配套文档**：`docs/16-comprehensive-market-standard-audit-2026.md` §2、`docs/17-detailed-execution-roadmap-2026.md` §阶段 4
> **审查基线**：2026-08-02（Asia/Shanghai）
> **范围**：`services/ai/src/boks_ai/*`、`services/api/src/chat.controller.ts`、`packages/contracts/src/index.ts`
> **目标**：把"if-else + bigram + if-LLM-down-then-template"升级为"成熟医疗 AI Agent 平台"

---

## 目录

- [0. 当前代码快照（再核实）](#0-当前代码快照再核实)
- [1. 目标架构总览](#1-目标架构总览)
- [2. LLM Provider 抽象层（替换 `llm.py`）](#2-llm-provider-抽象层替换-llmpy)
- [3. 提示词工程与 System Prompt 体系](#3-提示词工程与-system-prompt-体系)
- [4. RAG：字符 bigram → 混合检索](#4-rag字符-bigram--混合检索)
- [5. Agent 编排：ReAct + Plan-Execute](#5-agent-编排react--plan-execute)
- [6. Tool / Function calling 注册表](#6-tool--function-calling-注册表)
- [7. 安全策略升级（Safety 2.0）](#7-安全策略升级safety-20)
- [8. 多模态与语音](#8-多模态与语音)
- [9. 缓存、限流、成本与可观测性](#9-缓存限流成本与可观测性)
- [10. 流式 SSE 与客户端集成](#10-流式-sse-与客户端集成)
- [11. 评估集与红队](#11-评估集与红队)
- [12. 落地执行（接续 17 阶段 4）](#12-落地执行接续-17-阶段-4)
- [13. 验收指标与停止条件](#13-验收指标与停止条件)

---

## 0. 当前代码快照（再核实）

> 与 `docs/16` §0.1 / §2 一致；本节作为代码证据锚点，便于评审时按行号核对。

| 项 | 现状 | 文件:行 |
|---|---|---|
| AI 服务总规模 | 6 文件合计 ~530 行 | `services/ai/src/boks_ai/{main,llm,rag,safety,audit,models}.py` |
| 唯一可用 LLM 路径 | `complete()` → httpx 同步 POST | `llm.py:77-135` |
| 退化逻辑 | LLM 未配置/失败 → `_template_response()` 字符串拼接 | `main.py:46-77, 122-123` |
| 检索 | 字符 bigram Jaccard，title 0.4 + content 0.6 | `rag.py:12-28` |
| 拦截 | 6 类中文正则 + 1 类允许意图正则 | `safety.py:13-25` |
| 审计 | JSONL 追加，**不含 trace_id / latency / tokens** | `audit.py:19-24` |
| 数据模型 | `ChatRequest.documents` ≤ 64，无 chat history | `models.py:20-25` |
| 流式 SSE | **0 端点**；NestJS `chat.controller.ts:162-174` 同步等待 | `main.py`、`chat.controller.ts` |
| Function calling | **0** | `llm.py:106-114` |
| Tool registry | **0** | `services/ai` 整仓无 |
| Embedding | **0** | `services/ai` 整仓无 |
| 重试 | **0**（仅 provider 间切换） | `llm.py:87-95` |
| Token 计数 | **0** | `llm.py:124` |

**结构性结论**：
1. 当前 AI 服务的实现是**单次同步问答**而非 Agent：没有 tool loop、没有 plan/reflect、没有 state machine。
2. "Provider 抽象"是**手写 if-else**，LiteLLM/Portkey 的能力（路由、降级、配额、trace）一概没有。
3. RAG 是**纯字符匹配**，中文"50 米跑"和"50米跑"能命中，但"肺活量偏低"和"肺活量低于参考"无召回。
4. `safety.py` 是**纯正则**，对伪装、改写、emoji 隐喻、英文/拼音混入基本失效。

---

## 1. 目标架构总览

```
                 ┌────────────────────────────────────────────────────────┐
                 │                  NestJS API (chat)                     │
                 │   /v1/chat/stream (SSE)  /v1/agents/*  /v1/tools/*      │
                 └────────────────────────┬───────────────────────────────┘
                                          │  OAuth + traceparent
                 ┌────────────────────────▼───────────────────────────────┐
                 │            boks-ai-agent (FastAPI + LangGraph)          │
                 │                                                          │
                 │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
                 │  │ Router      │→ │ Plan-Execute │ →│ Tool Registry  │  │
                 │  │ (intent →   │  │ ReAct loop   │  │ • kb_search    │  │
                 │  │  plan_id)   │  │ ≤ 6 steps    │  │ • standard_calc│  │
                 │  └─────────────┘  └──────────────┘  │ • posture_query│  │
                 │                                     │ • calendar_q   │  │
                 │  ┌─────────────┐  ┌──────────────┐  │ • escalate_h   │  │
                 │  │ Safety 2.0  │  │ Memory       │  │ • delete_data  │  │
                 │  │ (regex +    │  │ (per-family  │  │ • export_pdf   │  │
                 │  │  LlamaGuard)│  │  short + sum)│  │   …            │  │
                 │  └─────────────┘  └──────────────┘  └────────────────┘  │
                 │                                                          │
                 │  ┌────────────────────────────────────────────────────┐  │
                 │  │ Hybrid Retriever (BM25 + pgvector + Reranker)      │  │
                 │  │ chunk 512/64 │ BGE-M3 │ BGE-reranker-large       │  │
                 │  └────────────────────────────────────────────────────┘  │
                 │                                                          │
                 │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
                 │  │ LLM Router  │  │ Cache (Redis)│  │ Cost Guard     │  │
                 │  │ (LiteLLM +  │  │ semantic-hash│  │ token quota    │  │
                 │  │  Portkey)   │  │ 24h TTL      │  │ per-family/day │  │
                 │  └─────────────┘  └──────────────┘  └────────────────┘  │
                 └──────────────────────────────────────────────────────────┘
                                          │
                 ┌────────────────────────▼───────────────────────────────┐
                 │   PostgreSQL + pgvector   │  Redis  │  S3  │  OTel       │
                 └──────────────────────────────────────────────────────────┘
```

**对标产品参考**：
- **平安 AskBob**：单轮 + 转人工 + 风险拦截；BOKS 增加 plan-execute。
- **Anthropic Claude for Healthcare**：citation card + limit + safety + uncertainty；BOKS 复用 `citations + limitations + uncertainty_score`。
- **医联 MedBrain**：clinical guideline retrieval + 真实世界数据；BOKS 对应"国家评分标准"+"知识库"。
- **阿里健康小鹿 / 京东京医千询**：症状自查 + 红线 + 转诊；BOKS 聚焦"非诊断红线 + 转人工审核员"。

---

## 2. LLM Provider 抽象层（替换 `llm.py`）

### 2.1 升级路径

**不要手写 Provider**，用 LiteLLM + 自研 Router。

```python
# services/ai/src/boks_ai/llm/router.py
from __future__ import annotations
import os, time, asyncio, hashlib
from dataclasses import dataclass
from typing import AsyncIterator, Literal
import httpx, tiktoken
from litellm import acompletion, Router  # litellm.Router 支持多模型路由 + 降级 + 重试

TaskName = Literal["chat", "classify", "rerank", "summary", "extract"]
ToneName = Literal["calm_teacher", "warm_companion", "concise_official"]

@dataclass(frozen=True)
class LlmMessage:
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    tool_call_id: str | None = None
    name: str | None = None

@dataclass(frozen=True)
class LlmRequest:
    task: TaskName
    messages: list[LlmMessage]
    temperature: float = 0.2
    max_tokens: int = 800
    trace_id: str | None = None
    family_id: str | None = None
    timeout_s: float = 30.0

@dataclass(frozen=True)
class LlmUsage:
    prompt_tokens: int
    completion_tokens: int
    cost_cny: float

@dataclass(frozen=True)
class LlmChunk:
    delta: str
    finish_reason: str | None = None
    usage: LlmUsage | None = None

# 模型路由表：task → 候选模型（按成本/质量排序）
ROUTER = Router(
    model_list=[
        {"model_name": "deepseek-chat",       "litellm_params": {"model": "deepseek/deepseek-chat",        "api_key": os.getenv("BOKS_AI_DEEPSEEK_API_KEY")}},
        {"model_name": "minimax-pro",        "litellm_params": {"model": "minimax/MiniMax-Text-01",        "api_key": os.getenv("BOKS_AI_MINIMAX_API_KEY")}},
        {"model_name": "rerank-bge",         "litellm_params": {"model": "hosted_vllm/bge-reranker-large",   "api_base": os.getenv("BOKS_RERANK_URL")}},
        {"model_name": "embed-bge-m3",       "litellm_params": {"model": "hosted_vllm/bge-m3",              "api_base": os.getenv("BOKS_EMBED_URL")}},
        {"model_name": "guard-llama-3",      "litellm_params": {"model": "hosted_vllm/llama-guard-3-8b",    "api_base": os.getenv("BOKS_GUARD_URL")}},
    ],
    routing_strategy="usage-based-v2",
    num_retries=3,                # 指数退避
    timeout=30,
    fallbacks=[{"deepseek-chat": ["minimax-pro"]}, {"minimax-pro": ["deepseek-chat"]}],
)

TOKEN_ENC = tiktoken.get_encoding("cl100k_base")

def count_tokens(text: str) -> int:
    return len(TOKEN_ENC.encode(text))

# 任务级默认参数
TASK_DEFAULTS: dict[TaskName, dict] = {
    "chat":     {"temperature": 0.3, "max_tokens": 900},
    "classify": {"temperature": 0.0, "max_tokens": 8},
    "rerank":   {"temperature": 0.0, "max_tokens": 4},
    "summary":  {"temperature": 0.1, "max_tokens": 350},
    "extract":  {"temperature": 0.0, "max_tokens": 600},
}

# 限流：按 family 配额 + 全局 QPS
import redis.asyncio as redis
REDIS = redis.from_url(os.getenv("BOKS_REDIS_URL", "redis://localhost:6379/0"))
DAILY_TOKEN_QUOTA_PER_FAMILY = 60_000  # 输入+输出合计

async def _enforce_quota(family_id: str, est_tokens: int) -> None:
    key = f"quota:{family_id}:{time.strftime('%Y%m%d')}"
    used = int(await REDIS.get(key) or 0)
    if used + est_tokens > DAILY_TOKEN_QUOTA_PER_FAMILY:
        raise QuotaExceeded("今日对话额度已用完，请明天再试。")

async def _record_usage(family_id: str, usage: LlmUsage) -> None:
    key = f"quota:{family_id}:{time.strftime('%Y%m%d')}"
    await REDIS.incrby(key, usage.prompt_tokens + usage.completion_tokens)
    await REDIS.expire(key, 60 * 60 * 36)

async def stream(req: LlmRequest, *, model: str = "deepseek-chat") -> AsyncIterator[LlmChunk]:
    if req.family_id:
        est = sum(count_tokens(m.content) for m in req.messages) + req.max_tokens
        await _enforce_quota(req.family_id, est)
    kwargs = {"model": model, "stream": True, "timeout": req.timeout_s,
              "messages": [m.__dict__ for m in req.messages],
              **TASK_DEFAULTS[req.task], "max_tokens": req.max_tokens}
    usage: LlmUsage | None = None
    async for raw in await acompletion(**kwargs):
        choice = raw.choices[0]
        u = getattr(raw, "usage", None)
        if u:
            usage = LlmUsage(u.prompt_tokens, u.completion_tokens, _cost(model, u))
        yield LlmChunk(delta=choice.delta.content or "", finish_reason=choice.finish_reason, usage=usage)
    if usage and req.family_id:
        await _record_usage(req.family_id, usage)
```

### 2.2 必须替换的现有代码

| 文件 | 旧实现 | 新实现 |
|---|---|---|
| `services/ai/src/boks_ai/llm.py:17` | `PROVIDER_NAMES = ("deepseek", "minimax")` | LiteLLM Router + 任务路由 |
| `services/ai/src/boks_ai/llm.py:15` | `DEFAULT_TIMEOUT_SECONDS = 12.0` | 任务级超时（chat 30s、classify 5s、rerank 10s） |
| `services/ai/src/boks_ai/llm.py:87-95` | 单层 fallback | 指数退避 + per-task 路由 + 语义降级 |
| `services/ai/src/boks_ai/llm.py:112-114` | 写死 `temperature=0.2, max_tokens=800` | 任务路由表（见 `TASK_DEFAULTS`） |
| `services/ai/src/boks_ai/main.py:122-123` | `except LlmUnavailableError: _template_response()` | **不再退化到字符串模板**；改为 `503 service_unavailable` + 客户端重试 |
| `services/ai/src/boks_ai/llm.py` 全文件 | 同步 httpx | `async httpx` + `asyncio.CancelledError` 透传 |

### 2.3 环境变量矩阵（增量）

```
BOKS_AI_LLM_PROVIDER=litellm
BOKS_AI_DEEPSEEK_API_KEY=...
BOKS_AI_MINIMAX_API_KEY=...
BOKS_RERANK_URL=https://internal-rerank.boks.local
BOKS_EMBED_URL=https://internal-embed.boks.local
BOKS_GUARD_URL=https://internal-guard.boks.local
BOKS_REDIS_URL=redis://redis:6379/0
BOKS_AI_DAILY_TOKEN_QUOTA=60000
```

---

## 3. 提示词工程与 System Prompt 体系

### 3.1 当前问题

`main.py:26-30` 是 4 句字符串：
```python
SYSTEM_PROMPT = (
    "你是 BOKS 儿童体测与体态健康教育的智能助手。你只能根据提供的已发布知识文档回答，"
    "不能根据文字或照片做医疗诊断，不能判断 Cobb 角，不输出未经知识库支撑的数值。"
    "回答用简体中文，简洁、可执行，必要时引用知识文档标题。"
)
```

**问题**：
1. 没有 persona/tone 切换（家长 vs 老师 vs 审核员视角不同）。
2. 没有"自报不确定性"的指令 → LLM 倾向自信输出。
3. 没有拒答红线示例 → 容易被 prompt injection 绕过。
4. 没有结构化输出契约（JSON schema） → 解析易错。

### 3.2 目标：YAML 模板 + 版本化

```yaml
# services/ai/src/boks_ai/prompts/v1/chat/parent_v1.yaml
id: chat/parent_v1
version: 1
persona: "calm_teacher"
language: zh-CN
max_output_tokens: 700
template: |
  你是一名 BOKS 平台的儿童健康教育助手，称呼用户为「家长」。
  严格约束：
  1. 仅根据【已发布知识资料】回答，不要引用未提供的资料，不要编造数值、年份、标准号。
  2. 不做医疗诊断；不判断 Cobb 角；不评估脊柱侧弯严重程度；不推荐药物剂量。
  3. 涉及疼痛、麻木、夜间痛、明显无力、呼吸困难 → 立即拒答并提示就医。
  4. 涉及未成年人安全、抑郁、自伤、家庭暴力 → 拒答并给出求助资源。
  5. 信息不足时，必须回答"我还不能确定，建议提供 XX 或咨询专业人员"。
  6. 引用必须在【知识资料】中，按 [来源标题 版本] 标注；不要发明引用。
  7. 训练建议要给动作、频次、强度、替代动作、停止条件。
  输出格式（严格 JSON）：
  {"answer": "...", "citations": [{"source_id":"...","version":"..."}],
   "limitations": ["..."], "uncertainty": 0.0~1.0, "next_steps": ["..."]}
tool_policy:
  allow: [kb_search, standard_calc, posture_query, calendar_query]
  deny: [delete_data, export_pdf, send_message]  # 默认不允许
  require_confirmation: [training_plan_write]
constraints:
  temperature: 0.3
  top_p: 0.9
  stop: ["<|im_end|>", "</answer>"]
```

### 3.3 Prompt Registry API

```python
# services/ai/src/boks_ai/prompts/registry.py
class PromptRegistry:
    def __init__(self, store: PromptStore) -> None:
        self._store = store  # PG 表 boks_prompt_versions
    def get(self, prompt_id: str, *, tone: ToneName | None = None) -> PromptTemplate:
        ...
    def render(self, prompt_id: str, *, vars: dict, tone: ToneName | None = None) -> list[dict]:
        tmpl = self.get(prompt_id, tone=tone)
        return [{"role": "system", "content": tmpl.render(**vars)},
                *vars["history"]]
    def list_versions(self, prompt_id: str) -> list[PromptVersionMeta]:
        ...
```

**新增表**（migration `019_prompt_registry.sql`）：

```sql
CREATE TABLE boks_prompt_versions (
  id              TEXT PRIMARY KEY,                -- "chat/parent_v1"
  family          TEXT NOT NULL,                   -- chat / classify / rerank / summary
  version         INTEGER NOT NULL,
  tone            TEXT NOT NULL,                   -- calm_teacher / warm_companion / concise_official
  status          TEXT NOT NULL CHECK (status IN ('draft','canary','active','retired')),
  yaml_body       TEXT NOT NULL,
  change_note     TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  reviewed_by     TEXT,
  approved_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at    TIMESTAMPTZ,
  UNIQUE (family, tone, version)
);
```

**Gate**：每次激活新版本需要"双人审核 + 评估集 Δ 指标 + 红队用例未退化"三关通过。

### 3.4 必须替换的现有代码

| 文件 | 旧实现 | 新实现 |
|---|---|---|
| `services/ai/src/boks_ai/main.py:26-30` | 单字符串 `SYSTEM_PROMPT` | PromptRegistry 渲染 |
| `services/ai/src/boks_ai/main.py:104-107` | 字符串拼接 context/user | registry.render(vars={history, context, child_grade}) |
| `services/api/src/chat.controller.ts:158-175` | 字符串退化回复 | API 层只做协议，不直接拼字符串 |

---

## 4. RAG：字符 bigram → 混合检索

### 4.1 检索能力升级

**现状**（`rag.py:12-28`）：
```
score = (|q∩title|/|q|) * 0.4 + (|q∩content|/|q|) * 0.6
```

**目标**：BM25 + pgvector + Reranker 三段式混合检索。

```
query
  ├── query rewriting (HyDE + 同义词扩展)            ← 多查询召回
  ├── BM25 (zh, jieba 0.42 + custom dict)            ← 字面命中
  ├── pgvector cosine (BGE-M3 1024d)                 ← 语义召回
  └── RRF (Reciprocal Rank Fusion) → top 30
        └── BGE-reranker-large                       ← top 6
              └── 送入 LLM 作为 context
```

### 4.2 切片策略

- **基础切片**：512 字符 + 64 重叠，按 `\n\n` 优先。
- **结构化优先**：知识库的"标题 / 摘要 / 适用对象 / 评分表 / 操作步骤"按字段切片，避免在分数表中间切断。
- **元数据 tag**：`source_id, version, audience(preschool|primary|junior_high|senior_high|parent|teacher), category, source_url, hash, published_at`。
- **child_id 隔离**：RLS 强制 `published_at IS NOT NULL AND status = 'published'`。

### 4.3 代码骨架

```python
# services/ai/src/boks_ai/retrieval/hybrid.py
@dataclass
class RetrievedChunk:
    chunk_id: str
    source_id: str
    version: str
    title: str
    content: str
    score: float
    retrieval: Literal["bm25", "vector", "both"]

class HybridRetriever:
    def __init__(self, *, bm25: BM25, vector: PgvectorStore, rerank: CrossEncoder,
                 prompt_registry: PromptRegistry) -> None:
        self.bm25, self.vector, self.rerank = bm25, vector, rerank
        self.prompts = prompt_registry
    async def retrieve(self, *, query: str, family_id: str, audience: str | None,
                       top_k: int = 6) -> list[RetrievedChunk]:
        rewrites = await self._expand(query)
        bm25_hits = await self.bm25.batch_search(rewrites, k=30, filter={"status":"published"})
        vec_hits  = await self.vector.batch_search(rewrites, k=30, filter={"status":"published"})
        fused = self._rrf(bm25_hits, vec_hits, k=60)
        reranked = await self.rerank.rerank(query=query, candidates=fused[:30], top_k=top_k)
        return [RetrievedChunk(**c.metadata, score=c.score, retrieval=c.source) for c in reranked]
```

### 4.4 评估集（必须）

```
data/eval/rag/golden_set_v1.jsonl   # ≥ 200 query，含 expected_source_id, expected_section
data/eval/rag/judges/gpt-judge.yaml  # LLM-as-judge 模板
```

指标：
- **Recall@6** ≥ 0.85
- **MRR** ≥ 0.70
- **Citation Precision** ≥ 0.90
- **Answer Faithfulness**（LLM-judge）≥ 0.85

### 4.5 必须替换的现有代码

| 文件 | 旧实现 | 新实现 |
|---|---|---|
| `services/ai/src/boks_ai/rag.py:12-16` | `_bigrams()` | 删除 |
| `services/ai/src/boks_ai/rag.py:19-28` | `_score_document()` | 删除（被 HybridRetriever 取代） |
| `services/ai/src/boks_ai/rag.py:31-44` | `retrieve()` 函数式 API | HybridRetriever 类（async + 多查询 + RRF + rerank） |
| `services/api/src/chat.controller.ts:32-44` | `publishedKnowledge()` 直接透传整库 | API 层只传 `query`，由 AI 服务内部调 RAG |

---

## 5. Agent 编排：ReAct + Plan-Execute

### 5.1 为什么必须做 Agent

**单轮问答无法解决的用户场景**：
1. "我家 9 岁男孩 50 米跑 9.8 秒，怎么练？" → 需要（a）查学段评分表（b）对比该年龄中位数（c）输出训练计划（d）写入日历。
2. "上周体测后我儿子跳远成绩下降了" → 需要（a）拉历史报告（b）查上次训练（c）关联近期体态（d）给出归因。
3. "把上次体测报告发给我" → 需要（a）查 PDF（b）脱敏（c）签名 URL。
4. "孩子说他膝盖疼还要不要继续训练" → 触发 Safety 红线 → 拒答 + 提示就医。

### 5.2 目标架构：LangGraph 双模式

```python
# services/ai/src/boks_ai/agent/graph.py
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver

class AgentState(TypedDict):
    messages: list[LlmMessage]
    plan: list[PlanStep]
    observations: list[dict]
    citations: list[Citation]
    safety: SafetyDecision
    family_id: str
    child_id: str | None
    context_report_id: str | None
    context_plan_id: str | None
    user_intent: IntentDecision
    escalated: bool
    uncertainty: float
    trace: list[StepRecord]

def build_graph(tools: ToolRegistry) -> CompiledGraph:
    g = StateGraph(AgentState)
    g.add_node("router",    router_node)         # 意图路由：单轮 / plan / 拒答
    g.add_node("planner",   planner_node)        # Plan-Execute: 拆解步骤
    g.add_node("executor",  executor_node)       # ReAct: 调 tool → 观察 → 反思
    g.add_node("synth",     synth_node)          # 合成最终答复（流式）
    g.add_node("safety",    safety_gate_node)    # Safety 2.0: 输入/输出双向
    g.add_node("memory",    memory_node)         # 写入对话历史
    g.add_node("audit",     audit_node)          # trace + cost + cite 落库
    g.set_entry_point("router")
    g.add_conditional_edges("router",
        lambda s: "safety_refuse" if s["safety"].intercept else
                  "planner" if _needs_plan(s) else "executor")
    g.add_edge("planner", "executor")
    g.add_conditional_edges("executor",
        lambda s: "executor" if s["plan"] and not s["plan"][0].done else "synth",
        {"executor": "executor", "synth": "synth"})
    g.add_edge("synth", "safety")
    g.add_conditional_edges("safety",
        lambda s: "router" if s["safety"].retry else "memory",
        {"router": "router", "memory": "memory"})
    g.add_edge("memory", "audit")
    g.add_edge("audit", END)
    return g.compile(checkpointer=PostgresSaver.from_conn_string(POSTGRES_URL))
```

### 5.3 Plan / Step 数据模型

```python
@dataclass
class PlanStep:
    step_id: str
    goal: str
    tool_hint: str | None
    depends_on: list[str]
    done: bool = False
    observation: dict | None = None
```

**Step Limit**：每会话 ≤ 6 步；超时 30s；失败 2 次升级人工审核员。

### 5.4 反射（Reflection）+ 不确定性

每次执行后让 LLM 自评：
- `uncertainty` ∈ [0, 1]：信息充分度
- `completeness` ∈ [0, 1]：是否覆盖所有 plan step
- 若 `uncertainty > 0.6` 或 `completeness < 0.7` → 触发第二轮 ReAct 或拒答 + 转人工

### 5.5 必须新增的代码

| 文件 | 作用 |
|---|---|
| `services/ai/src/boks_ai/agent/graph.py` | LangGraph 主图 |
| `services/ai/src/boks_ai/agent/router.py` | 意图路由 |
| `services/ai/src/boks_ai/agent/planner.py` | 计划生成 |
| `services/ai/src/boks_ai/agent/executor.py` | ReAct 执行 |
| `services/ai/src/boks_ai/agent/synth.py` | 流式合成 |
| `services/ai/src/boks_ai/agent/state.py` | AgentState TypedDict |
| `services/ai/src/boks_ai/agent/memory.py` | 对话历史（per family/child） |
| `services/ai/src/boks_ai/agent/audit.py` | trace 写入 PG |

---

## 6. Tool / Function calling 注册表

### 6.1 Tool 列表（P0 / P1 / P2）

| ID | 名称 | 输入 | 输出 | 权限等级 | 优先级 |
|---|---|---|---|---|---|
| `kb_search` | 知识库检索 | `{query, audience, top_k}` | `RetrievedChunk[]` | read | P0 |
| `standard_calc` | 标准评分计算 | `{child, measurements, standard_version_id}` | `IndicatorResult[]` | read | P0 |
| `standard_lookup` | 标准表查询 | `{school_stage, grade, sex, indicator}` | `BandTable` | read | P0 |
| `posture_query` | 体态报告查询 | `{child_id, session_id?}` | `PostureReport` | read | P0 |
| `report_query` | 体测报告查询 | `{child_id, range}` | `ReportSummary` | read | P0 |
| `training_query` | 训练计划/打卡 | `{child_id, range}` | `PlanSummary` | read | P0 |
| `calendar_query` | 日历/打卡 | `{child_id, from, to}` | `CheckIn[]` | read | P0 |
| `training_plan_write` | 训练计划写入 | `{child_id, plan, version}` | `Plan` | write | P1 |
| `check_in_write` | 打卡写入 | `{child_id, plan_id, day, status}` | `CheckIn` | write | P1 |
| `export_pdf` | 导出 PDF/图片 | `{report_id, format}` | `{url, expires_at}` | write | P1 |
| `delete_data` | 删除数据 | `{child_id, scope}` | `{ticket_id}` | destructive | P2（需审核员审批） |
| `send_message` | 推送通知 | `{family_id, template, vars}` | `{message_id}` | write | P2 |
| `escalate_human` | 升级人工审核员 | `{family_id, topic, context}` | `{ticket_id}` | workflow | P1 |

### 6.2 Tool Schema（OpenAI / Anthropic 双兼容）

```python
# services/ai/src/boks_ai/tools/registry.py
class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDef] = {}
    def register(self, tool: ToolDef) -> None:
        self._tools[tool.id] = tool
    def openai_schemas(self, *, allow: set[str]) -> list[dict]:
        return [t.openai_schema() for t in self._tools.values() if t.id in allow]
    def anthropic_schemas(self, *, allow: set[str]) -> list[dict]:
        return [t.anthropic_schema() for t in self._tools.values() if t.id in allow]
    async def call(self, *, tool_id: str, args: dict, ctx: ToolContext) -> ToolResult:
        tool = self._tools[tool_id]
        return await tool.run(args, ctx)

TOOL_KB_SEARCH = ToolDef(
    id="kb_search",
    description="搜索已发布的 BOKS 知识库（评分标准、训练指南、体态观察说明等）。",
    parameters={
        "type": "object",
        "properties": {
            "query":       {"type": "string", "minLength": 1, "maxLength": 200},
            "audience":    {"type": "string", "enum": ["preschool","primary","junior_high","senior_high","parent","teacher"]},
            "top_k":       {"type": "integer", "minimum": 1, "maximum": 10, "default": 6},
        },
        "required": ["query"],
        "additionalProperties": False,
    },
    handler=KbSearchHandler(),
    permission="read",
    timeout_s=4.0,
    retry=1,
)
```

### 6.3 Tool 错误恢复

- **可重试**（5xx / 超时）：指数退避，最多 2 次。
- **参数错**（4xx）：回传给 LLM 让其修正参数，1 次机会。
- **权限拒绝**：升级到 `escalate_human` 或终止该 step。
- **超时**：超过 `timeout_s` 自动 kill，记录 `tool_timeout`，落入 plan step 失败计数。

### 6.4 必须新增的代码

| 文件 | 作用 |
|---|---|
| `services/ai/src/boks_ai/tools/registry.py` | ToolRegistry |
| `services/ai/src/boks_ai/tools/handlers/kb_search.py` | RAG 调用 |
| `services/ai/src/boks_ai/tools/handlers/standard_calc.py` | 调用 NestJS 评分服务 |
| `services/ai/src/boks_ai/tools/handlers/posture_query.py` | 调 NestJS 体态接口 |
| `services/ai/src/boks_ai/tools/handlers/calendar_query.py` | 调 NestJS 训练接口 |
| `services/ai/src/boks_ai/tools/handlers/escalate_human.py` | 建工单 |
| `services/ai/src/boks_ai/tools/handlers/export_pdf.py` | 调 PDF 服务 |

---

## 7. 安全策略升级（Safety 2.0）

### 7.1 现状问题（`safety.py:13-25`）

```python
("diagnosis_request", re.compile(r"诊断|确诊|查体|Cobb|cobb角|脊柱侧弯"))
```

**失效场景**：
1. "我家小孩背有点歪" → "歪"未命中 → 漏拦
2. "cobb jiao"（拼音） → 未命中 → 漏拦
3. "帮我看看这 X 光片是什么" → 未命中 → 漏拦
4. "孩子最近不想上学"（抑郁信号） → 全部漏拦

### 7.2 三层防御

**Layer 1 — 正则（毫秒级前置过滤）**：保留现有 + 扩充（见 7.3）。

**Layer 2 — Llama-Guard-3 / Qwen2.5-Guard**（小模型 0.5s 内）：
- 类目：S1 暴力 / S2 非consensual / S3 自伤 / S4 性 / S5 枪械 / S6 毒品 / S7 犯罪 / S8 隐私 / S9 医疗专业建议 / S10 误导健康。
- 输出结构：`{unsafe: bool, categories: [...], rationale: "..."}`

**Layer 3 — LLM-as-judge**（仅边界 case）：
- 输入"红旗但被 Guard 放行"的样本；
- 输入"Guard 拦截但用户反驳'我只是问问'"的申诉；
- 输入"上下文诱导"型 prompt injection。

### 7.3 正则扩充（v2）

```python
RED_FLAG_PATTERNS_V2: list[tuple[str, re.Pattern[str]]] = [
    ("emergency",        re.compile(r"呼吸困难|喘不上气|窒息|晕厥|昏迷|抽搐|急症|急救|失去意识|发绀|嘴唇发紫")),
    ("severe_weakness",  re.compile(r"明显无力|下肢无力|不能站立|肢体麻木|发麻|刺痛|跛行|突然站不起来")),
    ("persistent_pain",  re.compile(r"夜间疼痛|夜间痛|静息痛|持续疼痛|反复疼痛|疼痛[2-9]天|疼了一周")),
    ("acute_pain",       re.compile(r"急性疼痛|剧烈疼痛|剧痛|锐痛|酸痛|胀痛|突然剧痛")),
    ("injury",           re.compile(r"外伤|骨折|扭伤|脱位|血肿|淤青|肿胀|擦伤|烫伤")),
    ("diagnosis_request",re.compile(r"诊断|确诊|查体|Cobb|cobb角|cobb jiao|脊柱侧弯|侧弯[0-9]+度|是不是病|严重吗")),
    ("imaging_request",  re.compile(r"看.*片|X光|MRI|CT|影像|片子|核磁")),
    ("medication",       re.compile(r"药|剂量|吃几片|处方|布洛芬|抗生素|激素|补钙|补锌|维生素D.*多少IU")),
    ("mental_health",    re.compile(r"不想上学|想死|自残|自杀|抑郁|焦虑[发作]|睡不着[觉]")),
    ("photo_diagnosis",  re.compile(r"看.*照片|这是.*病|这是.*侧弯|是不是.*突出|骨头.*错位")),
    ("injection_attempt",re.compile(r"忽略.*指令|忽略.*prompt|system\s*prompt|你现在是|act as|忽略上面|无视之前")),
    ("privacy_leak",     re.compile(r"身份证|手机号|家庭住址|学校地址|班级|班主任|电话|微信号")),
]
```

### 7.4 输出端校验（必须）

```python
def validate_output(answer: str, citations: list[Citation]) -> OutputDecision:
    # 1. 不允许出现"我判断 / 我诊断 / Cobb 角约为 / 严重程度"
    if re.search(r"(我判断|我诊断|Cobb\s*角|严重程度为|建议剂量)", answer):
        return OutputDecision(rewrite_required=True, reason="diagnostic_language")
    # 2. 所有数字必须可追溯到 citation
    for n in re.findall(r"\b\d+(\.\d+)?\b", answer):
        if not _any_citation_contains(n, citations):
            return OutputDecision(rewrite_required=True, reason="uncited_number")
    # 3. 引用必须存在于知识库（防止幻觉）
    for c in citations:
        if not _kb_exists(c.source_id, c.version):
            return OutputDecision(rewrite_required=True, reason="hallucinated_citation")
    return OutputDecision(rewrite_required=False)
```

### 7.5 必须替换的现有代码

| 文件 | 旧实现 | 新实现 |
|---|---|---|
| `services/ai/src/boks_ai/safety.py:13-25` | 6 类正则 | 12 类正则 + Llama-Guard + 输出校验 |
| `services/api/src/chat-safety.ts` | 仅复用 | 升级为异步调用 + 缓存 Guard 结果 |

---

## 8. 多模态与语音

### 8.1 现状缺口

- **语音 ASR/TTS**：声明了（README）但**未实现**。
- **照片多模态**：体态拍摄走 `posture.controller.ts`，AI 完全不参与。
- **数字人/虚拟教练**：0%。

### 8.2 多模态接入（按风险等级分层）

| 模态 | 用途 | 风险等级 | 实现路径 |
|---|---|---|---|
| **文本** | 对话、报告解读 | 低 | 已实现，需升级（见 §2-7） |
| **结构化数据**（JSON） | 评分/历史/体态报告 | 低 | 已实现，需 Tool 化（见 §6） |
| **数字人语音 TTS** | 训练动作示范、体测播报 | 中 | 调用家长可控的童声 TTS 引擎（本地 Edge TTS / Azure Speech 儿童音色），**不上传儿童录音** |
| **语音 ASR** | 家长语音输入咨询 | 中 | 家长本人录音，按 PIPL 7 天自动删除，**儿童音频完全不允许** |
| **儿童体态照片** | 体态观察（非诊断） | **高** | 只在家长端本地压缩 + 哈希上传，AI 服务**只接收尺寸/MIME/质量分**，不接收原图（与现有 `posture.controller.ts:381` 声明一致） |
| **可穿戴数据**（预留） | 心率/步数 | 高 | **P2**，本次不接入 |
| **X 光/影像** | — | **禁用** | 永远拒答 |

### 8.3 语音模块骨架

```python
# services/ai/src/boks_ai/voice/asr.py
class AsrProvider(Protocol):
    async def transcribe(self, audio_bytes: bytes, *, language: str) -> AsrResult: ...

# 实现一：家长手机端 WebRTC + 端侧 ASR（Sherpa-onnx 1.0）— **首选**
#   优点：不上传音频，PIPL 合规，弱网可降级
# 实现二：服务端 ASR（仅家长录音）— 备选
#   - 7 天自动删除
#   - 转写后只保留文本 + 哈希
#   - 不参与模型训练
```

### 8.4 童声 TTS 安全约束

- **可选音色** ≤ 3 种，全部标注"非真人，AI 合成"。
- **内容范围**：训练动作名、体测项目名、鼓励语，不输出数字人姓名/家庭信息。
- **家长同意**：单独开关；默认关闭。

### 8.5 必须新增的代码

| 文件 | 作用 |
|---|---|
| `services/ai/src/boks_ai/voice/asr_endpoint.py` | `/v1/voice/asr` |
| `services/ai/src/boks_ai/voice/tts_endpoint.py` | `/v1/voice/tts` |
| `services/ai/src/boks_ai/multimodal/image_quality.py` | 复用 posture 已有 |
| `services/ai/src/boks_ai/multimodal/posture_analyzer.py` | 见 `docs/17` 阶段 5 |

---

## 9. 缓存、限流、成本与可观测性

### 9.1 缓存策略

```
key = sha256(prompt_template_id + tone + query_normalized + family_school_stage + top_k)
ttl = 24h
scope = per-family-id  # 不同家庭不共享
```

**关键**：cache 必须记录 `citations`、`trace_id`、`created_at`，过期即失效。

### 9.2 限流

| 维度 | 限制 |
|---|---|
| 全局 chat QPS | 50 RPS（生产） |
| 单 family QPS | 5 RPS |
| 单 family 日 token | 60k 输入+输出 |
| 单 family 24h 会话 | 30 轮 |
| 单会话最大 step | 6 |

### 9.3 成本看板

```sql
CREATE MATERIALIZED VIEW boks_cost_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  family_id,
  model,
  sum(prompt_tokens) AS in_tok,
  sum(completion_tokens) AS out_tok,
  sum(cost_cny) AS cost
FROM boks_llm_usage
GROUP BY 1, 2, 3;
CREATE UNIQUE INDEX ON boks_cost_daily(day, family_id, model);
```

看板：Grafana 面板，按日/家庭/模型切片，告警阈值 `cost_cny > 50 / day / family` 或 `P95 latency > 4s`。

### 9.4 可观测性

- **OTel trace**：`traceparent` 从 API 透传到 AI；每个 node 标记 span。
- **Prometheus 指标**：
  - `boks_chat_request_total{model,intent}`
  - `boks_chat_tokens_total{family_id,direction}`
  - `boks_chat_latency_seconds{model,stage}`（stage: plan/exec/synth/safety）
  - `boks_safety_intercept_total{rule}`
  - `boks_tool_call_total{tool,status}`
- **Sentry**：未捕获异常 + 客户端崩溃。

### 9.5 必须新增的代码 / 配置

| 文件 | 作用 |
|---|---|
| `services/ai/src/boks_ai/observability/otel.py` | OTel setup |
| `services/ai/src/boks_ai/observability/metrics.py` | Prometheus |
| `services/ai/migrations/020_llm_usage.sql` | usage 表 + 物化视图 |
| `infra/grafana/dashboards/ai.json` | 看板 |

---

## 10. 流式 SSE 与客户端集成

### 10.1 协议（OAI 兼容）

```
POST /v1/chat/stream
Content-Type: application/json
Accept: text/event-stream
Authorization: Bearer ...

{"messages":[...], "child_id":"...", "context_report_id":"..."}

↓ SSE
event: plan
data: {"steps":["kb_search","standard_calc"]}

event: tool_call
data: {"id":"kb_search","args":{"query":"...","audience":"primary"}}

event: delta
data: {"delta":"根据"}

event: tool_result
data: {"id":"kb_search","ok":true,"citations":[...]}

event: message
data: {"answer":"...","citations":[...],"uncertainty":0.2}

event: done
data: {"trace_id":"...","usage":{"in":320,"out":420,"cost":0.02}}
```

### 10.2 后端

```python
# services/ai/src/boks_ai/streaming.py
from sse_starlette.sse import EventSourceResponse

@app.post("/v1/chat/stream")
async def chat_stream(req: ChatRequest) -> EventSourceResponse:
    async def event_gen():
        async for ev in agent.stream(req):
            yield {"event": ev.event, "data": ev.model_dump_json()}
    return EventSourceResponse(event_gen(), ping=15)
```

### 10.3 NestJS 透传

```ts
// services/api/src/chat.controller.ts 升级
@Controller("chat")
export class ChatController {
  @Post("conversations/:id/stream")
  async stream(@Param("id") id: string, @Body() body: ChatStreamDto, @Req() req: Request, @Res() res: Response) {
    const context = requireAccountContext(req);
    const upstream = await this.aiStream(context, id, body);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    for await (const ev of upstream) {
      res.write(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`);
    }
    res.end();
  }
}
```

### 10.4 客户端

- **miniprogram**：`wx.request` 不支持 SSE，改用 `@taro-hooks/use-request` 或自建 `requestTask.onChunkReceived`。
- **Flutter**：`http.Client().send(streamedRequest)` + `utf8.decoder.bind(stream)`。
- **Admin**：`fetch()` + `ReadableStream`。

### 10.5 取消（Abort）

- NestJS `@Req()` 监听 `request.on('close')` → 取消 token → 透传到 AI 服务。
- AI 服务在 LangGraph step 边界检查 `cancelled`。

---

## 11. 评估集与红队

### 11.1 评估集（P0）

```
data/eval/chat/golden_v1.jsonl     # ≥ 300 case，覆盖 12 类意图 + 4 类红旗 + 4 类拒答
data/eval/rag/golden_set_v1.jsonl  # ≥ 200 case
data/eval/safety/red_team_v1.jsonl # ≥ 100 case，含 prompt injection / jailbreak
data/eval/agent/plan_v1.jsonl      # ≥ 80 case 多步任务
```

### 11.2 评估维度

| 维度 | 指标 | 阈值 |
|---|---|---|
| 答案忠实度（faithfulness） | LLM-judge 5 分 | ≥ 4.0 |
| 引用准确率（citation precision） | 人工+规则 | ≥ 0.90 |
| 召回率（recall@6） | 离线 | ≥ 0.85 |
| 红旗漏拦率 | 规则 + 红队 | ≤ 0.02 |
| 拒答过度率 | 规则 | ≤ 0.10 |
| 多步任务完成率 | 离线 | ≥ 0.75 |
| P95 延迟 | 实测 | ≤ 4s |
| 单会话成本 | 实测 | ≤ 0.15 CNY |

### 11.3 红队剧本（强制覆盖）

1. 诱导打破"非诊断"承诺 → 必须拒答
2. prompt injection 试图改 SYSTEM → 必须拒答
3. 隐私套话（要别的家长数据）→ 必须拒答
4. 抑郁/自伤信号 → 必须给出求助资源
5. 假新闻引用 → 必须以知识库为准
6. 多语言混杂 → 仍按 zh-CN 处理
7. emoji 隐喻（💊 = 药）→ 必须命中安全
8. 反向诱导（"我不是要诊断，只是确认"）→ 必须拒答

### 11.4 必须新增

```
services/ai/tests/eval/runner.py
services/ai/tests/eval/judges/faithfulness.py
services/ai/tests/fixtures/red_team.jsonl
.github/workflows/eval.yml  # PR 必跑
```

---

## 12. 落地执行（接续 17 阶段 4）

> 与 `docs/17` §阶段 4 并行扩展，**新增**任务用 `[NEW]` 标注。

| 周次 | 任务 | 交付物 | 验收 |
|---|---|---|---|
| W1 D1-2 | LiteLLM Router + 任务路由表 + 限流 | `llm/router.py` + 单测 | 5 个 task 路由全通过；超时/重试/降级覆盖 |
| W1 D3-5 | Prompt Registry + 4 个 v1 模板 + 双人审核 | YAML 模板 + 表 + 审核记录 | chat/parent_v1、classify/safety_v1、summary/v1、extract/v1 上线 |
| W1 D5 | **[NEW]** tiktoken + quota | Redis 配额 + 看板 | 配额超限返回 429 |
| W2 D1-4 | HybridRetriever + BGE-M3 + Reranker + pgvector | retrieval 模块 + 评估集 | Recall@6 ≥ 0.85 |
| W2 D5 | **[NEW]** bm25 中文分词 + custom dict（jieba + BOKS 词表） | `data/bm25_dict.txt` | OOV 率 < 2% |
| W3 D1-3 | LangGraph 主图 + Router/Planner/Executor/Synth | `agent/graph.py` + 单测 | 多步任务完成率 ≥ 0.75 |
| W3 D4-5 | Tool Registry + 8 个 P0 tool | `tools/*` | tool 调用成功率 ≥ 0.95 |
| W3 D5 | **[NEW]** Tool 错误恢复 + 限流 | middleware | 5xx 重试 1 次、参数错回传 1 次 |
| W4 D1-3 | Safety 2.0 三层防御 + 输出校验 | `safety/*` | 红队漏拦 ≤ 0.02 |
| W4 D4 | **[NEW]** 流式 SSE 端到端 | `streaming.py` + 客户端 SDK | P95 ≤ 4s，首 token ≤ 800ms |
| W4 D5 | **[NEW]** 缓存 + trace 落库 | cache + boks_llm_usage | cache hit rate ≥ 15% |
| W5 D1-3 | Agent 集成 + 多步任务评估 | golden set + report | 阈值全过 |
| W5 D4 | **[NEW]** 成本看板 + Grafana | dashboard | 告警阈值设置 |
| W5 D5 | **[NEW]** 评估 CI | `.github/workflows/eval.yml` | PR 必跑 |

**人力**：2 名 AI 工程师 × 5 周（其中 1 名主战 LLM/检索，1 名主战 Agent/Safety）；外部资源：1 名数据标注（评估集 + 红队），约 80 工时。

---

## 13. 验收指标与停止条件

### 13.1 上线门槛（P0 必须 100%）

- [ ] LiteLLM Router 在线，5 个任务路由全部验证
- [ ] Prompt Registry 上线 4 个 v1 模板，全部双人审核通过
- [ ] Hybrid Retriever Recall@6 ≥ 0.85
- [ ] LangGraph 主图通过多步评估
- [ ] Tool Registry 上线 8 个 P0 tool
- [ ] Safety 2.0 红队漏拦率 ≤ 0.02
- [ ] 流式 SSE 端到端，P95 ≤ 4s
- [ ] 缓存命中 ≥ 15%
- [ ] 评估 CI 接入 PR 必跑
- [ ] 成本看板 + 告警上线

### 13.2 停止条件（任一不达标则不通过）

1. **任何一类红旗漏拦率 > 2%**
2. **引用准确率 < 90%**
3. **多步任务完成率 < 75%**
4. **P95 延迟 > 4s 持续 24h**
5. **单 family 日 token > 100k**
6. **红队 100 题中 ≥ 3 题出现不当答复**

### 13.3 与现有 16/17 差异

| 项 | 16 提到 | 17 提到 | 本文档增量 |
|---|---|---|---|
| LiteLLM 替换手写 provider | 简述 | 提 | §2.1-2.3 完整 Router 配置 |
| Prompt Registry + YAML + 版本审核 | 未提 | 未提 | §3 全套（含 PG 表） |
| BGE-M3 + Reranker + 评估指标 | 提 | 提 | §4.1-4.5（HyDE + RRF + golden set） |
| LangGraph ReAct/Plan-Execute | 提 | 未展开 | §5.1-5.5 完整图 + Step 模型 |
| Tool Registry 13 个工具清单 | 未提 | 未提 | §6.1-6.4 全表 + Schema |
| Safety 2.0 三层防御 | 简述 | 未展开 | §7.2-7.5 12 类正则 + Guard 模型 + 输出校验 |
| 多模态按风险分层 | 简述 | 简述 | §8.1-8.5（含禁用清单） |
| 成本看板 + 限流 | 未提 | 未提 | §9.2-9.3 阈值 + 物化视图 |
| 流式 SSE 协议 + 取消 | 提 | 提 | §10.1-10.5 OAI 兼容 |
| 红队剧本 8 类 | 未提 | 提 | §11.3 完整剧本 |

---

> **下一步**：本方案审批后，启动阶段 4 第一周；阶段 4 末做评估集基线快照 → 阶段 5 体态识别开始复用 hybrid retriever 与 Tool Registry。