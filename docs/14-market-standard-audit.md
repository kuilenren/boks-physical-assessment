# 14 市场成熟标准对照审计报告

> **文档状态：**可执行
> **审计基线：**2026-08-02（Asia/Shanghai）
> **审计对象：**`apps/miniprogram`、`apps/mobile`、`apps/admin`、`services/api`、`services/ai`、`packages/contracts`、`infra` 当前代码与文档
> **对照基准：**微信/App 市场成熟产品的通用能力基线（信息架构、登录会话、状态管理、网络健壮性、数据一致性、设计系统、动效、无障碍、埋点、异常监控、合规、运维）与本仓库 `docs/01—13` 定义的自有交付标准
> **总体判定：**文档与架构设计成熟度高，代码为"可演示级 MVP 闭环"；对照市场成熟产品标准，**尚不具备正式对外上线的工程质量**。差距集中在：真实身份与权限、数据层一致性、专业数据、真实 AI、后台 UI、客户端工程化与运维放行。

---

## 1. 审计范围与方法

### 1.1 覆盖板块与判定口径

| 板块 | 覆盖内容 | 判定口径 |
| --- | --- | --- |
| 功能板块设计 | 家庭/儿童档案、体测、报告、训练、体态、咨询、隐私控制、后台 | 对比市场成熟产品的信息架构与用户旅程完整性 |
| 业务逻辑 | 状态机、评分、缺测/免测、打卡、暂停/恢复、删除级联、幂等 | 以正确性、边界、可复现为判定标准 |
| 数据库 | 表结构、索引、约束、事务、多租户、加密、删除保留、迁移 | 对照 `docs/08` 与生产级 PostgreSQL 实践 |
| API 接口 | 契约一致性、鉴权、幂等、分页、错误、限流、OpenAPI | 对照 `docs/09` 与 REST 最佳实践 |
| AI Agent | 咨询、安全拦截、RAG、ASR/TTS、多模态、体态模型 | 对照 `docs/10` 与生产 AI 服务标准 |
| 专业数据 | 体测标准原文、评分表、动作库、知识版本 | 对照 `docs/03` 权威来源要求 |
| UI 设计 | 布局、设计令牌、组件、动画、图标、无障碍、三态 | 对照 `docs/07` 与成熟产品体验基线 |
| 工程质量 | 状态管理、网络层、测试、CI、监控、安全、合规、运维 | 对照市场成熟产品工程基线 |

### 1.2 判断标准

- **具备：**代码可运行、契约完整、本地可验证。
- **部分具备：**流程打通但为占位/夹具/单一实现。
- **缺失：**能力不存在，或仅有文档/骨架。
- **阻塞：**任一存在即不得对真实用户开放。

---

## 2. 总体成熟度评估

| 维度 | 成熟度 | 一句话结论 |
| --- | --- | --- |
| 产品文档与边界 | 高 | 非诊断边界、法规清单、验收项定义完整 |
| 信息架构 | 中 | 四个 Tab 与页面闭环存在，但导航有硬伤、多处入口不可达 |
| 功能闭环 | 中 | 家庭→体测→报告→训练→体态→咨询→隐私全链路可演示 |
| 登录与身份 | 低 | 开发登录旁路仍在，无真实监护人身份体系 |
| 数据层 | 低 | JSON 为主，PostgreSQL 为"文档+关系同步"双写，非正式模型 |
| 专业数据 | 低 | 评分为 `demo_pending_review` 线性夹具，无正式评分表 |
| 体态分析 | 低 | 仅"四视角完整性"质量门禁，无真实模型与观察指标 |
| AI 咨询 | 低 | 确定性模板正则回复，无 LLM/RAG/ASR/TTS |
| 管理后台 | 缺失 | 仅 README 占位，无 UI |
| UI/动效/图标 | 中 | 设计令牌落地较好，动效、无障碍、分享、埋点缺失 |
| 工程与运维 | 低 | 无请求超时/幂等/分页、测试薄弱、无监控备份、占位域名 |

**结论：**`文档高、工程中低`。当前是可信的演示闭环，不是市场成熟产品。

---

## 3. 分维度深度差距审计

