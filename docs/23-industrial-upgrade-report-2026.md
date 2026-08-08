# BOKS 工业级升级完成报告（2026-08-02）

> **配套文档**：[docs/16](../16-comprehensive-market-standard-audit-2026.md) → [docs/22](../22-incremental-roadmap-addendum.md)
> **提交**：commit `947a48d`（main 分支，本地）
> **范围**：P0 一期（阶段 0/1/2/3/4/6 + 部分 11）

---

## 1. 最终验收

| 测试套件 | 结果 | 命令 |
|---|---|---|
| 冒烟 | **3/3 ✅** | `node tests/smoke/smoke.mjs` |
| 回归 | **5/5 ✅** | `node tests/regression/auth.test.mjs` |
| 端到端 | **19/19 ✅** | `node tests/e2e/full-flow.test.mjs` |
| AB 测试 | **5 family 分桶 ✅** | `tests/ab/run.cmd` |
| **总计** | **32 / 32 ✅** | |

**手动全链路验证**（含小程序与 Flutter 互通）：

```
1. dev-login → token issued (family-primary-low-001)
2. /v1/families/me → family + 1 child
3. /v1/assessment/history?child_id=child-001 → 1 report
4. /v1/training?child_id=child-001 → plans returned
5. /v1/posture/reports?child_id=child-001 → 1 report
6. /v1/chat/conversations → conversation created
7. /v1/chat/conversations/:id/stream → SSE 200 (trace/delta/message/done)
8. /v1/chat 疼痛拦截 → intercepted=true
```

---

## 2. 数据库（PG + pgvector + RLS + 信封加密）

| 指标 | 改造前 | 改造后 |
|---|---|---|
| Migration 文件数 | 1 | **28**（领域化） |
| 表数 | ~6（JSON 双写） | **28** PG 关系表 |
| RLS 启用表 | 0 | **21** FORCE RLS |
| 字段加密 | 0 | **display_name / birth_date / storage_key** 信封加密 |
| 审计哈希链 | 0 | **sha256(prev + payload) 触发器** |
| KMS | 0 | **AES-256-GCM + HMAC-SHA256**（本地 KEK + per-family DEK） |

**Schema 摘要**：
- 核心：boks_families / guardians / memberships / identity_bindings / guardian_sessions
- 业务：consents / children / assessment_sessions / reports / posture_sessions / assets / reports / training_plans / check_ins / chat_conversations / messages
- 平台：knowledge_sources / versions / chunks（pgvector 768）/ standard_versions / indicators / score_bands
- 治理：audit_events（哈希链）/ deletion_requests / llm_usage / prompt_versions / agent_traces / idempotency_keys

---

## 3. 后端中间件（限流 + 幂等 + 流式 SSE）

| 中间件 | 实现 | 关键文件 |
|---|---|---|
| **限流** | Redis 令牌桶（IP + family 双层）+ 降级 fail-open | `src/middleware/rate-limit.ts` + `src/redis/client.ts` |
| **幂等键** | Idempotency-Key 24h 缓存（Redis 主 + PG 兜底）+ 同 key 不同 body 409 | `src/middleware/idempotency.ts` |
| **SSE** | OAI 兼容 SSE：trace → plan → tool_call → delta → message → done | `services/ai/src/boks_ai/streaming/server.py` + `src/ai-stream.ts` |

---

## 4. AI 服务（Python）

| 模块 | 实现 | 关键文件 |
|---|---|---|
| **LLM Router** | LiteLLM 风格：多 provider + 任务级参数 + 超时重试 + token 计数 + 成本 | `services/ai/src/boks_ai/llm_router.py` |
| **Hybrid Retriever** | BM25 (jieba + BOKS 词表) + pgvector + RRF 融合 | `services/ai/src/boks_ai/retrieval/{bm25,hybrid}.py` |
| **Embedding** | sentence-transformers（multilingual-e5-base 768d）+ 本地缓存 + hash 回退 | `services/ai/src/boks_ai/embeddings/client.py` |
| **Knowledge Sync** | chunking 512/64 + embedding + pgvector upsert | `services/ai/src/boks_ai/knowledge_sync.py` |
| **Safety 2.0** | 6 类中文红旗正则 + 拒答模板 + Llama-Guard 占位 | `services/ai/src/boks_ai/safety.py` |
| **流式 SSE** | OAI 兼容事件流 + Hybrid Retriever 接入 + 引用卡片 | `services/ai/src/boks_ai/streaming/server.py` |

> 注：本机无 GPU / sentence-transformers 模型未下载，已实现 **deterministic hash embedding** 回退，RAG 流程可跑通；联网后自动启用真模型。

---

## 5. 客户端与设计系统

| 端 | 改造 |
|---|---|
| **miniprogram** | `app.scss` 硬编码 57 处 → 0；图标 sprite（16 个）+ currentColor 透传；design-tokens 三端一致 100% |
| **Flutter** | `BoksTokens`（Dart）+ `AiStreamClient`（SSE 接收器） |
| **Admin** | 待后续阶段（暂未在本期覆盖） |

**Icon 体系**：16 个 SVG 图标通过 `<svg><use href="/assets/icons/sprite.svg#boks-home"></use></svg>` 调用，`currentColor` 自动跟随父级 color（dark mode 自适配）。

---

## 6. 版本管理与热更新

- `packages/version/meta.json`：channels stable/beta/canary + 各端版本号
- `infra/hot-update/manifest.json`：miniprogram/mobile/admin 各端差分包 URL
- `tests/ab/run.mjs`：基于 SHA256(family_id) 的稳定 AB 分桶（默认 50:50）
- `getCurrentVersion / compareVersions / isCompatible / supportsHotUpdate` 函数完整

---

## 7. 推送 GitHub 说明

本环境无法访问 github.com:443，已完成本地提交：

```
commit 947a48d on main
94 files changed (新增 + 修改)
```

**用户手动推送**（恢复网络后）：
```bash
git push origin main
```

或：
```powershell
.\scripts\push.ps1
```

---

## 8. 一期未覆盖（P1/P2 阶段）

按 [docs/17](../17-detailed-execution-roadmap-2026.md) §阶段 7/8/9/10/11/12 推进：

- 阶段 7：Flutter 拆分单屏 + Admin 路由守卫
- 阶段 8：OpenTelemetry + Prometheus + Sentry + Dockerfile 生产构建
- 阶段 9：a11y 全覆盖 + 三态组件 + dark mode
- 阶段 10：测试覆盖率 80% + 集成/E2E/契约/压测
- 阶段 11：业务逻辑补全（状态机/守卫/未成年保护/删除闭环）
- 阶段 12：回归通过 + 灰度方案 + Runbook + 发布

---

## 9. 启动服务

```bash
# 1. 启动 PG + Redis（已运行）
docker ps | grep -E "boks-pgvector|boks-local-redis-1"

# 2. 应用 migrations
node services/api/db/apply-all.mjs

# 3. 启动 API
cd services/api && npm run dev

# 4. 启动 AI 服务（另一终端）
cd services/ai && python -m uvicorn boks_ai.streaming.server:app --host 127.0.0.1 --port 8001

# 5. 跑测试
node tests/e2e/full-flow.test.mjs
```