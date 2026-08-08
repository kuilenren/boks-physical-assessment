# BOKS 项目落地执行方案（2026-08-02）

> **配套文档**：`docs/16-comprehensive-market-standard-audit-2026.md`（市场成熟产品标准综合审查）
> **审查基线**：2026-08-02（Asia/Shanghai）
> **执行周期**：12 周（3 个月集中冲刺）+ 8 周延伸冲刺
> **资源假设**：6-8 人小团队（含前端、后端、AI、设计、产品、法务）
> **总目标**：将 BOKS 平台从"演示级 MVP"提升到"成熟医疗 AI"水平（P0 全部解决 + P1 核心 60%）

---

## 目录

- [0. 执行总览](#0-执行总览)
- [1. 阶段 0：门禁冻结（3-5 天）](#1-阶段-0门禁冻结)
- [2. 阶段 1：核心安全合规（1 周）](#2-阶段-1核心安全合规)
- [3. 阶段 2：数据库/迁移/RLS/加密（1.5 周）](#3-阶段-2数据库迁移rls加密)
- [4. 阶段 3：写幂等 + 限流 + Redis 接入（1.5 周）](#4-阶段-3写幂等--限流--redis-接入)
- [5. 阶段 4：AI 能力重建（3 周）](#5-阶段-4ai-能力重建)
- [6. 阶段 5：体态识别骨架到 MVP（3 周）](#6-阶段-5体态识别骨架到-mvp)
- [7. 阶段 6：设计系统与组件库（2 周）](#7-阶段-6设计系统与组件库)
- [8. 阶段 7：Flutter 拆分 + 真 Tab + Admin 路由（2 周）](#8-阶段-7flutter-拆分--真-tab--admin-路由)
- [9. 阶段 8：可观测性 + Docker + CI/CD（1.5 周）](#9-阶段-8可观测性--docker--cicd)
- [10. 阶段 9：a11y + 三态 + dark mode（1.5 周）](#10-阶段-9a11y--三态--dark-mode)
- [11. 阶段 10：测试与质量门禁（持续）](#11-阶段-10测试与质量门禁)
- [12. 阶段 11：业务逻辑补全（2 周）](#12-阶段-11业务逻辑补全)
- [13. 阶段 12：发布前总检查（3 天）](#13-阶段-12发布前总检查)
- [14. 阶段 13-20：P1 延伸冲刺（8 周）](#14-阶段-13-20p1-延伸冲刺)
- [15. 风险与依赖矩阵](#15-风险与依赖矩阵)
- [16. 团队分工建议](#16-团队分工建议)

---

## 0. 执行总览

### 0.1 12 周里程碑总览

```
Week 0        Week 1        Week 2        Week 3        Week 4        Week 5        Week 6
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ 阶段0 门禁冻结  │ 阶段1 安全合规 │ 阶段2 DB迁移  │ 阶段3 限流幂等 │ 阶段4 AI重建  │ 阶段4 AI重建 │ 阶段5 体态  │
│   3-5 天    │   1 周    │   1.5 周  │   1.5 周  │   1.5 周  │   1.5 周  │   1.5 周  │

Week 7        Week 8        Week 9        Week 10       Week 11       Week 12
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ 阶段5 体态  │ 阶段6 设计系统 │ 阶段7 Flutter │ 阶段8 可观测  │ 阶段9 a11y   │ 阶段10 测试  │
│   1.5 周  │   2 周    │   2 周    │   1.5 周  │   1.5 周  │   1.5 周  │

                  Week 13-15 (后续)
                  ├────────────┼────────────┤
                  │ 阶段11 业务 │ 阶段12 发布 │
                  │   2 周    │   3 天   │
```

### 0.2 资源分配（6-8 人团队）

| 角色 | 人数 | 阶段 0-3 | 阶段 4-6 | 阶段 7-9 | 阶段 10-12 |
|---|---|---|---|---|---|
| **前端组长**（Flutter/miniprogram） | 1 | 协作（基础配置） | 协作（AI 流式 UI） | 主战（Flutter 拆分） | 主战（a11y） |
| **Flutter 工程师** | 1 | — | — | 主战 | 主战 |
| **小程序工程师** | 1 | — | 协作（前端 SSE 接入） | 主战（组件库） | 协作 |
| **Admin/Web 工程师** | 1 | 协作（基础） | 协作 | 主战（路由） | 主战（CSS 变量） |
| **后端组长**（NestJS） | 1 | 主战 | 协作 | — | 主战（可观测） |
| **后端工程师**（NestJS + DB） | 1 | 主战（RLS/迁移） | 主战（限流/幂等） | 协作 | 主战 |
| **AI 工程师**（Python） | 1 | 协作 | **主战**（4-6 周） | — | 主战（红队） |
| **设计/UX** | 1 | — | 协作（流式 UX） | 主战（设计令牌） | 主战（a11y/dark mode） |
| **产品/法务/PM** | 1 | 协作（隐私政策） | — | — | 协作（DPIA） |

### 0.3 总体目标（SLO）

| 指标 | 当前 | 阶段 9 目标 | 阶段 12 目标 |
|---|---|---|---|
| 综合成熟度评分 | 2.7/10 | 5.5/10 | 7.5/10 |
| P0 缺陷解决数 | 0/20 | 20/20 | 20/20 |
| P1 缺陷解决数 | 0/20 | 5/20 | 12/20 |
| 单元测试覆盖率 | < 30% | 60% | 80% |
| 关键接口 P95 延迟 | 未知 | < 800ms | < 500ms |
| 关键接口错误率 | 未知 | < 0.5% | < 0.1% |
| 部署自动化 | 0% | 80% | 100% |

---

## 1. 阶段 0：门禁冻结（3-5 天）

### 1.1 目标
冻结所有非紧急改动，集中精力执行 P0 任务。

### 1.2 任务清单

| # | 任务 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|
| 1 | 同步阶段 0 启动会（全员） | PM | 0.5 天 | 100% 成员知晓 |
| 2 | 冻结 main 分支（hotfix 除外） | 后端组长 | 0.1 天 | main 接受仅 hotfix |
| 3 | 创建 `feature/p0-sprint` 主分支 | 后端组长 | 0.1 天 | 分支存在 |
| 4 | 更新 `docs/16` + `docs/17` 链接到 README | PM | 0.2 天 | README 链接 OK |
| 5 | 创建 Linear/飞书项目跟踪 | PM | 0.5 天 | 看板就绪 |
| 6 | 配置 CI 增强：禁止合并到 main 的 PR 必须包含 issue 关联 | 后端组长 | 0.5 天 | PR 检查通过 |
| 7 | 法务启动隐私政策 + DPIA 评估 | PM/法务 | 1 天 | 评估启动 |
| 8 | 备份当前数据库 + 文档归档 | 后端工程师 | 0.5 天 | 备份文件 ≥ 1 |
| 9 | `apps/miniprogram/src/app.scss` 硬编码 rgba 快照（baseline） | 小程序工程师 | 0.2 天 | 快照文件保存 |
| 10 | 通讯矩阵建立（飞书/Slack/微信群） | PM | 0.1 天 | 群组活跃 |

### 1.3 风险

| 风险 | 缓解 |
|---|---|
| 团队成员对工时估计不准 | 阶段 1 末做估时校准 |
| 法务资源不可用 | 阶段 0 立即并行启动，不能阻塞 |
| 冻结 main 后客户支持 | 留 hotfix 通道 + 应急联系人 |

### 1.4 阶段 0 验收（go/no-go）

- [ ] 所有成员签署阶段目标
- [ ] 法务 DPIA 已启动
- [ ] 看板就绪
- [ ] baseline 快照保存

---

## 2. 阶段 1：核心安全合规（1 周）

### 2.1 目标
修复最紧急的安全漏洞：登录/验证码限流、dev-login 旁路、IDOR 测试、生产 baseURL。

### 2.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | 登录接口限流（5/min/IP + 10/h/account） | `services/api/src/auth.controller.ts`、`auth.ts:811-822` | 后端工程师 | 1.5 天 | ab 测试验证 6 次/min 拦截 |
| 2 | 验证码接口限流 | `auth.controller.ts:requestPhoneCode` | 后端工程师 | 1 天 | 6 次/h 拦截 |
| 3 | `dev-login` 代码移除（保留环境变量门禁） | `auth.controller.ts:97-113` | 后端组长 | 0.5 天 | 仅测试环境下有死代码 + dev-login 走 mock |
| 4 | 微信登录真实接入（`code2session` + `appid`/`secret` + `openid` 持久化） | `services/api/src/auth.ts:668-728`、`boks_auth_bindings` | 后端工程师 | 5 天 | 端到端：wx.login → server 验证 → 持久化 openid → 返回 token |
| 5 | refresh token 短时化（access 15min / refresh 30d + revoke） | `services/api/src/auth.ts:466-498` | 后端工程师 | 3 天 | 单元测试覆盖 token 过期、撤销 |
| 6 | 生产 baseURL 替换为 `https://api.boks.example.com` | `runtime-config.ts`、`config/` | 后端组长 | 0.5 天 | 默认值改 → 环境变量必填 |
| 7 | 越权矩阵自动化测试（家庭 A 访问家庭 B） | `services/api/src/idor.test.ts`（新建） | 后端工程师 | 3 天 | 100% 核心接口覆盖 |
| 8 | 启动门禁新增 `BOKS_PRODUCTION_MODE=true` 强校验 | `runtime-config.ts:36-135` | 后端组长 | 0.5 天 | 启动失败若敏感配置缺失 |

### 2.3 里程碑

- **D+5**：限流 + IDOR 测试通过
- **D+7**：微信登录端到端可用、refresh token 短时化、生产 baseURL 上线

### 2.4 SLA
- 限流 P95 检测延迟 < 10ms
- 越权测试零失败（不允许任何越权）

---

## 3. 阶段 2：数据库/迁移/RLS/加密（1.5 周）

### 3.1 目标
从"JSONB 双写演示"升级到"生产级 Postgres + RLS + 字段加密 + 迁移版本"。

### 3.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | 数据库迁移工具选型 + 接入（Prisma Migrate 或 Kysely Migrate） | `services/api/package.json`、`services/api/prisma/` 或 `migrations/` | 后端工程师 | 2 天 | `migrate up/down` 可用 |
| 2 | RLS 全表启用（`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`） | `storage.ts:80-327`、新增 `migrations/002_enable_rls.sql` | 后端工程师 | 3 天 | 100% 表启用；越权 SQL 拦截 |
| 3 | 敏感字段加密（姓名/手机号/出生日期 → `pgp_sym_encrypt`） | `boks_children.payload`、`boks_audit_events` 等 | 后端工程师 | 2 天 | 加密覆盖率 100% |
| 4 | 物化视图（报告/趋势查询提速） | 新增 `migrations/003_views.sql` | 后端工程师 | 1.5 天 | 报告查询 < 200ms |
| 5 | 备份 + WAL-G → S3 + 季度演练 | `infra/backup/walg-config.yml` | 后端工程师 | 1 天 | RPO ≤ 5min, RTO ≤ 1h |
| 6 | Flyway/Liquibase 历史版本回填 | 新建 `migrations/V001__baseline.sql` | 后端工程师 | 1 天 | baseline 可回放 |
| 7 | JSONB 字段类型化（核心表 JSONB → 实体表） | `boks_children`、`boks_assessment_sessions` | 后端工程师 | 持续 | 类型化覆盖率 ≥ 70% |

### 3.3 里程碑

- **D+5**：RLS + 字段加密上线
- **D+10**：物化视图 + 备份演练通过

### 3.4 SLA

- 越权 SQL 100% 拦截
- 加密/解密 P95 < 5ms
- 备份 RPO ≤ 5min, RTO ≤ 1h

---

## 4. 阶段 3：写幂等 + 限流 + Redis 接入（1.5 周）

### 4.1 目标
解决所有写接口幂等问题 + Redis 接入（缓存/队列/限流/分布式锁）。

### 4.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | Redis 客户端接入（`ioredis`） | `services/api/package.json` | 后端工程师 | 0.5 天 | 连接池 OK |
| 2 | 全局 `Idempotency-Key` 中间件（Redis 存储 24h） | `services/api/src/idempotency.middleware.ts`（新建） | 后端工程师 | 2 天 | 写接口幂等率 100% |
| 3 | 验证码存储迁移到 Redis（替代 JSON 双写） | `services/api/src/auth.ts:797-822` | 后端工程师 | 1 天 | 验证码 Redis 命中 ≥ 99% |
| 4 | BullMQ 异步任务队列（posture_inference, report_render, erasure, knowledge_fetch） | `services/api/src/queue.module.ts`、`queue.processor.ts` | 后端工程师 | 3 天 | 队列任务失败重试 + DLQ |
| 5 | 分布式锁（Redlock） | `services/api/src/lock.ts` | 后端工程师 | 1 天 | 跨实例互斥 100% |
| 6 | 训练打卡幂等（防止双击） | `training.controller.ts:95-108` | 后端工程师 | 0.5 天 | 双击只产生一条 |
| 7 | `x-trace-id` 注入响应 header | `services/api/src/main.ts:34-38` | 后端工程师 | 0.2 天 | 100% 响应携带 |
| 8 | `request-context` 异步本地（OpenTelemetry `ContextVar`） | `services/api/src/request-context.ts` | 后端工程师 | 0.5 天 | 跨服务 trace 100% |

### 4.3 里程碑

- **D+5**：写接口幂等 100% 覆盖 + Redis 接入
- **D+10**：BullMQ 队列 + 分布式锁上线

### 4.4 SLA

- 写幂等重复请求合并率 100%
- 队列任务失败率 < 0.1%

---

## 5. 阶段 4：AI 能力重建（3 周）

### 5.1 目标
将 `services/ai` 从 17KB 空壳升级为生产级 LLM 服务（RAG + 安全 + 多轮 + 流式）。

### 5.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | LLM Provider 抽象（BaseProvider + DeepSeek/Qwen/Minimax/Mock） | `services/ai/src/boks_ai/llm.py:17` | AI 工程师 | 3 天 | ≥ 4 个 Provider 可热切换 |
| 2 | Prompt 模板系统（YAML/DB + `prompt_id@version`） | 新建 `services/ai/src/boks_ai/prompts/` | AI 工程师 | 1 周 | ≥ 20 个模板版本化 |
| 3 | tiktoken 计数 + 上下文截断 + 历史摘要 | `services/ai/src/boks_ai/llm.py:106-114` | AI 工程师 | 2 天 | token usage 100% 携带 |
| 4 | tenacity 重试（指数退避 + jitter） | `services/ai/src/boks_ai/llm.py:87-95` | AI 工程师 | 0.5 天 | 重试成功率 ≥ 95% |
| 5 | pgvector 接入 + Embedding 服务（BGE-M3） | 新建 `services/ai/migrations/004_pgvector.sql`、`services/ai/src/boks_ai/embedding.py` | AI 工程师 | 1 周 | 向量索引建立 + 查询 < 100ms |
| 6 | 真正的 chunking（256-512 token + 10% overlap） | `services/ai/src/boks_ai/chunking.py` | AI 工程师 | 2 天 | 检索召回率 ≥ 0.80 |
| 7 | 混合检索（BM25 + pgvector + BGE-reranker-large） | `services/ai/src/boks_ai/rag.py:12-16` | AI 工程师 | 1.5 周 | 评估集 recall@10 ≥ 0.80 |
| 8 | LLM-based safety classifier（替换 6 regex） | `services/ai/src/boks_ai/safety.py:13-20` | AI 工程师 | 1.5 周 | 红队集 ≥ 500 条；准确率 ≥ 95% |
| 9 | PII 脱敏（正则 + NER 模型） | 新建 `services/ai/src/boks_ai/pii.py` | AI 工程师 | 1 周 | 姓名/手机/身份证 100% 脱敏 |
| 10 | SSE 流式（sse-starlette + NestJS `@Sse()` + 小程序 `enableChunked`） | `services/ai/src/boks_ai/main.py:90-134`、`services/api/src/chat.controller.ts:162-191` | AI 工程师 + 后端工程师 | 2 周 | 流式首字 < 800ms |
| 11 | 多轮对话上下文（`history: Message[]` schema） | `services/contracts/src/index.ts`、`services/api/src/chat.controller.ts` | AI 工程师 + 后端工程师 | 1 周 | ≥ 10 turn 上下文保持 |
| 12 | 多租户 RAG 隔离（pgvector RLS + namespace） | `services/ai/src/boks_ai/rag.py` | AI 工程师 | 3 天 | 跨家庭查询 0 命中 |
| 13 | 删除级联触发器（DB → ai_runs + audit_logs） | 新建 `migrations/005_cascade_ai.sql` | 后端工程师 | 2 天 | 删除 child → ai_runs 全清 |
| 14 | 完整审计 OLAP（ClickHouse 或 Postgres 物化视图） | 新建 `services/ai/src/boks_ai/audit.py` | AI 工程师 | 1 周 | 全维度审计字段 + 可查询 |

### 5.3 里程碑

- **D+10**：LLM 抽象 + Prompt 模板 + Embedding 上线
- **D+15**：RAG 升级 + 安全分类器
- **D+21**：SSE 流式 + 多轮对话 + 多租户隔离

### 5.4 SLA

- LLM 调用 P95 < 3s（含重试）
- 流式首字 < 800ms
- RAG 召回率 ≥ 0.80
- 安全分类器准确率 ≥ 95%（红队集）
- PII 脱敏召回率 100%

---

## 6. 阶段 5：体态识别骨架到 MVP（3 周）

### 6.1 目标
将"空架子"升级到"MVP"，至少能给出"4 视角观察有/无异常"的真实判定。

### 6.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | 解除 `risk_level: z.literal("not_scored")` schema 锁 | `packages/contracts/src/index.ts:547` | AI 工程师 + 后端工程师 | 0.5 天 | enum 改为 `not_scored|low|medium|high` |
| 2 | 集成 MediaPipe BlazePose（4 视角关键点提取） | 新建 `services/api/src/posture/keypoints.ts` | AI 工程师 | 2 周 | 关键点提取 ≥ 17 点/视角 |
| 3 | 多视角融合（三角化 + 几何规则） | `services/api/src/posture/fusion.ts` | AI 工程师 | 1 周 | 头侧偏 ±2°、脊柱偏移 ±3° |
| 4 | 体态评分（前后/左右/高低肩/骨盆倾斜） | `services/api/src/posture/score.ts` | AI 工程师 | 1 周 | 评分与人工专家相关性 ≥ 0.7 |
| 5 | `posture.controller.ts` 真实分数替换写死 | `services/api/src/posture.controller.ts:371-399` | 后端工程师 + AI 工程师 | 3 天 | 100% 数据走真实评分 |
| 6 | 体态报告可视化（4 视角图 + 雷达图） | `apps/miniprogram/src/pages/posture/result.tsx` | 小程序工程师 | 1 周 | 4 视角图清晰、雷达图交互 |
| 7 | 体态关键点模型训练数据集准备 | 新建 `services/ai/data/posture/` | AI 工程师 | 持续 | ≥ 1000 标注样本 |
| 8 | 模型注册表（model_card） | 新建 `services/api/src/model-registry/` | 后端工程师 | 3 天 | 体态模型版本化 + 回滚 |

### 6.3 里程碑

- **D+10**：关键点提取 + 多视角融合可用
- **D+18**：真实评分上线 + schema 解除
- **D+21**：前端可视化 + 模型注册表

### 6.4 SLA

- 关键点提取延迟 < 2s/视角
- 评分与人工专家相关性 ≥ 0.7
- 评分 P95 < 5s

### 6.5 注意

体态识别完整到"医疗级"需要更多数据 + 监管审批（医疗器械软件），本期目标是 **MVP（消费级体态筛查）**，不作为医疗器械。

---

## 7. 阶段 6：设计系统与组件库（2 周）

### 7.1 目标
建立 `packages/design-tokens` + Style Dictionary，三端字段一致 + 共享组件库。

### 7.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | 创建 `packages/design-tokens`（JSON SoT） | 新建 monorepo package | 设计/UX | 3 天 | 字段定义 ≥ 50 个 |
| 2 | Style Dictionary 配置 + 构建脚本（SCSS / Dart / CSS 三端输出） | `packages/design-tokens/style-dictionary.config.js` | 设计/UX + 小程序工程师 | 2 天 | 三端输出文件 OK |
| 3 | miniprogram `app.scss` 硬编码 rgba 50+ → 0 | `apps/miniprogram/src/app.scss:109/:242/:272/:279/:363/:388/:432/:516/:525/:556` | 小程序工程师 | 2 天 | 硬编码 rgba 数 50+ → 0 |
| 4 | miniprogram 提取 ≥ 12 个基础组件（BoksButton/Input/Card/Tag/Avatar/Empty/Loading/Skeleton/Modal/Toast/Tabs/Picker） | `apps/miniprogram/src/components/` | 小程序工程师 | 1 周 | 组件数 ≥ 12 + Storybook |
| 5 | Flutter `ThemeExtension<BoksPalette>` + 自定义令牌 ≥ 12 个 | `apps/mobile/lib/theme.dart` | Flutter 工程师 | 3 天 | magic number < 5 |
| 6 | Admin 扩充 CSS 变量到 ≥ 30 个 | `apps/admin/src/styles.css` | Admin 工程师 | 1 天 | CSS 变量数 ≥ 30 |
| 7 | `<CountUp>` 数字滚动组件（miniprogram + Flutter） | 新建 `components/CountUp/` | 小程序 + Flutter | 2 天 | 体测成绩场景覆盖率 100% |
| 8 | `<BoksSkeleton>` shimmer 组件 | 新建 | 小程序 + Flutter | 2 天 | 12 页面骨架覆盖 |
| 9 | 完成体测庆祝动画（Lottie 礼花 + 1.5s 渐隐） | `apps/miniprogram/src/assets/lottie/` | 小程序 + 设计 | 2 天 | 全屏 Lottie |
| 10 | Icon 组件改 `currentColor` 透传 | `apps/miniprogram/src/components/Icon.tsx` | 小程序工程师 | 0.5 天 | 主题跟随 100% |
| 11 | TabBar PNG → SVG 组件 | `apps/miniprogram/src/assets/tab/` | 设计 + 小程序 | 2 天 | 像素级清晰度 + dark mode |

### 7.3 里程碑

- **D+5**：design-tokens 上线 + 三端一致
- **D+10**：miniprogram 12 个基础组件 + Flutter/Admin 令牌
- **D+14**：动画 + 骨架 + TabBar

### 7.4 SLA

- 硬编码 rgba 数从 50+ → 0
- 三端令牌一致率 100%
- 组件复用率 ≥ 70%

---

## 8. 阶段 7：Flutter 拆分 + 真 Tab + Admin 路由（2 周）

### 8.1 目标
解决 Flutter 单文件 2825 行、Flutter 假 Tab、Admin 无路由表。

### 8.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | Flutter 引入 `go_router` | `apps/mobile/pubspec.yaml`、`apps/mobile/lib/main.dart` | Flutter 工程师 | 1 天 | go_router 配置 OK |
| 2 | Flutter 真 Tab（IndexedStack + ShellRoute） | `apps/mobile/lib/screens.dart:1119` | Flutter 工程师 | 3 天 | Tab 状态保留 100%；切换 < 100ms |
| 3 | Flutter `screens.dart` 拆分（2825 行 → 一文件一屏） | `apps/mobile/lib/screens.dart` → `apps/mobile/lib/screens/*.dart` | Flutter 工程师 | 1 周 | 单文件 < 500 行 |
| 4 | Flutter 全局 `ErrorWidget.builder` 兜底 | `apps/mobile/lib/main.dart` | Flutter 工程师 | 0.5 天 | 错误兜底率 100% |
| 5 | Flutter `flutter_animate` 全页面 enter/exit | `apps/mobile/pubspec.yaml` | Flutter 工程师 | 1 周 | 屏幕切换动效 100% |
| 6 | Admin 接入 React Router v6 + 嵌套路由 + 角色守卫 | `apps/admin/src/App.tsx`、`apps/admin/src/auth.tsx` | Admin 工程师 | 3 天 | 未登录访问受保护路由 → 100% 跳转登录 |
| 7 | Admin 提取 ≥ 8 个基础组件（DataGrid/Sidebar/EmptyState/Toast/Modal/Button/Input/Card） | `apps/admin/src/components/` | Admin 工程师 | 1 周 | 组件数 ≥ 8 |
| 8 | miniprogram 补齐 `sitemap.json` + `requiredPrivateInfos` | `apps/miniprogram/sitemap.json`、`project.config.json` | 小程序工程师 | 1 天 | 微信搜索可发现率 100% |
| 9 | miniprogram 引入 React ErrorBoundary 包裹 App | `apps/miniprogram/src/app.tsx` | 小程序工程师 | 0.5 天 | 错误捕获率 100% |

### 8.3 里程碑

- **D+7**：Flutter 真 Tab + 拆分完成
- **D+14**：Admin 路由 + Admin 组件库

### 8.4 SLA

- Tab 切换 < 100ms
- 路由跳转 < 200ms
- 单文件 < 500 行

---

## 9. 阶段 8：可观测性 + Docker + CI/CD（1.5 周）

### 9.1 目标
接入 OpenTelemetry + Prometheus + Sentry + Dockerfile + CI 增强。

### 9.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | OpenTelemetry SDK + auto-instrumentation + `OTEL_EXPORTER_OTLP` | `services/api/package.json`、`services/ai/pyproject.toml` | 后端工程师 + AI 工程师 | 3 天 | 跨服务 trace 100% |
| 2 | pino + pino-http + trace 注入 | `services/api/src/main.ts:43-51` | 后端工程师 | 1 天 | 日志 JSON 结构化 + trace 字段 |
| 3 | Prometheus `/metrics` + nestjs-prometheus + 业务 metrics | `services/api/src/main.ts` | 后端工程师 | 2 天 | HTTP P50/P95/P99 + 队列长度 |
| 4 | Sentry 接入 | `services/api/package.json` | 后端工程师 | 0.5 天 | 前后端 + Node + Python |
| 5 | API Dockerfile + 多阶段 build + 镜像签名 | `services/api/Dockerfile` | 后端工程师 | 1.5 天 | 镜像构建 < 5min |
| 6 | AI Dockerfile | `services/ai/Dockerfile` | AI 工程师 | 0.5 天 | 镜像构建 OK |
| 7 | Admin Dockerfile + nginx.conf | `apps/admin/Dockerfile` | Admin 工程师 | 0.5 天 | 镜像构建 OK |
| 8 | 数据库迁移自动化 + CI 检查 | `.github/workflows/ci.yml` | 后端工程师 | 2 天 | 合并前自动 migrate up |
| 9 | CI 增强：OpenAPI 兼容 + 镜像扫描 + 迁移演练 | `.github/workflows/ci.yml` | 后端工程师 | 2 天 | PR 检查通过 |
| 10 | graceful shutdown + trust proxy + body size limit | `services/api/src/main.ts` | 后端工程师 | 0.5 天 | SIGTERM 优雅退出 |
| 11 | Alertmanager + Grafana dashboard + PagerDuty 接入 | `infra/observability/` | 后端工程师 | 1 天 | ≥ 10 告警规则 |

### 9.3 里程碑

- **D+5**：OpenTelemetry + Prometheus + Sentry 上线
- **D+10**：Dockerfile + CI 增强
- **D+15**：监控告警 + 优雅退出

### 9.4 SLA

- 监控覆盖率 ≥ 95%
- 告警 P95 延迟 < 1min
- Trace 采样率 100%（生产可降）

---

## 10. 阶段 9：a11y + 三态 + dark mode（1.5 周）

### 10.1 目标
无障碍、Loading/Error/Empty/Skeleton 三态全覆盖、深色模式。

### 10.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | 全交互按钮/图标加 `aria-label` + miniprogram `aria-role="button"` | 全代码 | 小程序 + Flutter + Admin | 1 周 | aria-label 覆盖率 100% |
| 2 | 触控目标审计 + 不达标位置加 `min-height: 44px` | 全代码 | 小程序 + Flutter | 3 天 | 44×44 合规率 100% |
| 3 | miniprogram 12 个页面补齐 ErrorState + EmptyState | 12 个 pages | 小程序工程师 | 3 天 | 三态覆盖率 17% → 95% |
| 4 | Admin Skip to main content + 焦点可见环 | `apps/admin/src/App.tsx` | Admin 工程师 | 0.5 天 | 焦点可见率 100% |
| 5 | 颜色对比度审计 + 不达标 token 调整 | `packages/design-tokens/` | 设计/UX | 2 天 | AA 达标率 100% |
| 6 | 三端 dark mode | 三端 | 三端工程师 + 设计 | 3 天 | dark mode 覆盖率 100% |
| 7 | Flutter `MediaQuery(textScaler).clamp(1.0, 1.3)` + `Semantics` 关键节点 | `apps/mobile/lib/main.dart` | Flutter 工程师 | 1 天 | 字号缩放兼容 100% |
| 8 | `prefers-reduced-motion` Flutter/Admin 支持 | 三端 | 三端工程师 | 1 天 | 全部端 OK |

### 10.3 里程碑

- **D+5**：a11y 全覆盖 + 触控目标合规
- **D+10**：三态统一 + 焦点环
- **D+15**：dark mode + 字号缩放

### 10.4 SLA

- aria-label 覆盖率 100%
- 44×44 合规率 100%
- 三态覆盖率 ≥ 95%
- dark mode 覆盖率 100%

---

## 11. 阶段 10：测试与质量门禁（持续）

### 11.1 目标
单元测试覆盖率 ≥ 80%，集成/E2E/契约/压测全维度覆盖。

### 11.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | 核心 controller 单元测试（家庭/体测/训练/体态/咨询） | `services/api/src/*.test.ts` | 后端工程师 | 持续 | 覆盖率 ≥ 80% |
| 2 | supertest 集成测试（鉴权 + 写幂等） | `services/api/src/__tests__/integration/` | 后端工程师 | 持续 | 集成测试 ≥ 50 个 |
| 3 | 覆盖率门禁（`vitest.config.ts` thresholds） | `services/api/vitest.config.ts` | 后端工程师 | 0.5 天 | 合并前自动检查 |
| 4 | Pact 契约测试（前端/后端/AI 三角契约） | `services/contracts/pact/` | 后端工程师 | 1 周 | 契约覆盖率 100% |
| 5 | k6 压测（登录/体测提交/咨询提问） | `services/api/loadtest/` | 后端工程师 | 3 天 | 关键接口 P95 < 500ms |
| 6 | OWASP ZAP + snyk 自动化 | `.github/workflows/security.yml` | 后端工程师 | 1 周 | 阻断 P0/Critical 漏洞 |
| 7 | Detox/Maestro 小程序 E2E | `apps/miniprogram/e2e/` | 小程序工程师 | 1 周 | 核心路径覆盖 |
| 8 | Flutter integration_test | `apps/mobile/integration_test/` | Flutter 工程师 | 1 周 | 核心路径覆盖 |
| 9 | AI 模型评估（红队 + recall@10 + safety accuracy） | `services/ai/tests/evaluation/` | AI 工程师 | 持续 | recall@10 ≥ 0.80 |
| 10 | 越权矩阵测试 | `services/api/src/__tests__/security/idor.test.ts` | 后端工程师 | 持续 | 100% 核心接口 |

### 11.3 SLA

- 单元测试覆盖率 ≥ 80%
- 集成测试 ≥ 50 个
- 压测 P95 < 500ms
- 安全扫描零 Critical

---

## 12. 阶段 11：业务逻辑补全（2 周）

### 12.1 目标
补全状态机、并发锁、未成年保护、删除闭环。

### 12.2 任务清单

| # | 任务 | 文件 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|---|
| 1 | 体测状态机补全（validating/needs_review 真实流转） | `assessment.controller.ts` | 后端工程师 | 1 周 | 状态守卫 100% |
| 2 | 体态状态机真实化（已迁移到阶段 5） | — | — | — | — |
| 3 | 训练状态守卫（禁止 `completed → paused`） | `training.controller.ts:226-273` | 后端工程师 | 2 天 | 业务规则 100% 阻止 |
| 4 | 红旗扩展 regex（"走路跛行"/"关节响"） | `training.controller.ts:95-109` | 后端工程师 | 1 天 | 真实红旗覆盖率 ≥ 80% |
| 5 | `createChild` `birth_date` ≤ 今日校验 | `family.controller.ts` | 后端工程师 | 0.2 天 | 未来日期 100% 拦截 |
| 6 | 软/硬删统一（`profile_status: deleted` 物理删校验） | `family.controller.ts:225-326` | 后端工程师 | 2 天 | 删除前 100% 检查 |
| 7 | 删除证明外部锚定（公证 URL 或时间戳服务） | `family.controller.ts:269-279` | 后端工程师 | 2 天 | 锚定 100% |
| 8 | 草稿过期清理（30 天 cron） | 新建 cron job | 后端工程师 | 1 天 | 1 年前草稿清理 100% |
| 9 | 6 项分项同意枚举强制（`purpose: z.enum([...])`） | `services/api/src/consent.schema.ts` | 后端工程师 | 0.5 天 | 任意字符串 100% 拒绝 |
| 10 | KMS + 密钥轮换（90 天） | 集成云 KMS | 后端工程师 | 1 周 | 轮换自动化 |
| 11 | 对象存储删除闭环（DB 删 → S3 删） | `asset-storage.ts` | 后端工程师 | 1 周 | 100% 删除闭环 |
| 12 | 训练卡片业务规则补全（rest day / 跨周跨月） | `training.controller.ts` | 后端工程师 | 1 周 | 复杂场景 100% 覆盖 |

### 12.3 SLA

- 状态机非法转换 100% 拒绝
- 未来日期 100% 拦截
- 删除证明 100% 锚定
- 6 项分项同意 100% 强制

---

## 13. 阶段 12：发布前总检查（3 天）

### 13.1 目标
发布前的全面质量/安全/合规检查。

### 13.2 任务清单

| # | 任务 | 责任人 | 工期 | 验收指标 |
|---|---|---|---|---|
| 1 | 完整回归测试（E2E + 集成 + 单元） | 全员 | 1 天 | 100% 通过 |
| 2 | 安全扫描（OWASP ZAP + snyk + 自动化扫描） | 后端工程师 | 0.5 天 | 零 Critical/High |
| 3 | 性能压测（k6 关键接口） | 后端工程师 | 0.5 天 | P95 < 500ms |
| 4 | 灰度发布计划（10% → 50% → 100%） | 后端组长 | 0.5 天 | 灰度方案 OK |
| 5 | Rollback Runbook | 后端组长 | 0.3 天 | 5min 内回滚 |
| 6 | 应急响应 Runbook | PM/法务 | 0.3 天 | 流程清晰 |
| 7 | 用户通知 + 帮助文档 | PM | 0.5 天 | 文档上线 |
| 8 | 数据迁移演练（生产 staging 镜像） | 后端工程师 | 0.5 天 | 演练成功 |
| 9 | 监控告警验证 | 后端工程师 | 0.3 天 | ≥ 10 规则活跃 |
| 10 | 法务审定（隐私政策 + DPIA + 用户协议） | 法务 | 1 天 | 签字归档 |

### 13.3 发布决策（go/no-go）

- [ ] 所有自动化测试通过
- [ ] 零 Critical/High 安全漏洞
- [ ] 性能指标达标
- [ ] 灰度方案 + Rollback Runbook 签字
- [ ] 法务签字
- [ ] 监控告警活跃
- [ ] 备份演练通过

---

## 14. 阶段 13-20：P1 延伸冲刺（8 周）

### 14.1 延伸目标
P1 核心 12 项 / 20 项解决（占总 P1 的 60%）。

### 14.2 任务清单（按优先级）

| 阶段 | 任务 | 工期 |
|---|---|---|
| 13 | 工具调用（query_assessment / query_plan / generate_plan） | 2 周 |
| 14 | Plan-Execute 编排 + 长期记忆（LangGraph） | 3 周 |
| 15 | ASR + TTS（语音输入/输出） | 3 周 |
| 16 | 5 级降级链 + APM + 监控 + 告警增强 | 4 周 |
| 17 | 模型注册表 + 完整审计 OLAP | 2-3 周 |
| 18 | 多设备会话 + 踢出旧设备 + 会话指纹 | 2 周 |
| 19 | RBAC 引擎（OPA/Casbin） + 风控层 | 5 周 |
| 20 | DPIA + KMS + WORM 审计 + 自动化 OWASP ZAP | 10 周（部分与前序并行） |

### 14.3 阶段 21-24：领先冲刺（3-6 个月）

- 多 Agent 协同
- A/B 灰度
- 视频动作识别（跳绳/仰卧起坐自动计数）
- 训练效果预测
- 多模态 LLM（图像问答）
- 双亲/多监护人权限模型
- Storybook 三端组件文档
- HEIC 转码 + 病毒扫描 + 水印
- CDN + 边缘签名

---

## 15. 风险与依赖矩阵

| 风险 | 等级 | 缓解 |
|---|---|---|
| **法务资源不足 / DPIA 延期** | 高 | 阶段 0 立即并行启动，备选外聘律所 |
| **AI 工程师缺口** | 高 | 阶段 4 是最大单点；可临时外聘或降低目标 |
| **pgvector 性能不达标** | 中 | 备选 Qdrant（独立部署） |
| **MediaPipe 在小程序端集成困难** | 高 | 备选：端侧关键点用 TFJS Lite 或调用云 API |
| **团队估时过于乐观** | 中 | 阶段 1/4/6 末做估时校准，及时调整计划 |
| **KMS 集成涉及跨部门审批** | 中 | 阶段 11 启动前提前对齐 |
| **微信 code2session 接口限频** | 低 | 缓存 openid + 走服务端缓存 |
| **备份 RPO/RTO 不达标** | 中 | 阶段 2 末做演练，未达标调整 |
| **设计令牌迁移造成视觉回归** | 中 | 视觉回归测试 + 灰度切换 |
| **A/B 灰度导致用户体验不一致** | 低 | 仅关键路径开灰度 |

---

## 16. 团队分工建议

### 16.1 角色与 RACI

| 任务 | 负责人 R | 执行 A | 咨询 C | 知会 I |
|---|---|---|---|---|
| 阶段 0 启动 | PM | 全员 | 法务 | 全员 |
| 阶段 1 安全合规 | 后端组长 | 后端工程师 | 法务 | 全员 |
| 阶段 2 DB 迁移 | 后端组长 | 后端工程师 | DBA（如有） | 全员 |
| 阶段 3 限流/幂等 | 后端工程师 | 后端工程师 | — | 全员 |
| 阶段 4 AI 重建 | AI 工程师 | AI 工程师 | 后端组长 | 全员 |
| 阶段 5 体态识别 | AI 工程师 | AI 工程师 + 后端 | 法务 | 全员 |
| 阶段 6 设计系统 | 设计/UX | 三端工程师 | — | 全员 |
| 阶段 7 Flutter/Admin | Flutter 工程师 | Flutter + Admin | — | 全员 |
| 阶段 8 可观测性 | 后端工程师 | 后端 + AI | — | 全员 |
| 阶段 9 a11y | 设计/UX | 三端工程师 | — | 全员 |
| 阶段 10 测试 | 后端工程师 | 全员 | — | 全员 |
| 阶段 11 业务逻辑 | 后端组长 | 后端工程师 | AI | 全员 |
| 阶段 12 发布 | PM | 全员 | 法务 | 全员 |

### 16.2 沟通节奏

| 频率 | 内容 |
|---|---|
| 每日 9:30 | 站会（15min）：昨天/今天/障碍 |
| 每周一 10:00 | 周会（60min）：上周回顾/本周计划/风险 |
| 每周五 16:00 | 演示（30min）：本周成果演示 |
| 阶段切换 | 阶段回顾会（90min）：阶段验收 + 经验教训 |
| 紧急 | 飞书群即时 |

### 16.3 文档要求

| 文档 | 责任 | 时机 |
|---|---|---|
| 阶段启动公告 | PM | 每个阶段 D-1 |
| 阶段中期报告 | PM | 每个阶段 D+50% |
| 阶段验收报告 | PM | 每个阶段 D+100% |
| 缺陷记录 | 全员 | 实时 |
| Runbook | 后端 | 发布前 |
| 用户文档 | PM + 设计 | 发布前 1 周 |

---

## 附录 A：SLO/SLA 综合表

| 指标 | 当前 | 阶段 9 目标 | 阶段 12 目标 | 测量方式 |
|---|---|---|---|---|
| 综合成熟度评分 | 2.7/10 | 5.5/10 | 7.5/10 | docs/16 评分卡 |
| P0 解决数 | 0/20 | 20/20 | 20/20 | 缺陷看板 |
| P1 解决数 | 0/20 | 5/20 | 12/20 | 缺陷看板 |
| 单元测试覆盖率 | < 30% | 60% | 80% | `vitest --coverage` |
| 关键接口 P95 延迟 | 未知 | < 800ms | < 500ms | Prometheus |
| 关键接口错误率 | 未知 | < 0.5% | < 0.1% | Prometheus |
| LLM 流式首字延迟 | 同步 | < 1500ms | < 800ms | 日志/Trace |
| RAG 召回率 | N/A | ≥ 0.75 | ≥ 0.80 | 评估集 |
| 安全分类器准确率 | N/A | ≥ 90% | ≥ 95% | 红队集 |
| 越权测试通过率 | N/A | 100% | 100% | idor.test.ts |
| 三态覆盖率 | 17% | 80% | 95% | 静态扫描 |
| aria-label 覆盖率 | 0% | 80% | 100% | 静态扫描 |
| Dark mode 覆盖率 | 0% | 80% | 100% | 视觉测试 |
| 监控覆盖率 | 0% | 80% | 95% | OTel SDK |
| 告警规则数 | 0 | ≥ 5 | ≥ 10 | Grafana |
| 备份 RPO/RTO | N/A | RPO ≤ 5min, RTO ≤ 1h | RPO ≤ 5min, RTO ≤ 1h | 季度演练 |
| 部署自动化 | 0% | 80% | 100% | CI 任务 |

---

## 附录 B：交付物清单

### 阶段 0-12 关键交付物

| 阶段 | 交付物 |
|---|---|
| 0 | 看板、隐私政策草稿、baseline 快照 |
| 1 | 限流中间件、微信登录集成、IDOR 测试 |
| 2 | 迁移工具、RLS 全表、字段加密、物化视图、备份 |
| 3 | Idempotency 中间件、Redis、BullMQ、分布式锁 |
| 4 | LLM Provider 抽象、Prompt 模板、pgvector + Embedding、混合检索、Safety Classifier、PII 脱敏、SSE 流式、多轮对话 |
| 5 | 体态关键点提取、多视角融合、评分引擎、模型注册表 |
| 6 | `packages/design-tokens`、12+ 基础组件、动画、TabBar SVG |
| 7 | Flutter 真 Tab、单屏拆分、Admin 路由 |
| 8 | OpenTelemetry + Prometheus + Sentry + Dockerfile + CI |
| 9 | a11y 全覆盖 + 三态 + dark mode |
| 10 | 测试覆盖率 + 集成/E2E/契约/压测 |
| 11 | 状态机/守卫/未成年保护/删除闭环 |
| 12 | 回归通过、灰度方案、Runbook、发布 |

### 文档交付物

- ✅ `docs/14-market-standard-audit.md`（基线）
- ✅ `docs/15-execution-plan.md`（基线）
- ✅ `docs/16-comprehensive-market-standard-audit-2026.md`（强化版）
- ✅ `docs/17-detailed-execution-roadmap-2026.md`（本文件）
- 🔜 阶段 0-12 每阶段报告（每周）

---

## 附录 C：参考资料

### 市场对标产品

- **Keep**（运动健康）：体测 + 课程 + 社区 + AI 教练
- **华为运动健康**：体测 + 心率 + 血氧 + 训练计划
- **亲宝宝**（育儿）：生长曲线 + 疫苗提醒 + 亲子社区
- **平安 AskBob**：医疗 AI + 多轮咨询 + 转人工
- **医联 MedBrain**：临床辅助决策 + 真实世界数据
- **Anthropic Claude for Healthcare**：医学文献 RAG + 引用 + 安全
- **京东京医千询**、**阿里健康小鹿**、**字节豆包医疗版**

### 技术栈参考

- **LLM**：LiteLLM / Portkey / 自研 Provider Registry
- **RAG**：pgvector / Qdrant / Milvus + BGE-M3 / text-embedding-3
- **向量检索**：BM25 + pgvector + BGE-reranker-large
- **AI 编排**：LangGraph / LlamaIndex Workflows
- **Safety**：Llama-Guard-3 / Qwen2.5-Guard
- **设计系统**：Style Dictionary + Tailwind
- **可观测性**：OpenTelemetry + Prometheus + Grafana + Sentry
- **测试**：vitest + supertest + Pact + k6 + Detox/Maestro + OWASP ZAP
- **CI/CD**：GitHub Actions + ArgoCD + Argo Rollouts
- **安全**：Helmet + Throttler + helmet-csp + pino + Vault/KMS

---

> **下一步**：用户审批本方案 → 启动阶段 0 → 阶段 0 末做估时校准 → 按里程碑推进。