### 3.1 功能板块设计

#### 3.1.1 登录与账号（缺失/阻塞）

| 差距 | 现状 | 佐证 | 等级 |
| --- | --- | --- | --- |
| 无登录页 | 小程序与 App 启动静默拿 token，无登录/注册 UI | 小程序 `http.ts:170-181` 开发分支；`logout()` 无调用入口 | P0 |
| 开发登录旁路 | 生产关闭时回退到 `guardian-demo-001` | `services/api/src/auth.ts:207-212` | P0 |
| 无多设备/多监护人 | 单家庭单监护人模型 | `docs/13` 3.1 | P1 |
| 无手机号登录体验 | App 有 `LoginScreen` 但依赖未配置的短信 provider | `apps/mobile/lib/screens.dart:12` | P1 |

#### 3.1.2 家庭与儿童档案

| 差距 | 现状 | 佐证 |
| --- | --- | --- |
| 无编辑/停用/删除 UI | `deleteChild`、编辑接口存在但无页面入口 | 小程序 `family.ts:80` 死代码 |
| 学段/年级创建写死 | 创建儿童时写死 `school_stage: primary`、`grade_code: unassigned` | 小程序 `family.ts:39-40`；App `api_client.dart:283-284` |
| 无健康问卷 | 训练安全门缺少结构化健康信息 | `docs/13` 3.3.A |
| 导出仅剪贴板 | App 与小程序导出复制 JSON 到剪贴板，无文件/PDF | App `screens.dart:2146` |
| 多成员权限未建模 | 无父母/祖辈角色 | `docs/13` 3.3.A |

#### 3.1.3 体测录入与报告

| 差距 | 现状 | 佐证 |
| --- | --- | --- |
| 无草稿恢复 | 会话只存内存，杀进程即丢失 | 小程序 `assessment/input.tsx:81-84` |
| 客户端校验缺失 | schema 的 min/max/step 未用于前端校验 | 小程序 `assessment/input.tsx:138` |
| 无 PDF/图片分享 | 无分享能力、无海报 | 全端无分享实现 |
| 无趋势图 | 报告详情只有文本列表 | 小程序 `report/detail.tsx:127-143` |
| 报告版本锁展示弱 | 仅文本展示版本字段 | 小程序 `report/detail.tsx:120-126` |

#### 3.1.4 训练计划

| 差距 | 现状 | 佐证 |
| --- | --- | --- |
| 只显示第 1 周 | `mapPlan` 过滤 `week === 1`，4 周计划后 3 周不可见 | 小程序 `training.ts:32` |
| 打卡 day 号脆弱 | 打卡用数组下标 `index + 1`，依赖 day 连续 | 小程序 `training/detail.tsx:216-217` |
| 无日历/连续天数/提醒 | 无日历视图、无本地/订阅消息通知 | 全端无通知能力 |
| 动作内容单薄 | 3 个固定动作占位，无图示/替代/场地/停止条件标准化 | `demo-store.ts:1051-1079` |
| 无红旗强制暂停产品化 | 只有简单正则 + 状态字段 | `training.controller.ts:95-109` |

#### 3.1.5 体态观察

| 差距 | 现状 | 佐证 |
| --- | --- | --- |
| 图片不上传真实存储 | 小程序走 base64 JSON 直传（体积 +33%），未用预签名 | 小程序 `posture.ts:54-67` |
| 无真实质量门禁 | 只有尺寸/比例/文件头检查，无清晰度/遮挡/人体完整性 | `asset-storage.ts:114-140` |
| 无真实姿态模型 | 报告固定 `insufficient_data` + `low` 置信度 | `posture.controller.ts:371-399` |
| 无复测对比 | 无历史体态对比能力 | `docs/13` 3.3.D |
| 无体态报告历史入口 | `listPostureReports` 是死代码 | 小程序 `posture.ts:94` |

#### 3.1.6 咨询

