# BOKS 增量深化总结与文档导航（增量深化 #5）

> **配套文档**：`docs/16` + `docs/17` + `docs/18/19/20/21`
> **审查基线**：2026-08-02（Asia/Shanghai）
> **目的**：把本次 4 份增量深化与既有 16/17 审计 + 执行方案对齐，给出总览、依赖矩阵、决策项与版本控制

---

## 目录

- [0. 文档家族与本次新增](#0-文档家族与本次新增)
- [1. 与 16/17 的关系（不重复、不冲突）](#1-与-1617-的关系不重复不冲突)
- [2. 4 份增量深化的依赖矩阵](#2-4-份增量深化的依赖矩阵)
- [3. 全项目待办决策项](#3-全项目待办决策项)
- [4. 时间线与里程碑汇总](#4-时间线与里程碑汇总)
- [5. 资源汇总（人力/工具/预算）](#5-资源汇总人力工具预算)
- [6. 验收与停止条件汇总](#6-验收与停止条件汇总)
- [7. 文档版本与变更日志](#7-文档版本与变更日志)

---

## 0. 文档家族与本次新增

```
docs/
├── 01-product-requirements.md       产品需求（既有）
├── 02-feature-specification.md      功能规格（既有）
├── 03-authoritative-research.md     权威研究（既有）
├── 04-technical-architecture.md     技术架构（既有）
├── 05-miniprogram-development.md    小程序开发（既有）
├── 06-mobile-app-development.md     App 开发（既有）
├── 07-ui-design.md                  UI 设计（既有）
├── 08-database-design.md            数据库设计（既有）
├── 09-api-contract.md               API 契约（既有）
├── 10-ai-and-analysis.md            AI 与分析（既有）
├── 11-security-privacy-compliance.md 安全合规（既有）
├── 12-test-release-operations.md    测试发布运维（既有）
├── 13-production-gap-and-remediation-plan.md  差距与修复（既有）
├── 14-market-standard-audit.md      基线审计（既有）
├── 15-execution-plan.md             基线执行（既有）
├── 16-comprehensive-market-standard-audit-2026.md  综合审计（既有 58KB）
├── 17-detailed-execution-roadmap-2026.md  详细执行方案（既有 38KB）
├── 18-ai-agent-deep-dive.md         ★ 新增：AI Agent 深度
├── 19-domain-data-assets.md         ★ 新增：专业领域数据资产
├── 20-design-motion-icons-system.md ★ 新增：设计/动效/图标资产化
├── 21-database-migrations-rls-encryption.md ★ 新增：数据库迁移/RLS/加密
└── 22-incremental-roadmap-addendum.md ★ 本文件
```

**总字数增量**：约 130 KB（4 份新文档 + 1 份总结）。

---

## 1. 与 16/17 的关系（不重复、不冲突）

### 1.1 内容分工

| 维度 | 16/17 已覆盖 | 本次增量深化 |
|---|---|---|
| AI 大方向 | §2 简述 7 维度 | **18 §2-13 全展开**（LiteLLM Router / Prompt Registry / Hybrid Retriever / LangGraph Agent / Tool Registry / Safety 2.0 / 流式 SSE / 评估集） |
| 专业数据 | §3 提"标准规则表存在但 demo_pending_review" | **19 §2-9 全展开**（小学/初中/高中评分表 JSON 化 / 幼儿参考 / 体态 9 大类 30 子类 / 训练动作 120 个 / 知识库元数据 / 来源注册表） |
| 设计系统 | §1 简述 8 维度 | **20 §1-11 全展开**（Style Dictionary SoT / 57 处硬编码整改 / 图标 sprite / 微交互 / Lottie / dark mode / a11y） |
| 数据库 | §3 + §4 提"无 RLS、无迁移版本表、无加密" | **21 §1-10 全展开**（38 个领域 migration / RLS 12 表 / 信封加密 / 备份 PITR / 哈希链审计） |

### 1.2 不冲突承诺

- 16/17 的所有 P0/P1/P2 编号与验收指标在本次增量中**保持引用但未覆盖**。
- 新任务使用 `[NEW]` 前缀标注。
- 阶段编号（如阶段 4、6、9、11）**复用 17 的编号**，增量任务挂载到对应阶段末尾。

---

## 2. 4 份增量深化的依赖矩阵

```
                       18 AI Agent       19 Domain Data    20 Design    21 DB
                       ─────────         ──────────────    ────────     ────
   18 AI Agent         —                 强（消费数据）    无           中（读 PG）
   19 Domain Data      中（写 KB/标）    —                无           强（写 PG）
   20 Design           弱（消费 UI）      弱（UI 渲染）    —            无
   21 DB               中（持久化 trace）中（持久化数据）  无           —
```

**关键路径**：
1. **DB（21）→ Data（19）→ AI（18）**：数据库先迁移好，领域数据再导入，AI 才能消费。
2. **Design（20）**与三者弱相关，可并行；但 Lottie 资产依赖 §19 中的动作库（动画示范）。
3. **DB 是所有任务的前置**（包括 RLS 落地、AI trace 持久化、设计系统产物落库）。

### 2.1 跨文档引用速查

| 引用源 | 引用目标 | 用途 |
|---|---|---|
| 18 §4 | 19 §6（boks_knowledge_chunks） | HybridRetriever 数据源 |
| 18 §6 | 19 §5（actions.json） | 训练查询 tool |
| 18 §6 | 19 §4（observation_taxonomy） | 体态 tool |
| 18 §9 | 21 §7（boks_audit_events） | AI trace 落库 |
| 18 §3 | 21 §9（migration 0130_prompt_versions） | Prompt Registry |
| 19 §9.3 | 18 §6（posture_query tool） | 体态报告渲染 |
| 20 §2 | 21 §9（migration 引用风格统一） | — |
| 21 §7 | 18 §9（boks_llm_usage） | AI 用量审计 |
| 21 §3 | 19 §6（knowledge_chunks RLS） | RLS 跨表 |

---

## 3. 全项目待办决策项

> 用户在执行前需要决策的开放问题，按"立即 / 阶段中 / 阶段末"分级。

### 3.1 立即决策（启动前）

| # | 决策项 | 选项 | 推荐 | 阻塞 |
|---|---|---|---|---|
| D-01 | LLM Provider 主选 | (a) DeepSeek 单家 (b) DeepSeek 主 + MiniMax 备 (c) LiteLLM Router + 多家 + 自托管备 | (c) | 否 |
| D-02 | 向量数据库 | (a) pgvector (b) Qdrant (c) Milvus | (a) | 否 |
| D-03 | Agent 框架 | (a) LangGraph (b) LlamaIndex Workflows (c) 自研 | (a) | 否 |
| D-04 | KMS 来源 | (a) HashiCorp Vault 自建 (b) 阿里云 KMS (c) 腾讯云 KMS | 依云厂商 (b/c) | 是（需采购） |
| D-05 | 图标资源 | (a) Lucide 全量 (b) 自绘 30 + Lucide 补 (c) Phosphor Icons | (b) | 否 |
| D-06 | Lottie 来源 | (a) LottieFiles 商业订阅 (b) Fiverr 自购 (c) 设计师原创 | (a) + (c) | 部分 |
| D-07 | 备份存储 | (a) 阿里云 OSS (b) AWS S3 (c) 自建 MinIO | 依云厂商 | 否 |
| D-08 | 评估集标注方式 | (a) 内部标注 (b) 外包 (c) GPT-4 半自动 + 人工核 | (c) | 否 |

### 3.2 阶段中决策（W2-W6）

| # | 决策项 | 时机 |
|---|---|---|
| D-09 | 12 周阶段模板是否区分性别 | W5 |
| D-10 | 体态模型自研 vs 第三方（如旷视、商汤） | W3（与法务+采购并行） |
| D-11 | Prompt 模板由 AI 工程师还是产品撰写 | W1 |
| D-12 | dark mode 默认档位（跟随 vs 手动） | W8 |
| D-13 | 字体子集化打包策略 | W8 |
| D-14 | 训练动作是否包含视频示范 | W5 |

### 3.3 阶段末决策（W12+）

| # | 决策项 | 时机 |
|---|---|---|
| D-15 | 是否启动 P1 多端同步 | W12 后 |
| D-16 | 是否启动 P1 设备端姿态推理 | W12 后 |
| D-17 | 第三方机构版（B2B）是否启动 | W16 后 |
| D-18 | 海外市场（GDPR-K）是否启动 | W20 后 |

---

## 4. 时间线与里程碑汇总

### 4.1 全周期（参考 17 + 本次增量）

```
W0          W2          W4          W6          W8          W10         W12         W14         W16         W20+
│ 阶段0 门禁 │ 阶段1 合规 │ 阶段2 DB  │ 阶段3 限流 │ 阶段4 AI  │ 阶段4 续   │ 阶段5 体态 │ 阶段6 设计 │ 阶段7-9    │ P1 冲刺
│            │            │ +迁移     │ +幂等      │ +Agent    │            │            │            │            │
├───────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ ★DB-01    │ ★DB-02     │ ★DB-03    │ ★AI-01     │ ★AI-04     │ ★AI-06     │ ★DES-04    │ ★DES-08    │ P1*        │ P2*
│ (角色)    │ (RLS 全表) │ (字段加密) │ (LiteLLM)  │ (Agent图)  │ (流式 SSE) │ (图标字库) │ (a11y/dark)│            │
│            │            │ ★DATA-01  │ ★AI-02     │ ★AI-05     │ ★AI-07     │ ★DES-05    │ ★DES-09    │            │
│            │            │ (评分表)  │ (Prompt)   │ (Tool库)   │ (缓存)     │ (组件 12+) │ (字号缩放)  │            │
│            │            │            │ ★AI-03     │            │ ★DATA-04   │ ★DES-06    │            │            │
│            │            │            │ (HybridRet)│            │ (动作库)   │ (Lottie)   │            │            │
│            │            │            │            │            │ ★DATA-05   │ ★DES-07    │            │            │
│            │            │            │            │            │ (体态模板) │ (三态组件) │            │            │
```

### 4.2 关键里程碑

| 里程碑 | 时间 | 验收 |
|---|---|---|
| M0 — 门禁冻结 | W0 末 | 看板 + 隐私政策草稿 + baseline 快照 |
| M1 — 安全合规上线 | W2 末 | 限流 + 微信登录 + IDOR 测试 |
| M2 — DB RLS 全表 + 字段加密 | W4 末 | 跨家庭隔离 100%；明文 0 命中 |
| M3 — 评分表小学/初中/高中全量上线 | W5 末 | demo_pending_review → approved |
| M4 — AI Agent 上线 | W8 末 | Recall@6 ≥ 0.85；红队漏拦 ≤ 2% |
| M5 — 设计系统 + 组件库 | W10 末 | 硬编码 rgba = 0；基础组件 ≥ 12 |
| M6 — 体态观察模板 | W11 末 | 报告可生成 + 审计可追溯 |
| M7 — Flutter 真 Tab + Admin 路由 | W12 末 | Tab 状态保留 100% |
| M8 — a11y + dark mode + 字号缩放 | W14 末 | 三态覆盖率 ≥ 95%；a11y 100% |
| M9 — 上线闭环 | W15 末 | 灰度 + 回滚预案 + Runbook |

---

## 5. 资源汇总（人力/工具/预算）

### 5.1 人力（参考 17 + 本次增量）

| 角色 | 人数 | 周期 | 阶段 |
|---|---|---|---|
| 产品/法务 | 1 | 全程 | 0-12 |
| 设计/UX | 1 | 8 周 | 6, 9 |
| 前端组长（Flutter/小程序） | 1 | 全程 | 4-12 |
| Flutter 工程师 | 1 | 8 周 | 7-12 |
| 小程序工程师 | 1 | 6 周 | 6, 9 |
| Admin/Web 工程师 | 1 | 6 周 | 7-9 |
| 后端组长（NestJS） | 1 | 全程 | 0-12 |
| 后端工程师（DB + 加密） | 1 | 5 周 | 2 |
| AI 工程师（LLM/RAG/Agent） | 2 | 5 周 | 4 |
| AI 工程师（Safety + 红队） | 1 | 3 周 | 4, 12 |
| 数据工程师 | 1 | 7 周 | 11 |
| 审核员（双审） | 2 | 全程 | 11 |
| QA | 1 | 4 周 | 9, 12 |
| DBA 顾问 | 0.2（外协） | 1 周 | 2 |

**高峰**：W4-W8 共 8-10 人并行。

### 5.2 工具订阅（季度）

| 工具 | 用途 | 估算/月 |
|---|---|---|
| DeepSeek API | LLM 主 | $300-1500 |
| MiniMax API | LLM 备 | $200-800 |
| BGE-M3 自托管 GPU | Embedding | $500-1500 |
| BGE-reranker-large | Rerank | $300-800 |
| Llama-Guard-3 | Safety | $200-600 |
| LiteLLM / Portkey | Router | $100-300 |
| Vault（自建） | KMS | $0 |
| LangGraph Cloud 或自建 | Agent | $0-500 |
| Sentry | 监控 | $0-300 |
| Grafana Cloud | 看板 | $0-300 |
| LottieFiles 订阅 | 动画资源 | $30/月 |
| Lucide 商用 | 图标 | $0（MIT） |
| 阿里云 OSS / AWS S3 | 备份 | $50-200 |
| 阿里云 KMS 或 AWS KMS | 密钥 | $5-50 |
| **合计** | | **$1.7k - $6k/月** |

### 5.3 数据采购

| 来源 | 类型 | 估算 |
|---|---|---|
| 教育部评分表 PDF | 官方文件 | $0（公开） |
| 国家体育总局《国民体质测定》 | 官方文件 | $0（公开） |
| WS/T 423-2022 / GB/T 16133 | 标准 | 部分付费 |
| LottieFiles 商业模板 | 动画 | $100-500 一次性 |
| 训练动作视频示范 | 原创拍摄 | $3k-10k 一次性 |
| 体态拍摄示范图 | 原创拍摄 | $1k-3k 一次性 |

---

## 6. 验收与停止条件汇总

### 6.1 P0 上线门槛（每个阶段）

```
W2: 限流 + 微信登录 + IDOR 测试通过
W4: RLS 跨家庭隔离 100%；明文 0 命中；备份恢复演练通过
W5: 评分表小学/初中/高中全量上线（status=approved）
W8: AI Agent Recall@6 ≥ 0.85；红队漏拦 ≤ 2%；流式 SSE P95 ≤ 4s
W10: 硬编码 rgba = 0；基础组件 ≥ 12；Lottie ≥ 15
W11: 体态报告模板可生成；审计可追溯
W12: Flutter 真 Tab + Admin 路由；a11y 覆盖率 100%
W14: dark mode + 字号缩放；Storybook 三端组件 ≥ 90%
W15: 灰度 + 回滚 + Runbook
```

### 6.2 全局停止条件（任一触发即不通过）

1. **任何一类红旗漏拦率 > 2%**（18 §13.2）
2. **引用准确率 < 90%**（18 §13.2）
3. **多步任务完成率 < 75%**（18 §13.2）
4. **P95 延迟 > 4s 持续 24h**（18 §13.2）
5. **单 family 日 token > 100k**（18 §13.2）
6. **红队 100 题中 ≥ 3 题出现不当答复**（18 §13.2）
7. **跨家庭数据泄漏 1 例**（21）
8. **明文字段出现 1 例**（21）
9. **备份恢复演练失败**（21）
10. **a11y 关键路径缺失 1 处**（20）

---

## 7. 文档版本与变更日志

### 7.1 文档版本表

| 文档 | 版本 | 日期 | 状态 | 字数 |
|---|---|---|---|---|
| 14-market-standard-audit.md | v1 | 2026-08-02 | 基线 | ~5k |
| 15-execution-plan.md | v1 | 2026-08-02 | 基线 | ~4k |
| 16-comprehensive-market-standard-audit-2026.md | v2 | 2026-08-02 | 强化版 | ~58k |
| 17-detailed-execution-roadmap-2026.md | v2 | 2026-08-02 | 强化版 | ~38k |
| 18-ai-agent-deep-dive.md | v1 | 2026-08-02 | **新增** | ~30k |
| 19-domain-data-assets.md | v1 | 2026-08-02 | **新增** | ~28k |
| 20-design-motion-icons-system.md | v1 | 2026-08-02 | **新增** | ~30k |
| 21-database-migrations-rls-encryption.md | v1 | 2026-08-02 | **新增** | ~28k |
| 22-incremental-roadmap-addendum.md | v1 | 2026-08-02 | **新增（本文件）** | ~10k |

### 7.2 增量变更日志

```
2026-08-02 (Asia/Shanghai)
  [ADD] docs/18-ai-agent-deep-dive.md
        - 替换 services/ai/src/boks_ai/{main,llm,rag,safety,models}.py 的 if-else 实现
        - 引入 LiteLLM Router + Prompt Registry + LangGraph + Tool Registry
        - Safety 2.0 三层防御 + 输出校验
        - 流式 SSE + 取消 + 评估集 + 红队
  [ADD] docs/19-domain-data-assets.md
        - 小学/初中/高中评分表 JSON 化（替代 TS 字面量）
        - 幼儿参考（不进总分）
        - 体态 9 大类 30 子类 + 红旗库 + 视角规范
        - 训练动作 120 + 禁忌矩阵 + 12 周模板
        - 知识库元数据 + 来源注册表
  [ADD] docs/20-design-motion-icons-system.md
        - packages/design-tokens（Style Dictionary）
        - app.scss 57 处硬编码 → token
        - 图标 sprite + currentColor 透传
        - 微交互 + Lottie ≥ 15 个
        - dark mode + a11y 全端贯通
  [ADD] docs/21-database-migrations-rls-encryption.md
        - 38 个领域 migration（替代 1 个文件）
        - RLS 12 表 + 强制策略
        - 信封加密 + KMS + 字段级加密
        - 备份恢复 PITR + 哈希链审计
  [ADD] docs/22-incremental-roadmap-addendum.md
        - 本文件：4 份增量总结 + 决策项 + 时间线 + 资源
```

### 7.3 维护约定

- 任何阶段完成必须更新 16/17/18-22 的"状态"列。
- 新增发现的问题使用 `[ISSUE-YYYYMMDD-NN]` 编号纳入 16 的 §6 缺陷矩阵。
- 文档变更必须走 PR 流程，至少 1 名审阅者（不能是作者）。

---

## 附录 A：所有文件清单

| 路径 | 作用 | 来自 |
|---|---|---|
| `docs/16-comprehensive-market-standard-audit-2026.md` | 综合审计 | 既有 |
| `docs/17-detailed-execution-roadmap-2026.md` | 执行方案 | 既有 |
| `docs/18-ai-agent-deep-dive.md` | AI Agent 深化 | 新增 |
| `docs/19-domain-data-assets.md` | 专业数据深化 | 新增 |
| `docs/20-design-motion-icons-system.md` | 设计/动效/图标深化 | 新增 |
| `docs/21-database-migrations-rls-encryption.md` | DB/RLS/加密深化 | 新增 |
| `docs/22-incremental-roadmap-addendum.md` | 增量总结（本文件） | 新增 |

**总计**：2 份既有（96k）+ 5 份新增（126k） = 222 KB 设计文档。

---

## 附录 B：阶段 → 任务 → 文档 三方映射

```
阶段 0（W0）   16 §0, 17 §阶段0   →   docs/22 §4.1 M0
阶段 1（W1-2） 16 §4, 17 §阶段1   →   docs/22 §3.1, §4.1 M1
阶段 2（W3-4） 16 §3, 17 §阶段2   →   docs/21 §1-10 (重点), §22 §4.1 M2
阶段 3（W5-6） 16 §4, 17 §阶段3   →   docs/21 §4 幂等键
阶段 4（W7-9） 16 §2, 17 §阶段4   →   docs/18 §1-13 (重点), §22 §4.1 M4
阶段 5（W10-11）16 §2, 17 §阶段5  →   docs/19 §4-5 + docs/18 §8
阶段 6（W12-13）16 §1, 17 §阶段6  →   docs/20 §1-11 (重点), §22 §4.1 M5
阶段 7（W13-14）16 §1, 17 §阶段7  →   docs/20 §10 (Flutter 拆分)
阶段 8（W14-15）16 §5, 17 §阶段8  →   docs/22 §3.1 + 既有 17
阶段 9（W15-16）16 §1, 17 §阶段9  →   docs/20 §7-9 (a11y/dark), §22 §4.1 M8
阶段 10（W16-17）16 §5, 17 §阶段10 →   既有 17 + §22 §6
阶段 11（W17-19）16 §3, 17 §阶段11 →   docs/19 §1-9 (重点), §22 §4.1 M3
阶段 12（W19-20）16 §6, 17 §阶段12 →   既有 17 + §22 §6
```

---

> **本系列文档到此结束。** 任何后续发现请通过 PR 流程更新本文件（`docs/22`）与对应专项文档（`docs/18-21`）。