| 差距 | 现状 | 佐证 |
| --- | --- | --- |
| 无会话历史续接 | 每次进入新建会话 | 小程序 `chat/index.tsx:26` |
| 非流式 | 一次请求等完整回复，无"正在输入" | 小程序 `chat.ts:16-37` |
| 无语音/多模态 | 无 ASR/TTS/图片上下文 | 全端无语音实现 |
| 无历史列表/反馈/人工升级 | 无会话管理产品 | `docs/13` 3.3.E |

#### 3.1.7 数据控制与后台

| 差距 | 现状 | 佐证 |
| --- | --- | --- |
| 撤回授权无 UI | `withdrawConsent`/`listConsents` 死代码 | 小程序 `family.ts:56-67` |
| 后台 UI 完全缺失 | `apps/admin` 仅 README | `apps/admin/README.md` |
| 无删除工单台/审核工作台 | 仅 API | `docs/13` 3.3.F |

#### 3.1.8 市场成熟产品必备能力清单

| 能力 | 小程序 | App | 等级 |
| --- | --- | --- | --- |
| 分享（onShareAppMessage/海报/PDF） | 无 | 无 | P1 |
| 订阅消息/本地通知 | 无 | 无 | P1 |
| 下拉刷新 | 无 | 无 | P2 |
| 骨架屏 | 无 | 无 | P2 |
| 埋点统计 | 无 | 无 | P1 |
| 异常上报 | 无 | 无 | P1 |
| 版本更新提示 | 无 | 无 | P2 |
| 深链/路由 | 无 | 无命名路由 | P2 |
| 安全区适配 | 无 | 系统默认 | P2 |
| 离线/弱网 | 无 | 无 | P2 |

### 3.2 业务逻辑

| 差距 | 现状 | 佐证 | 等级 |
| --- | --- | --- | --- |
| `navigateTo` 跳 Tab 页必失败 | 微信规定 `navigateTo` 不能打开 tabBar 页，但首页/报告页用 `navigateTo` 跳 `assessment/start`、`training/detail`（二者均为 tab 页） | 小程序 `home/index.tsx:278,294,357`、`report/list.tsx:102`、`report/detail.tsx:112-114`；`app.config.ts:35,41` | P0 硬伤 |
| 首页请求重复 | `useLoad` + `useDidShow` 双钩子导致首次进入发两遍请求 | 小程序 `home/index.tsx:90-95` | P1 |
| Tab 页不刷新 | 体测/训练/我的只用 `useLoad`，切回不刷新 | 小程序各 `.config.ts` | P1 |
| 重复提交竞态 | 无 `if (submitting) return` 守卫，快速双击可并发请求 | 小程序 `assessment/input.tsx:55`、`chat/index.tsx:36` 等 | P1 |
| 无幂等键 | 写接口无 `Idempotency-Key`，重复提交可能重复创建 | `http.ts:54-108`、`api_client.dart` | P1 |
| 训练打卡 day 语义脆弱 | 依赖数组下标而非真实 day | 小程序 `training/detail.tsx:216-217` | P1 |
| 体态质量未达标仍可提交 | 客户端在质量失败时仍调用 submit | 小程序 `capture.tsx:86-112` | P1 |
| 会话刷新不一致 | refresh 失败静默重登，登出未清儿童选择 | 小程序 `http.ts:150-151,206-213` | P2 |
| Flutter 假 Tab | `NavigationBar` 选中态恒为 0，tab 点击是 push 新页 | App `screens.dart:315-349` | P1 |
| 数据控制页不可达 | `DataControlScreen` 无入口引用 | App `screens.dart:2125` | P0 功能不可达 |

### 3.3 数据库设计

| 差距 | 现状 | 佐证 | 等级 |
| --- | --- | --- | --- |
| 双写模型 | 业务全部走"整 JSON 文档"，关系表只是同步投影 | `storage.ts:407-1178` | P1 |
| 无 RLS | 多租户靠应用层 ACL + 行锁，无数据库 RLS | `storage.ts:1391-1437` | P1 |
| 无加密字段 | 表结构无 `_ciphertext` 列，明文 JSONB | `storage.ts:89-323` | P1 |
| 删除无物理清理 | 软删除 + 保留策略未执行；审计不可篡改未实现 | `docs/08` 13 | P1 |
| 会话存库但重启丢失风险 | 内存 Map + 库同步，多实例不一致 | `auth.ts:49-51` | P1 |
| 无 Redis | 验证码/限流/黑名单/队列未接入 | `infra/docker-compose.yml` 有容器但代码未用 | P1 |
| 无迁移版本管理 | `CREATE TABLE IF NOT EXISTS` 直接内嵌，无迁移版本表 | `storage.ts:76-323` | P1 |
| 无备份/恢复演练 | 无任何备份脚本与 RPO/RTO | `docs/13` 3.4 | P0 |
| 缺表 | 无 `knowledge_reviews`、`knowledge_snapshots`、`ai_runs`、`messages` 独立表、`data_erasure_requests` 明细 | `storage.ts` vs `docs/08` 9-10 | P1 |

### 3.4 API 接口

| 差距 | 现状 | 佐证 | 等级 |
| --- | --- | --- | --- |
| 契约与实现路径不一致 | App 用 `/chat/conversations`、`/training/plans/{id}/check-ins`、`/children/{id}/deletion-request` 等，与 `docs/09` 不一致 | App `api_client.dart:215,206,65` vs `docs/09` | P1 |
| 无 OpenAPI 文档 | 无 swagger/openapi 生成 | `app.module.ts` 无配置 | P1 |
| 无分页 | 报告/消息/儿童一次全量 | 小程序 `assessment.ts:51-55` | P1 |
| 无限流/防爆破 | 登录/验证码接口无速率限制 | `main.ts:84-98` | P0 |
| 无 Idempotency-Key | 所有写接口缺幂等 | `docs/09` 1 | P1 |
| 生产域名占位 | 小程序/App 生产 baseURL 均为 `api.example.invalid` | 小程序 `http.ts:36`；App `api_client.dart:32` | P0 |
| 管理鉴权靠 Header token | 无管理员会话，TOTP 每请求重验 | `auth.ts:524-563` | P1 |
| 健康检查无 AI 探针 | 只有 API 自身 `/health` | `health.controller.ts` | P2 |
| 版本头不一致 | 小程序 `0.2.0` vs package 0.1.0；App 恒发 `android` | 小程序 `http.ts:72`；App `api_client.dart:60` | P2 |
| 无 SSE/WS 流式 | 咨询非流式 | `chat.controller.ts:73-156` | P1 |

### 3.5 AI Agent 板块

| 差距 | 现状 | 佐证 | 等级 |
| --- | --- | --- | --- |
| AI 服务是健康检查骨架 | `services/ai` 只有一个 `/health` | `services/ai/src/boks_ai/main.py` | P0（若宣称 AI 咨询） |
| 咨询是模板正则 | 命中关键词给固定拒答文案，否则给引导话术 | `chat.controller.ts:26,137-139` | P1 |
| 无 RAG | 无知识库检索，引用只是"已发布版本前 3 条" | `chat.controller.ts:27-44` | P1 |
| 无安全分类器 | 中文关键词正则，误杀/漏杀无测试 | `chat.controller.ts:26` | P1 |
| 无 ASR/TTS/多模态 | 全部缺失 | 全端 | P1 |
| 无模型版本/评估登记 | 无 `ai_runs`、模型注册、分层评估 | `docs/10` 10 | P1 |
| 无人工升级工单 | 无转人工流程 | `docs/13` 3.3.E | P1 |
| 体态模型缺失 | 无关键点/质量/观察指标模型 | `posture.controller.ts:371-399` | P0（若宣称体态分析） |

### 3.6 专业数据

| 差距 | 现状 | 佐证 | 等级 |
| --- | --- | --- | --- |
| 评分是线性夹具 | `demo_pending_review`，非正式查表 | `demo-store.ts:34-36,351-372,879-896` | P0 |
| 无附加分/正式分档 | 总分上限 120/附加分 20 未实现 | `docs/02` FR-201 vs `demo-store.ts:942-947` | P0 |
| 无正式原文入库 | 知识库只有 title/owner/version/content | `knowledge.controller.ts` | P0 |
| 无评分表导入工具 | 无年级×性别分档表工具 | `docs/13` 阶段 3 | P0 |
| 动作库单薄 | 3 个固定动作 | `demo-store.ts:1051-1079` | P1 |
| 幼儿规则未核验 | `reference_only` 夹具 | `demo-store.ts:315-338,390-395` | P1 |
| 无自动抓取 | 无凌晨抓取/哈希校验 | `docs/13` 3.3.F | P1 |

### 3.7 UI 布局/设计/动画/效果/图标

| 差距 | 现状 | 佐证 | 等级 |
| --- | --- | --- | --- |
| 三态不统一 | 部分页仅 toast、部分无错误态、部分无空态 | 小程序 `assessment/input.tsx` 无错误态；`chat/index.tsx:67-73` | P1 |
| 组件复用度低 | 仅 Icon/ChildPicker/PageState 三个组件 | 小程序 `components/` | P1 |
| 无统一表单/列表组件 | 无骨架屏、无公共输入组件 | `docs/07` 4 | P2 |
| 动效接近零（App） | 无 Hero/AnimatedContainer/PageRoute 转场 | App `theme.dart` | P2 |
| 硬编码未走 token | 渐变中间色、11px、font-weight 760/820 | `app.scss:79,101,180,224,458,805` | P2 |
| 图标真机风险 | SVG data-URI 在微信 `Image` 组件存在机型兼容风险 | `Icon.tsx:59-77` | P2 |
| 无暗色模式 | App 无 `darkTheme` | App `main.dart:23` | P2 |
| 无无障碍系统验收 | 无 Semantics/TextScaler 系统检查 | 全端 | P1 |
| 无动效关闭尊重 | 小程序有 reduced-motion，App 无 | `app.scss:62-73` | P2 |
| 开发痕迹外露 | "开发环境使用演示评分夹具"等文案在 UI | 小程序 `input.tsx:157`、`privacy/index.tsx:91`、App `screens.dart:938` | P0 |
| 无安全区适配 | 小程序无 `env(safe-area-inset-bottom)` | `app.scss` | P2 |

### 3.8 工程质量、安全与运维

| 差距 | 现状 | 佐证 | 等级 |
| --- | --- | --- | --- |
| 测试覆盖极低 | App 仅 1 个 widget 测试；小程序无 test；API 6 个边界测试 | `apps/mobile/test/widget_test.dart`；`production.test.ts` | P1 |
| 无日志脱敏体系 | 访问日志已脱敏，但无体系化扫描 | `main.ts:27-43` | P1 |
| 无异常上报 | 无 onError/ErrorBoundary/Sentry | 全端 | P1 |
| 无监控/告警 | 无 Prometheus/Grafana/Sentry 接入 | `docs/04` 10 | P0 |
| 无备份恢复 | 无备份脚本/演练 | `docs/13` 3.4 | P0 |
| CI 不覆盖 admin | `.github/workflows/ci.yml` 只跑 TS/小程序/Flutter/Python | `ci.yml` | P2 |
| API 无 Docker 镜像 | 无 Dockerfile/部署 job | `infra/` | P1 |
| 无密钥管理 | token 走 env，无 KMS | `runtime-config.ts` | P1 |
| 无发布门禁自动化 | 生产自检有，但无 CI 门禁检测 dev-login 字符串 | `main.ts:16-18` | P1 |
| 无 A/B/灰度 | 无环境晋升/灰度工具 | `docs/13` 3.7 | P2 |

---

## 4. 缺陷优先级总表

### P0 上线阻塞（必须完成）

1. 关闭并移除对外开发登录路径，小程序/App 接入正式登录（微信/手机号）。
2. 修复小程序 `navigateTo` 跳 Tab 页硬伤（5 处）。
3. 替换生产 API 占位域名（小程序 `http.ts:36`、App `api_client.dart:32`），配置正式 appid/服务器域名。
4. 补齐真实 PostgreSQL 模型（RLS、加密、迁移版本、Redis），完成备份/恢复演练。
5. 导入并双人审核正式体测评分表；去除 `demo_pending_review` 对外表述。
6. 体态：要么接入真实质量门禁+明确边界，要么收缩宣传（不得宣称"立体分析/风险等级"）。
7. AI 服务：接入真实受控 LLM/安全策略，或明确"咨询为流程说明"边界。
8. 数据控制页可达（App `DataControlScreen` 无入口），登录/登出 UI 落地。
9. 去除所有用户可见开发/演示文案（小程序 `input.tsx:157`、`privacy/index.tsx:91`、App `screens.dart:938`）。
10. 登录/验证码接口限流、写接口幂等键。

### P1 上线后首月

1. 管理后台 UI（知识库、标准配置、删除工单、审计）。
2. 报告 PDF/图片分享与趋势图。
3. 会话体系完善（多设备、refresh 轮转一致性、登出清理）。
4. 客户端校验、草稿自动保存、请求超时/取消/重试、分页。
5. 训练多周展示、日历、提醒、动作库增强。
6. 受控 AI 文本咨询（RAG + 安全分类 + 拒答）。
7. 埋点与异常上报。
8. 契约与实现路径统一 + OpenAPI。
9. 无障碍验收与暗色模式。

### P2 增强

1. 语音 ASR/TTS 与多模态。
2. 设备端姿态推理、动态视频。
3. 多监护人精细权限。
4. 自动抓取权威源。
5. 更完整成长档案与长期对比。

---

## 5. 关键代码证据清单（file:line）

| 问题 | 位置 |
| --- | --- |
| navigateTo 跳 Tab 页 | `apps/miniprogram/src/pages/home/index.tsx:278,294,357`；`report/list.tsx:102`；`report/detail.tsx:112-114` |
| 开发登录旁路 | `services/api/src/auth.ts:207-212`；`auth.controller.ts:97-113` |
| 生产域名占位 | `apps/miniprogram/src/services/http.ts:36`；`apps/mobile/lib/api_client.dart:32` |
| 评分线性夹具 | `services/api/src/demo-store.ts:351-372,879-896` |
| 体态无真实模型 | `services/api/src/posture.controller.ts:371-399` |
| 咨询模板正则 | `services/api/src/chat.controller.ts:26,137-139` |
| AI 服务骨架 | `services/ai/src/boks_ai/main.py` |
| 双写存储 | `services/api/src/storage.ts:407-1178` |
| 打卡 day 脆弱 | `apps/miniprogram/src/pages/training/detail.tsx:216-217`；`services/training.ts:32` |
| 数据控制页不可达 | `apps/mobile/lib/screens.dart:2125` |
| App 假 Tab | `apps/mobile/lib/screens.dart:315-349` |
| 开发文案外露 | `apps/miniprogram/src/pages/assessment/input.tsx:157`；`privacy/index.tsx:91`；`apps/mobile/lib/screens.dart:938` |
| 死代码 | 小程序 `family.ts:56-67,80`、`posture.ts:94`、`chat.ts:10`；App `api_client.dart:223,515` |
| 无幂等/超时/重试 | `apps/miniprogram/src/services/http.ts:54-108`；`apps/mobile/lib/api_client.dart:24-101` |
| 契约路径不一致 | `apps/mobile/lib/api_client.dart:65,206,215` vs `docs/09` |
| 后台仅 README | `apps/admin/README.md` |
| 无迁移版本/RLS/加密 | `services/api/src/storage.ts:76-323` |

---

## 6. 结论

对照市场成熟产品标准，BOKS 项目文档与架构设计处于"高"水平，但代码实现处于"演示级"：

1. **身份层**：无真实监护人身份，dev-login 旁路为最大上线阻塞。
2. **数据层**：JSON 双写模型 + 无 RLS/加密/备份，无法支撑真实多家庭并发。
3. **专业层**：评分夹具与占位体态报告不可对外宣称"国家标准/体态分析"。
4. **体验层**：导航硬伤、开发文案外露、三态不统一、动效与分享缺失，未达市场成熟产品水准。
5. **工程层**：无超时/幂等/分页/埋点/异常上报/监控，测试与运维薄弱。

建议按 [15-execution-plan.md](15-execution-plan.md) 分阶段落地，并在专业数据或模型未就绪时**收缩首发范围**，先交付"可信、可审核、可删除、非诊断"的正式产品，再扩展智能能力。
