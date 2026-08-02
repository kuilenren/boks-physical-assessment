# BOKS 项目市场成熟产品标准综合审查（2026-08-02）

> **审查对象**：`D:\boks\bokstice`（含 `apps/{miniprogram,mobile,admin}`、`services/{api,ai}`、`packages/contracts`、`infra`、全部 `docs/`）
> **审查基线**：2026-08-02（Asia/Shanghai）
> **审查方法**：静态代码审计 + 文档对照 + 缺口定位（grep file:line + 维度差距打分）
> **对标产品**：Keep、华为运动健康、亲宝宝、宝宝树、小天才、糖猫、平安 AskBob、医联 MedBrain、丁香医生 AI、京东京医千询、阿里健康小鹿、字节豆包医疗版、Anthropic Claude for Healthcare
> **总体判定**：**当前产品处于"功能骨架已立、设计/AI/工程极度碎片化、关键 UX 与 P0 安全全维度缺失"的早中期阶段**。
>
> **综合成熟度评分（满分 10）**：
>
> | 维度 | 当前 | 成熟产品基准 | 差距 |
> |---|---|---|---|
> | UX/UI/动画/图标 | 2.5 | 8.5 | -6.0 |
> | AI 能力（RAG/Agent/多模态） | 2.0 | 8.5 | -6.5 |
> | 业务逻辑/数据库/API | 3.5 | 8.5 | -5.0 |
> | 安全/合规/法务 | 3.0 | 9.0 | -6.0 |
> | 工程/可观测/CI/CD | 2.5 | 8.5 | -6.0 |
> | **综合** | **2.7** | **8.6** | **-5.9** |
>
> **本报告与现有 `docs/14-market-standard-audit.md` 关系**：14 是首次基线；本报告（16）作为**强化版**：
> - 补齐 UX/UI/动画/图标/A11Y 8 个维度的深度审查（14 未涉及）
> - 补齐 AI Agent 7 个维度的深度审查（14 简略）
> - 业务逻辑/数据/API 增补到 10 个维度
> - 强化"代码证据 file:line"清单 + 量化验收指标
> - 三份原始材料见 `files/audit-ux-ui.md`、`files/audit-ai.md`、`files/audit-backend.md`

---

## 目录

- [0. 执行摘要：5 个最严重问题](#0-执行摘要)
- [1. UX/UI 设计系统审查](#1-uxui-设计系统审查)（含动画/图标/A11Y）
- [2. AI 能力架构审查](#2-ai-能力架构审查)
- [3. 业务逻辑/数据库/API 审查](#3-业务逻辑数据库api-审查)
- [4. 安全/合规/法务审查](#4-安全合规法务审查)
- [5. 工程实践/可观测/CI/CD 审查](#5-工程实践可观测cicd-审查)
- [6. 综合 P0/P1/P2 缺陷矩阵](#6-综合-p0p1p2-缺陷矩阵)
- [7. 量化验收指标](#7-量化验收指标)
- [8. 与 docs/14 的差异与补充](#8-与-docs14-的差异与补充)

---

## 0. 执行摘要：5 个最严重问题

1. **`services/ai` 是 17KB 的 FastAPI 空壳**：`main.py / llm.py / rag.py / safety.py / audit.py / models.py` 共 6 个文件合计 ~15KB，唯一真实端点是 `/health` 和 `/v1/classify`（6 个中文正则拦截），`/v1/chat` 在 LLM 未配置时直接退化为"我可以介绍 BOKS 体测…"的固定模板。**整个"AI 咨询"目前就是 if-else + 正则**。
2. **体态分析是空架子**：`services/api/src/posture.controller.ts:371-399` 的 `submitSession` 写死 `risk_level: "not_scored"`、`observation_status: "insufficient_data"`、`confidence: "low"`，并在 `observations` 字段里**明文标注**"四视角任务质量通过，但当前没有真实姿态模型，无法测量或确认风险"；`packages/contracts/src/index.ts:547` 用 `z.literal("not_scored")` 在 schema 层就把风险等级**永久锁死**。
3. **RAG 是字符 bigram 检索**：`services/ai/src/boks_ai/rag.py:12-16` 用归一化后的字符 bigram 集合求 Jaccard 重叠（不是 TF-IDF、不是 BM25、更不是向量检索），没有任何 embedding 模型、没有向量库、没有 reranking、没有 chunking 策略、没有评估集；命中数 = (query 与 title/content 的二元组交集)。**这和"成熟 RAG"是完全不同的物种**。
4. **后端是"演示级 MVP"**：`services/api/src/demo-store.ts` 是 JSON 双写 + 关系表 `syncRelationalTables`（`storage.ts:413-1184`），无 RLS、无字段级加密、无迁移版本表（`schema_migrations` 全仓 0 命中）、无幂等键（`Idempotency-Key` 仅在 CORS 头中允许）、登录/验证码接口**零限流**、生产 baseURL 仍是 `api.example.invalid`、OWASP Top 10 覆盖率约 30%、无 OpenAPI。
5. **UI 设计系统全面碎片化**：`apps/miniprogram/src/styles/tokens.scss`（64 行）有完整令牌，但 `apps/miniprogram/src/app.scss` 含 **50+ 处硬编码 rgba** 与 **3 处硬编码十六进制**；`apps/mobile/lib/screens.dart` **2825 行单文件**；共享组件 miniprogram 仅 3 个（`ChildPicker`/`Icon`/`PageState`）、Flutter 0 个、Admin 0 个；无 ErrorBoundary、无 Skeleton、无 a11y aria-label、dark mode 0% 覆盖、图标系统三套混用。

---

## 1. UX/UI 设计系统审查

> 详细全文：`files/audit-ux-ui.md`（UX/UI/动画/图标深度审查，~1200 行）
> 维度：①信息架构/导航 ②设计令牌 ③组件库完整度 ④三态统一 ⑤动画/微交互 ⑥图标系统 ⑦无障碍 A11Y ⑧专业领域 UX（儿童健康/体测/亲子）

### 1.1 信息架构与导航

| 维度 | 当前 | 差距 |
|---|---|---|
| Tab 模型 | miniprogram 真 Tab、Flutter `screens.dart:1119` 用 Navigator.push 假 Tab | Flutter 状态不保留 |
| 深链 | miniprogram 部分（缺 `sitemap.json` `rules`） | 微信搜索可发现率 < 50% |
| 角色路由 | Admin 无（仅 LoginPage + DashboardPage） | 无 super_admin/staff/parent 分支 |
| 多入口聚合页 | miniprogram `home/index` 仅 117 行 | 5 个核心入口未在 1 屏可达 |
| 面包屑 | 三端全无 | 长流程（体测/体态/训练）用户迷路 |

**关键代码证据**：
- `apps/miniprogram/src/services/navigation.ts:55` `TAB_PATHS` 白名单
- `apps/miniprogram/src/services/navigation.ts:82` `openRoute()` 自动判断 switchTab vs navigateTo
- `apps/miniprogram/src/pages/posture/capture.tsx:102` 使用 `redirectTo`（导致无法重拍）
- `apps/mobile/lib/screens.dart` 2825 行单文件（推断含 Navigator.push 假 Tab）

**P0**：
1. Flutter 引入 `IndexedStack` 或 `go_router` ShellRoute 实现真 Tab（Tab 状态保留率 → 100%）
2. miniprogram 补齐 `sitemap.json` + `requiredPrivateInfos`（微信搜索可发现率 → 100%）
3. Admin 接入 React Router v6 + 嵌套路由 + 角色守卫（未登录访问受保护路由 → 100% 跳转登录）

### 1.2 设计系统与设计令牌

| 维度 | 当前 | 差距 |
|---|---|---|
| 令牌文件 | miniprogram `tokens.scss` 64 行（局部完整）；Flutter `theme.dart` 175 行（用 Material 3 ColorScheme.fromSeed + 5 个 boks 颜色）；Admin `styles.css` 仅 3 个 CSS 变量 | 三端**完全无共享源** |
| Dark mode | **0% 覆盖**（miniprogram/Flutter/Admin） | 与 Keep/亲宝宝/华为 100% 差距 |
| 透明度变体 | miniprogram `app.scss` 硬编码 **50+ 处 rgba**（`:109/:242/:272/:279/:363/:388/:432/:516/:525/:556`） | 无 alpha token |
| 间距尺度 | miniprogram 8 级 OK；Flutter magic（`EdgeInsets.all(16/18/22/24/28)`、`SizedBox(width: 12/14/... height: 4/8/14)`）；Admin 无 | 跨端不一致 |
| 圆角 | miniprogram token 但未贯穿 magic；Flutter magic；Admin 无 | — |
| 字体 | 三端未定义字体家族 | 无 PingFang SC / 思源黑体等中文优化 |
| Figma 同步 | 无 Style Dictionary | 三端手工同步 |

**P0**：
1. 抽出 `packages/design-tokens`（JSON SoT），用 Style Dictionary 输出 SCSS/Dart/CSS（三端字段一致率 → 100%）
2. miniprogram 把所有 `rgba(255, 255, 255, X)` 替换为独立 alpha token（硬编码 rgba 数 50+ → 0）
3. miniprogram `app.config.ts` 颜色从 hex 改为 token 引用
4. Icon 组件改用 `currentColor` 透传（图标跟随主题色成功率 → 100%）

### 1.3 组件库完整度

| 端 | 共享组件数 | 缺口 |
|---|---|---|
| miniprogram | **3**（`ChildPicker`、`Icon`、`PageState`） | Button/Input/Card/Tag/Avatar/Modal/Toast/Skeleton/Empty/PullRefresh/Tabs/Picker/DatePicker/Stepper/Rate/Progress/Carousel/Accordion/BottomSheet/SearchBar/SegmentedControl/Timeline 全部缺失 |
| Flutter | **0** 共享（全部内联在 `screens.dart` 2825 行单文件） | Loading 在 `:160/:174/:1048/:1574` 重复 ≥ 4 处 |
| Admin | **0** 业务组件（仅 LoginPage 原生 input + button） | 无 DataGrid/Sidebar/EmptyState/Toast 等 |

**P0**：
1. 拆分 `apps/mobile/lib/screens.dart` 至 `apps/mobile/lib/screens/*.dart` 一文件一屏（单文件 < 500 行）
2. miniprogram 提取 ≥ 12 个基础组件（`BoksButton/Input/Card/Tag/Avatar/Empty/Loading/Skeleton/Modal/Toast/Tabs/Picker`）
3. 提取 `<BoksLoading/>` 统一 Flutter 加载态（Loading 内联实例 = 0）

### 1.4 三态统一（loading/empty/error/success）

| 端 | Loading | Error | Empty | Skeleton | Success 庆祝 | Retry |
|---|---|---|---|---|---|---|
| miniprogram 12 页面 | 100% | 17% | 17% | 0% | 0% | 17% |
| Flutter | 部分内联 | 0% | 0% | 0% | 0% | 0% |
| Admin | LoginPage 仅 | 0% | 0% | 0% | 0% | 0% |

**关键证据**：
- 仅 `pages/family/index.tsx:78` 和 `pages/report/list.tsx:93` 使用 `PageState`
- `apps/miniprogram/src/components/PageState.tsx:6` 暴露 `LoadingState`/`ErrorState`/`EmptyState`，但无 Skeleton、无插画
- 三端均无 React ErrorBoundary / Flutter `ErrorWidget.builder` 兜底（任何渲染错误 → 白屏或 App 崩溃）

**P0**：
1. miniprogram 增加 React ErrorBoundary 包裹 App 入口（错误捕获率 → 100%）
2. miniprogram 12 个页面全部补齐三态（ErrorState、EmptyState，从 17% → 95%）
3. Flutter 全局 `ErrorWidget.builder` 兜底（错误兜底率 → 100%）

### 1.5 动画与微交互

| 维度 | 当前 | 差距 |
|---|---|---|
| 页面转场 | miniprogram 仅 `page-enter`（`app.scss:46-:51`），Flutter 0 动画 | Keep 4-6 种、华为 4 种 |
| 微交互密度 | miniprogram 8 处 `transition:`、Flutter 0 | Keep 高/华为高/亲宝宝中 |
| 庆祝动画 | **0%** | Keep 100%/华为 90%/亲宝宝 80% |
| 数字滚动 CountUp | **0%** | Keep 100%/华为 100%/亲宝宝 80% |
| 骨架屏 shimmer | **0%** | Keep 100%/华为 100%/亲宝宝 95% |
| `prefers-reduced-motion` | miniprogram 全局兜底（`app.scss:62-:73`） | Flutter/Admin 缺 |

**Flutter 0 动画证据**：`grep -r "AnimationController\|Tween\|Hero\|AnimatedSwitcher"` 在 `apps/mobile/lib/` **0 命中**。

**P0**：
1. 实现 `<CountUp>` 数字滚动组件（体测成绩/身高体重展示，数字场景覆盖率 → 100%）
2. 实现 `<BoksSkeleton>` shimmer 动效（12 页面骨架覆盖）
3. 实现体测完成庆祝动画（全屏 Lottie 礼花 + 1.5s 渐隐）

### 1.6 图标系统

| 端 | 图标源 | 数量 | 风格统一 | Dark mode | A11y |
|---|---|---|---|---|---|
| miniprogram | `Icon.tsx` switch case | 16 | 单色硬编码 hex | ❌ | ❌ |
| miniprogram TabBar | `assets/tab/*.png` | 8 | PNG 无法矢量缩放 | ❌ | ❌ |
| Flutter | Material Icons | 1500 系统 | 偏几何 vs BOKS 圆润 | 系统级 | ❌ |
| Admin | 0 | 0 | — | — | — |

**P0**：
1. miniprogram Icon 改为 `currentColor` 透传（主题跟随 → 100%）
2. TabBar 图标改为 SVG 组件，亮/暗模式各一套

### 1.7 无障碍（A11Y）

**WCAG 2.1 AA 验收对照**：

| 维度 | 目标 | BOKS 当前 | 差距 |
|---|---|---|---|
| 文本对比度 ≥ 4.5:1 | 100% | 推测 60% | 需全面审计 token 对比度 |
| 触控目标 ≥ 44×44pt | 100% | 推测 50% | 大量 `View onClick` 未做尺寸合规 |
| 键盘可访问 | 100% | 推测 10% | Web/Admin 缺少 Tab 顺序 |
| 屏幕阅读器语义 | 100% | **0%**（grep `aria-label` 0 命中） | 几乎全无 aria-label |
| `prefers-reduced-motion` | 100% | 仅 miniprogram 全局 | Flutter/Admin 缺 |
| 字号缩放支持 | 100% | 0%（所有 token 固定） | — |
| `prefers-color-scheme` | 100% | 0%（无 dark mode） | — |

**P0**：
1. 所有交互按钮/图标加 `aria-label` + miniprogram `aria-role="button"`（覆盖率 → 100%）
2. 触控目标审计 + 不达标位置加 `min-height: 44px`（44×44 合规率 → 100%）
3. Admin 增加 Skip to main content 链接 + 焦点可见环（焦点可见率 → 100%）
4. 颜色对比度审计 + 不达标 token 调整（AA 达标率 → 100%）

### 1.8 专业领域 UX（儿童健康/体测）

| 场景 | 当前 | 应有 |
|---|---|---|
| 拍摄引导 | 推断为轮廓引导 | 真实轮廓 + 脚位线 + 10s 倒计时 + 抖动检测 |
| 数据录入 | 简单 input | 身高/体重滑杆、年龄段 chip、体态四视角同步上传 |
| 报告可视化 | 列表 + 文字 | 趋势折线图 + 雷达图 + 同龄对比柱状图 + 体态四视角大图 |
| 体态 4 视角展示 | 推断为文字列表 | 3D 旋转 + 高亮标注 + 可点击局部放大 |
| 训练计划展示 | 列表 | 多周日历 + 打卡 + 进度条 + 视频示范 |
| AI 咨询会话 | 同步等待 + 模板回复 | 流式打字机效果 + 引用卡片 + 多轮历史 + 转人工 |
| 儿童友好交互 | — | 大按钮（≥ 56pt）、可视化图标、童声语音 |

### 1.9 UX/UI 整体 P0/P1/P2 清单

| 优先级 | 任务 | 涉及文件 | 验收指标 |
|---|---|---|---|
| **P0** | Flutter 引入 `IndexedStack` + `go_router` 真 Tab | `apps/mobile/lib/main.dart`、`screens.dart` | Tab 状态保留 100%；切换 < 100ms |
| **P0** | miniprogram 补齐 `sitemap.json` | `apps/miniprogram/sitemap.json` | 微信搜索可发现率 100% |
| **P0** | Admin 接入 React Router v6 + 嵌套路由 + 角色守卫 | `apps/admin/src/App.tsx`、`auth.tsx` | 未登录访问受保护路由 → 100% 跳转登录 |
| **P0** | 抽出 `packages/design-tokens` + Style Dictionary | 新建 monorepo package | 三端字段一致率 100% |
| **P0** | miniprogram `app.scss` 硬编码 rgba 50+ → 0 | `apps/miniprogram/src/app.scss` | 硬编码 rgba 数从 50+ → 0 |
| **P0** | Icon 组件改 `currentColor` 透传 | `apps/miniprogram/src/components/Icon.tsx` | 主题跟随 100% |
| **P0** | Flutter 拆分 `screens.dart` 2825 行 → 一文件一屏 | `apps/mobile/lib/screens.dart` | 单文件 < 500 行 |
| **P0** | miniprogram 提取 ≥ 12 个基础组件 | `apps/miniprogram/src/components/` | 基础组件 ≥ 12 个 |
| **P0** | miniprogram 12 个页面补齐 ErrorState + EmptyState | 所有 pages | 三态覆盖率 17% → 95% |
| **P0** | Flutter 全局 `ErrorWidget.builder` 兜底 | `apps/mobile/lib/main.dart` | 错误兜底率 100% |
| **P0** | 实现 `<CountUp>` + `<BoksSkeleton>` + 完成庆祝动画 | 新组件 | 数字/骨架/庆祝场景覆盖率 100% |
| **P0** | TabBar PNG → SVG 组件 | `apps/miniprogram/src/assets/tab/` + 自定义 tabBar | 像素级清晰度 + dark mode |
| **P0** | 全交互按钮/图标加 `aria-label` + 44×44 触控目标 | 全代码 | aria-label 覆盖率 100%；44×44 合规率 100% |
| **P1** | Flutter `ThemeExtension<BoksPalette>` + 自定义令牌 ≥ 12 个 | `apps/mobile/lib/theme.dart` | magic number < 5 |
| **P1** | Admin 扩充 CSS 变量到 ≥ 30 个 | `apps/admin/src/styles.css` | CSS 变量数 ≥ 30 |
| **P1** | 三端 dark mode | 三端 | dark mode 覆盖率 100% |
| **P1** | miniprogram 引入 `<BoksPullRefresh>` + `<BoksInfiniteList>` | 新建 | 列表页空态/分页/刷新统一 |
| **P1** | Admin 引入 `<DataGrid/>` `<Sidebar/>` `<EmptyState/>` 等 | `apps/admin/src/components/` | Admin 组件 ≥ 8 个 |
| **P1** | Flutter 引入 `flutter_animate` 全页面 enter/exit | `apps/mobile/pubspec.yaml` | 屏幕切换动效 100% |
| **P1** | 多色品牌图标 ≥ 8 个 | `apps/miniprogram/src/assets/` | 多色图标 ≥ 8 |
| **P1** | Flutter `MediaQuery(textScaler).clamp(1.0, 1.3)` + `Semantics` 关键节点 | `apps/mobile/lib/main.dart` | 字号缩放兼容 100% |
| **P2** | Storybook 三端（miniprogram Taro Storybook、Flutter storybook_flutter、Web Storybook） | 各端 | 组件覆盖率 ≥ 90% |
| **P2** | 动画图标（Lottie）：训练完成打卡、勋章解锁 | `apps/miniprogram/src/assets/lottie/` | 关键路径动画 ≥ 5 |

---

## 2. AI 能力架构审查

> 详细全文：`files/audit-ai.md`（AI Agent 深度审查，~1100 行）
> 维度：①LLM 服务层 ②RAG 检索增强 ③安全与合规 ④AI Agent 编排 ⑤领域模型 ⑥语音与多模态 ⑦工程与运维 ⑧数据与隐私

### 2.1 LLM 服务层

| 能力 | 实现 | 文件:行 | 成熟产品形态 |
|---|---|---|---|
| Provider 抽象 | 写死 `PROVIDER_NAMES = ("deepseek", "minimax")` | `services/ai/src/boks_ai/llm.py:17, 25-27` | LiteLLM / Portkey / 自研 registry |
| 提示词工程 | 单一 `SYSTEM_PROMPT` 字符串，4 句 | `services/ai/src/boks_ai/main.py:26-30` | YAML 模板 + `prompt_id@version` |
| 上下文窗口 | 无管理，直接 `"\n".join(...)` 拼 user message；`max_tokens=800` 写死 | `services/ai/src/boks_ai/llm.py:106-114` | tiktoken 截断 + 历史摘要 |
| 超时 | `DEFAULT_TIMEOUT_SECONDS = 12.0` | `services/ai/src/boks_ai/llm.py:15, 117-122` | 30s + 渐进 |
| 取消 (cancel) | **无**（不接 AbortSignal） | `services/ai/src/boks_ai/main.py:90-134` | FastAPI asyncio.CancelledError |
| 重试 | **无**（provider fallback ≠ 同 provider 指数退避） | `services/ai/src/boks_ai/llm.py:87-95` | tenacity 指数退避 |
| 成本控制 | **无** token 计数/不回 `usage`/无配额 | `services/ai/src/boks_ai/llm.py:124` | tiktoken + 配额表 + 告警 |
| 多模型路由 | **无**（`temperature=0.2, max_tokens=800` 全局硬编码） | `services/ai/src/boks_ai/llm.py:112-114` | 按 task 路由 |
| 流式 SSE | **无**（NestJS `chat.controller.ts:162-191` 同步等完整结果） | `services/ai/src/boks_ai/main.py:90-134` | sse-starlette / Vercel AI SDK |
| Function calling | **无** | `services/ai/src/boks_ai/llm.py:106-114` | OpenAI tools / Anthropic tool_use |
| 缓存 | **无**（同问题每次重算） | — | Redis 24h TTL + 语义 hash |

**P0**：
1. 引入 LiteLLM 或自研 Provider Registry（标准化 `BaseProvider` 接口，1-2 周）
2. Prompt 模板系统（YAML/DB，按 `prompt_id@version` 检索，1 周）
3. token 计数（tiktoken）+ 上下文截断 + 历史摘要 + tenacity 重试（1 周）
4. SSE 流式（AI 服务 `sse-starlette` → NestJS `@Sse()` → 小程序 `wx.request enableChunked` / App `EventSource`，2 周）

### 2.2 RAG 检索增强

| 能力 | 实现 | 文件:行 | 成熟产品形态 |
|---|---|---|---|
| 向量数据库 | **无**（全仓 grep `qdrant\|chroma\|pinecone\|milvus\|weaviate\|pgvector` 0 命中） | — | pgvector / Qdrant / Milvus |
| Embedding 模型 | **无** | `services/ai/src/boks_ai/rag.py` | BGE-M3 / text-embedding-3 |
| 检索算法 | **字符 bigram Jaccard**（归一化后 `text[i:i+2]` 二元组集合） | `services/ai/src/boks_ai/rag.py:12-28` | BM25 + 向量 + rerank |
| 加权 | 标题 `*0.4` + 内容 `*0.6` 写死 | `services/ai/src/boks_ai/rag.py:25-28` | 学习排序 |
| 分块 (chunking) | **无**（`KnowledgeDocument.content: str` 整字段） | `services/ai/src/boks_ai/models.py:7-12` | 256-512 token + 10% overlap |
| 混合检索 | **无** | — | BM25 + 向量 + metadata 过滤 |
| 索引版本管理 | `KnowledgeVersion.version` 字段存在但 `rag.py` 不接 | `services/ai/src/boks_ai/rag.py:31-44` | 自动建索引 + 快照保留 |
| 检索质量评估 | **无**（仅 1 query 测 1 个 happy path） | `services/ai/tests/test_rag.py:14-42` | gold set + recall@5/10 + nDCG |
| 多租户隔离 | **无**（靠调用方传对 documents） | `services/ai/src/boks_ai/rag.py:31-44` | pgvector RLS / collection namespace |
| 元数据过滤 | **无** | — | `WHERE child_grade / age_band / topic` |
| Cite/Span | 有 `Citation` 字段但**无 offset/highlight/原文 chunk** | `services/ai/src/boks_ai/models.py:28-32` | 高亮 + chunk 原文 |

**P0**：
1. 引入 pgvector（已用 Postgres）作为向量库（1 周）
2. Embedding 服务：BGE-M3（开源 Chinese 强）或 text-embedding-3-small（1 周）
3. 真正的 chunking：按段/句切，256-512 token，overlap 10%（1 周）
4. 混合检索：BM25（`rank_bm25`）+ pgvector + BGE-reranker-large（1-2 周）

### 2.3 安全与合规

| 能力 | 实现 | 文件:行 | 成熟产品形态 |
|---|---|---|---|
| 输入分类器 | **6 个中文 regex**（`emergency`/`severe_weakness`/`persistent_pain`/`acute_pain`/`injury`/`diagnosis_request`） | `services/ai/src/boks_ai/safety.py:13-20`、`services/api/src/chat-safety.ts:3-42` | Llama-Guard-3 / Qwen2.5-Guard |
| 拒答模板 | 每个标签一个 `advice` + 全局 prefix/suffix | `services/ai/src/boks_ai/safety.py:27-42` | — |
| 输出审核（幻觉检测） | **无**（仅 prompt 说"不输出 Cobb 角"，无 post-hoc 校验） | `services/ai/src/boks_ai/main.py:26-30` | LLM-as-judge + 关键词 regex + 引用强校验 |
| 医疗免责声明 | 仅在拒答时附 | `services/ai/src/boks_ai/safety.py:27-32` | 每次回答固定 |
| PII 脱敏 | **无**（审计日志声明"不存原文"，但 `ChatRequest.content` 原封传 LLM） | `services/ai/src/boks_ai/audit.py:3-4` | 正则 + NER |
| 审计日志 | JSONL 文件：字段 `event_id, intent, intercepted, citation_ids, llm_used, created_at` | `services/ai/src/boks_ai/audit.py:19-25` | OLAP（ClickHouse/BigQuery） |
| 审计字段 | **无** user_id/family_id/child_id/model_id/prompt_id/tokens/latency/cost | `services/ai/src/boks_ai/models.py:45-51` | 全维度 |
| 红队测试集 | **无**（仅 happy path + 每条 regex 各 1 query） | `services/ai/tests/test_safety.py:42-48` | 500-2000 条 jailbreak 库 |
| Prompt injection 防护 | **无**（用户输入直接拼 user message） | `services/ai/src/boks_ai/main.py:99-107` | 输入清洗 + 结构化 prompt |
| 越狱防护 | **无** | — | Llama-Guard |
| 未成年人保护 | **无独立层** | — | 14 岁以下路由到"家长模式" |
| 涉政/涉暴/敏感词 | **无** | — | 阿里云/腾讯云内容安全 |
| 数据出境 | **无审计**（`BOKS_AI_LLM_BASE_URL` 可指境外域名） | `services/ai/src/boks_ai/llm.py:24-34` | 域名白名单 + DPIA |
| 举报/反馈/申诉 | **无** | — | 工单系统 |
| 转人工 | **无** | `services/api/src/training.controller.ts` 提到但无实际队列 | 工单池 + SLA |

**P0**：
1. 引入 LLM-based safety classifier（Llama-Guard-3 / Qwen2.5-Guard / 自研 BERT 6 分类）+ 替换 regex（1-2 周）
2. PII 脱敏（正则 + NER 模型识别姓名/手机号/身份证/住址/学校，2 周）
3. 红队测试集 500-2000 条（持续维护 1 周）
4. Prompt injection + 越狱防护（输入清洗 + 结构化 prompt，1 周）
5. 完整审计字段（user_id/family_id/child_id/model_id/prompt_id/tokens/latency/cost/safety_decision）+ OLAP（2 周）
6. LLM 域名白名单（仅境内）+ DPIA（0.5 周）

### 2.4 AI Agent 编排

| 能力 | 实现 | 成熟产品形态 |
|---|---|---|
| 多轮对话 | **无**（`ChatRequest` schema 无 `history`，所有 turn 互相独立） | 短期/长期记忆 |
| 工具调用 | **无** | function calling + tool registry |
| Plan-Execute | **无** | LangGraph / LlamaIndex Workflows |
| 多 Agent 协同 | **无** | 监督/平行/分层 |
| 记忆机制 | **无** | profile memory + session memory |
| 会话续接 | 无历史 | 多端同步 |

### 2.5 领域模型

| 模型 | 实现 | 评估 |
|---|---|---|
| 评分引擎 | `scoring-engine.ts` 真实查表（50m、坐位体前屈、跳绳 1min、肺活量、仰卧起坐、50×8 折返、BMI），`algorithm_version: national-2014-table-1.0` | **最成熟的部分**（5/10） |
| 体态识别 | **空架子**（`risk_level: z.literal("not_scored")` schema 锁死） | 0/10 |
| 动作识别（视频） | **无** | 0/10 |
| 训练效果预测 | **无** | 0/10 |
| 模型注册表 | **无** | 0/10 |
| 评估集 + 回归测试 | **无** | 0/10 |

### 2.6 语音与多模态

| 能力 | 实现 | 成熟产品 |
|---|---|---|
| ASR | **无** | 微信 `wx.getRecorderManager` + 讯飞/阿里 ASR |
| TTS | **无** | 微信 `wx.createInnerAudioContext` + 阿里/火山 TTS |
| 图像问答 | **无** | GPT-4o / Qwen-VL |
| 视频动作评估 | **无** | MoveNet + 几何规则 |
| 多模态融合 | **无** | LLM 同时接收 image + text + audio |

### 2.7 工程与运维

| 能力 | 实现 | 成熟产品 |
|---|---|---|
| 流式首字 < 800ms | **无** | SSE / WebSocket |
| APM | **无** | OpenTelemetry → Tempo + Prometheus + Grafana |
| 监控指标 | **无** | P50/P95/P99 latency、token 成本、安全拦截率 |
| 降级链 | **2 级**（LLM → 模板） | **5 级**（主 → 备 → 小模型 → 规则 → 模板） |
| 限流 | **无** | Redis 令牌桶 |
| A/B 灰度 | **无** | Unleash / 自研 flag |
| 应急 Runbook | **无** | Confluence / Markdown |
| 告警 | **无** | Alertmanager + PagerDuty |
| 备份 RPO/RTO | **无** | pg_dump + WAL-G → S3 |
| Token 计数 | **无** | tiktoken + cost 字段 |
| 错误码 | NestJS 端有统一错误结构 | — |
| 容器化 | **无 Dockerfile**（`services/ai/` 仅 `pyproject.toml`） | 多阶段 build |

### 2.8 数据与隐私

| 能力 | 实现 | 成熟产品 |
|---|---|---|
| 多租户 RAG 隔离 | **弱**（`rag.py` 不接 `family_id`，靠调用方传对） | collection metadata / 独立 schema |
| 被遗忘权自动执行 | **部分**（`family.controller.ts:280-302` 有 submitDeletionRequest，但**无 ai_runs/audit_logs 自动清理**） | DB + 对象 + 缓存 + 索引 + 备份标注 |
| 训练数据隔离 | **无明确声明** | — |
| 数据出境合规 | **无审计** | LLM 域名白名单 + DPIA + 跨境评估 |
| 加密字段 | **无**（pgcrypto 0 命中） | pgcrypto / 应用层 AES-GCM |
| 审计不可篡改 | **无**（JSONL 可被任意修改） | WORM + hash chain |
| 14 岁以下专项 | **无** | schema + 业务规则 |
| 双亲/多监护人 | **无** | 重新设计 ACL |
| AI 决策可解释 | **无**（无 model_card） | 用户能查看引用 + prompt + 规则 |

### 2.9 AI 综合 P0/P1/P2 清单

| 优先级 | 改造项 | 推荐技术栈 | 工期 |
|---|---|---|---|
| **P0** | LLM Provider 抽象 + Prompt 模板 + token 计数 + 重试 | LiteLLM / 自研 `boks.llm.providers` + Jinja2 + tiktoken + tenacity | 2-3 周 |
| **P0** | RAG 升级：pgvector + Embedding + chunking + 混合检索 + rerank | pgvector + BGE-M3 + langchain + BGE-reranker-large | 2-3 周 |
| **P0** | LLM-based safety classifier + PII 脱敏 + 红队集 + prompt injection 防护 | Llama-Guard-3 / Qwen2.5-Guard + NER | 3-4 周 |
| **P0** | 多轮对话上下文 + SSE 流式 + 多租户 RAG 隔离 + 删除级联 | schema 改 + sse-starlette + pgvector RLS + DB trigger | 3 周 |
| **P1** | 体态关键点模型 + 多视角融合 + 风险指标 | MediaPipe BlazePose / RTMPose + 多视角融合 | 6-8 周 |
| **P1** | 工具调用（query_assessment / query_plan / generate_plan） | OpenAI tools / Anthropic tool_use schema | 2 周 |
| **P1** | Plan-Execute 编排 + 长期记忆 | LangGraph / LlamaIndex Workflows + profile memory | 3 周 |
| **P1** | ASR（语音输入） + TTS（语音输出） | 微信 wx.getRecorderManager + 讯飞/阿里 ASR | 3 周 |
| **P1** | 5 级降级链 + APM + 监控 + 告警 + 模型注册表 | 自研 + OpenTelemetry + Prometheus + Grafana + Alertmanager | 4 周 |
| **P2** | 多 Agent 协同 + A/B 灰度 + 多模态 LLM | Unleash + GPT-4o / Qwen-VL | 4-6 周 |
| **P2** | 视频动作识别 + 训练效果预测 + 跨境合规评估 + 14 岁以下专项 | MoveNet + ML + 法务 + schema | 6-8 周 |
| **P3** | 实时视频流分析 + 3D 体态重建 + 联邦学习 | WebRTC + MediaPipe + 隐私计算 | 12+ 周 |

---

## 3. 业务逻辑/数据库/API 审查

> 详细全文：`files/audit-backend.md`（后端架构审查，~900 行）
> 维度：①IAM ②业务逻辑正确性 ③数据库设计 ④API 设计 ⑤文件与对象存储 ⑥缓存与队列 ⑦可观测性 ⑧安全合规 ⑨测试 ⑩工程实践

### 3.1 总体成熟度矩阵

| 维度 | 成熟度 | 一句话结论 |
|---|---|---|
| 1. IAM | 低 | scrypt + TOTP + 7/30 天 token 已有雏形，但 dev-login 旁路、未做设备/会话管理、缺限流与风控 |
| 2. 业务逻辑 | 中 | 状态机/红旗/边界部分实现，但幂等、并发锁、事务一致性、状态守卫缺 |
| 3. 数据库 | 低 | 文档 `docs/08` 完整；实现是 JSONB + 关系同步双写，无 RLS/加密/迁移版本 |
| 4. API 设计 | 中 | 错误模型统一、trace_id 有，但无 OpenAPI、无限流、契约路径不一致 |
| 5. 对象存储 | 中 | SigV4 预签名、MIME/大小/KMS 已落地，无生命周期策略、CDN、删除闭环 |
| 6. 缓存/队列 | 缺失 | docker-compose 有 Redis 容器，代码未接入 |
| 7. 可观测性 | 低 | 只有访问日志 + PG 探针；无 metrics、无 trace、无告警、无 Sentry |
| 8. 安全合规 | 低 | OWASP Top 10 约 30%；IDOR、密钥管理、未成年人保护字段缺失 |
| 9. 测试 | 中低 | 6 个安全边界 + 14 个知识同步/学习回路单元；无 E2E、无契约、无压测 |
| 10. 工程实践 | 低 | 启动自检强；无 Dockerfile、无 K8s、无灰度、无密钥轮换 |

### 3.2 IAM（身份与权限）

**现状**：
- `services/api/src/auth.ts:64-79` scrypt + 16 字节 salt + 64 字节派生 + `constantTimeEqual`
- TOTP（`auth.ts:139-178`）：HMAC-SHA1 + 30 秒时间窗 + Base32；强制 `BOKS_ADMIN_MFA_SECRET`（生产）
- 会话（`auth.ts:466-498`）：token + refresh_token，7 天 access / 30 天 refresh，存哈希（`access_token_hash` / `refresh_token_hash`）
- 刷新（`auth.ts:847-885`）：旧的 `refresh_token` 一次性使用，原子撤销再签发
- 注销（`auth.ts:887-905`）：**微竞态**（响应返回前 persistedSessions 未落盘）
- `runtime-config.ts:36-135` `assertRuntimeConfig` 启动门禁：**业内少见的"真启动门禁"**（管理员 token 不可占位、`BOKS_ENABLE_DEV_AUTH` 必须 false、必须有 MFA/CORS/STORAGE_MODE/AI_SERVICE_URL 校验）
- `dev-login`（`auth.controller.ts:97-113`）：`BOKS_ENABLE_DEV_AUTH` 开启时返回 `guardian-demo-001` 全装配会话；**生产模式强制禁用，但仍是代码里的演示旁路**

**关键缺陷**：
1. **真实 OAuth/OIDC 完全缺失**：微信 `loginWithWechat`（`auth.ts:668-728`）仅占位（透传 `code` 到 `BOKS_WECHAT_PROVIDER_URL`），无 `code2session`、无 `appid/secret` 校验、无 `openid` 持久化
2. **多设备会话管理缺失**：无 `devices` 表、无"踢出其它设备"接口
3. **Token 生命周期过长**：access 7 天、refresh 30 天（成熟 SaaS：15 分钟 / 30 天 + 一次性 + revoke）
4. **登录接口零限流**：`requestPhoneCode` 验证码接口**完全无限流**（P0 短信轰炸）
5. **零设备指纹、零 IP 限速、零异常 ASN/异地登录检测**
6. **RBAC 仅 `role` 字段最粗粒度**：无策略引擎（OPA/Casbin）
7. **无 SSO**：学校/机构客户场景缺失

**P0**：
1. 登录/验证码限流（5/min/IP + 10/h/account，2 人天）
2. 微信登录真接入（`code2session` + `appid`/`secret` + `openid` 持久化，5 人天）
3. refresh token 短时 + 一次性（access 15 min / refresh 30 d，3 人天）

### 3.3 业务逻辑正确性

#### 状态机

| 实体 | 状态机实现 | 评估 |
|---|---|---|
| 体测 | `draft|validating|scored|reported|rejected|needs_review` 定义在 contracts，controller 走 submit/scored/reported；`validating/needs_review` 是 dead states | **不完整** |
| 体态 | `posture.controller.ts:372-399` 写死 `risk_level: "not_scored"` / `observation_status: "insufficient_data"` | **无真正状态机** |
| 训练 | `training.controller.ts:226-273` `pause`/`resume` 直接修改 `status`，**无状态守卫**（可从 `completed` 暂停到 `paused`） | **业务应禁止** |
| 儿童档案 | `profile_status: "active|archived|deleted"`；`family.controller.ts:225-326` 物理删除逆向设 `profile_status: "deleted"` | **软删与物理删混用** |
| 知识库 | `candidate → in_review → published → superseded → withdrawn`；`knowledge.controller.ts` + `configuration.controller.ts` **双人审核**实现完整 | **最完整** |

#### 幂等性

**P0 关键缺陷**：所有写接口**零幂等**。`docs/09` 明确要求 `Idempotency-Key` 头，但：
- `main.ts:108` 仅在 CORS `Access-Control-Allow-Headers` 中允许
- **没有任何 controller 实际读取或存储**
- `updatePlatformStore` / `updateFamilyStore` 是覆盖式 read-modify-write（网络重试 = 双倍扣减）
- `training.controller.ts:95-108` 红旗打卡无幂等键 → 双击可能产生两条记录

#### 事务一致性

- `storage.ts:1397-1443` `updateFamilyDocument` 用 `BEGIN/COMMIT` 包裹 `boks_store_documents` + `syncRelationalTables` **JSONB 先写、关系表后写**——sync 失败时 JSONB 已落库，关系表空白，**事务一致性靠 sync 全量替换补救**
- **无 outbox 模式**：知识库发布不产生事件，咨询回复不通知训练服务
- `demo-store.ts:270-471` JSON 持久化用 `fs.writeFileSync(temp) + renameSync(temp, final)` 原子替换，**单进程安全**；多进程同时写丢失更新（无 flock）

#### 并发安全

- **乐观锁**：存储层无 `version` 列；`updateFamilyStore` 整体替换，**无条件更新**
- **悲观锁**：`storage.ts` `persistDocument` 用 `SELECT … FOR UPDATE` 锁单家庭；multi-family 未演练
- **跨行锁**：`trainingLog` 与 `trainingPlan` 状态修改不锁 → 两个 worker 同事打卡会同时改 plan.progress（**竞争窗口**）
- **分布式锁**：完全无 Redis

#### 数据校验

- `validation.ts` 用 `@boks/contracts` zod schemas 校验 body，**覆盖率约 80%**；`/auth/*` 不是所有字段都走 zod
- 边界用例缺：
  - `auth.ts:809` `loginWithPhone` 验证 `phone` 用正则？**没有**——直接发到 `phoneProviderRequest`（畸形号码消耗短信配额）
  - `training.controller.ts:255-260` `pause` 接受任意 `reason` 字符串，无长度限制、无敏感词过滤（**"demo pending review"这种开发痕迹能落库**）
  - `family.controller.ts` `createChild` 接受 `birth_date` **未校验 ≤ 今日**（未来日期可落库）

#### 业务规则

- **未成年保护**：`docs/11` 4.2 定义 6 项分项同意；代码写入 `consent` 数组但**未强制分项枚举**，接受任意 `purpose` 字符串
- **红旗强制暂停**：`training.controller.ts:95-109` 命中 6 个中文 regex（`疼痛|麻木|无力|夜间疼痛|呼吸困难|急症`）→ `red_flag_status = "active"` + `safety_state = "paused"`；**对"突然走路跛行""关节响"等真实红旗不命中**
- **删除级联**：`family.controller.ts:225-326` 物理删 child → 删除所有 `assessmentSessions[id]` / `trainingPlans[id]` / `postureSessions[id]` / `chatMessages[id]` / `trainingLogs[id]`；**但对象存储里的 `boks_posture_assets` 引用 ID 仍存在**（删除子任务时未删对象）
- **删除证明**：`family.controller.ts:269-279` 写入 `sha256` proof hash，**未外部锚定**（区块链/公证/审计表 prev_hash 链式）
- **草稿保护**：`assessment.controller.ts:80-92` 草稿可改、提交不可改，**无过期清理**（一年前的草稿一直留存到软删除）

### 3.4 数据库设计

**核心问题**：`services/api/src/demo-store.ts:242-264` 将整个 `BoksStore` 定义为内存对象，落盘为 `data/boks-store.json`（`demo-store.ts:270-471`）。`BOKS_STORAGE_MODE=postgres` 开启时，`storage.ts:80-327` 通过 `CREATE TABLE IF NOT EXISTS` 自动建表 + `syncRelationalTables` 在 `storage.ts:413-1184` 中 JSONB → 关系表同步。

**表结构（节选）**：
```
boks_store_documents(payload JSONB, …)              -- 文档型
boks_children(id, family_id, payload JSONB, …)      -- 关系 + JSONB 双写
boks_assessment_sessions(...)
boks_assessment_values(...)
boks_assessment_results(...)
boks_reports(...)
boks_posture_sessions(...)
boks_posture_assets(...)
boks_training_plans(...)
boks_training_logs(...)
boks_chat_conversations(...)
boks_chat_messages(...)
boks_knowledge_sources(...)
boks_knowledge_versions(...)
boks_knowledge_rules(...)
boks_knowledge_reviews(...)
boks_audit_events(...)
boks_consents(...)
boks_auth_sessions(access_token_hash, refresh_token_hash, …)
boks_auth_bindings(provider, subject_hash, …)
boks_deletion_proofs(...)
boks_admins(...)
```

**关键缺陷矩阵**：

| 缺陷 | 证据 | 影响 |
|---|---|---|
| 无 Flyway/Liquibase 迁移版本 | `storage.ts:80-327` 直接 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`（line 248-253） | 版本漂移、生产无法回滚 |
| 字段无 `_ciphertext` 后缀 | `boks_children.payload` 包含 `display_name`, `birth_date` 明文 | 未成年人姓名/出生日期明文存库 |
| 无 RLS | SQL 中无 `ALTER TABLE … ENABLE ROW LEVEL SECURITY`（grep 0 命中） | 任意 SQL 注入 = 跨家庭越权 |
| 索引不完整 | `storage.ts:200-250` 仅基础 `family_id`, `child_id` 索引；缺 `created_at DESC`, `status`, `tenant_id` | 趋势查询/审计扫描慢 |
| 约束缺失 | `boks_children.payload` JSONB 中 `sex_code` 无 `CHECK (sex_code IN ('male','female','other'))` | 数据脏 |
| 软删除不一致 | `family.controller.ts:225-326` 物理删除；`boks_deletion_proofs` 同时存在 | 软/硬删边界不清 |
| 审计表可丢 | `storage.ts:272-281` `boks_audit_events`，`INSERT ... ON CONFLICT (id) DO NOTHING`（line 1172） | 冲突时静默丢失 |
| 无分区表 | 1 年后 `boks_audit_events` 将亿级 | 性能 |
| 无 RLS 越权读 | 整库无 | **P0 安全事故** |
| 无物化视图 | 报告/趋势需要物化视图 | 性能 |
| 无备份/RPO/RTO | 无 | **灾难恢复** |
| JSON + 关系双写 | `syncRelationalTables` 重建行 | 增删改复杂度高，一致性靠"删干净再插" |

**P0**：
1. 迁移版本管理（Flyway/Liquibase/Prisma Migrate）
2. 敏感字段加密（姓名/手机号/出生日期 pgp_sym_encrypt）
3. RLS 全表启用（`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`）
4. 物化视图（报告/趋势查询 10x+ 提速）
5. 备份 + RPO/RTO（pg_dump + WAL-G → S3 + 季度演练）

### 3.5 API 设计

**现状**：
- 错误模型统一（`services/api/src/http.ts`）
- `trace_id` 生成（`main.ts:34-38`）但**未注入响应 header**
- CORS 允许 `Idempotency-Key`（`main.ts:108`）但**无 controller 实际使用**

**关键缺陷**：
1. **无 OpenAPI/Swagger 文档**（`app.module.ts` 无 swagger 配置）
2. **无限流**（登录/验证码接口爆破风险）
3. **契约路径不一致**：`docs/09` 定义 vs 实际 controller
4. **无分页策略**（缺 cursor/page_token、limit/offset 规范）
5. **无 SSE/WebSocket 流式**（AI 咨询只能等完整结果）

### 3.6 文件与对象存储

**现状**：
- SigV4 预签名上传（`asset-storage.ts`）
- MIME/大小/KMS 已落地

**关键缺陷**：
1. 无生命周期策略（30 天自动归档）
2. 无 CDN（CloudFront / Cloudflare）
3. 无 HEIC 转码（iOS HEIC 不支持）
4. 无病毒扫描（ClamAV / 云厂商）
5. 无水印（报告 PDF）
6. **删除闭环缺失**（DB 删 child → 未删对象存储）

### 3.7 缓存与队列

**关键缺陷**：`infra/docker-compose.yml:24-36` 有 `redis:7-alpine`，**但代码中无 Redis 客户端**（`services/api/package.json` 依赖无 `ioredis` / `redis` / `bullmq`）：
- 零缓存（所有 `loadFamilyStore` 直接 DB SELECT）
- 零队列（`syncKnowledgeSource` 是 `setInterval` 同步调用）
- 零分布式锁
- 零限流/验证码存储

**运行时缺陷**：
- 验证码无频控 → 短信轰炸
- 登录无频控 → 暴力破解
- 多实例无共享 → 验证码/会话不一致
- 无缓冲 → AI 高峰打爆
- 无延迟队列 → 知识库抓取只能 setInterval

**P0**：
1. Redis 接入 + 登录/验证码限流 + 幂等键 + 验证码存储（2-3 人天）
2. BullMQ 异步任务（`posture_inference`, `report_render`, `erasure`, `knowledge_fetch`，5 人天）

### 3.8 可观测性

**关键缺陷**：
- **日志**：`main.ts:43-51` 手写 JSON 结构化访问日志到 stdout（脱敏 Authorization），**不在 pino/winston 体系**，未注入 trace context
- **Metrics**：`main.ts` 无 `/metrics`；**零 Prometheus**
- **Tracing**：`main.ts:34-38` 生成 `x-trace-id` 但**未注入响应 header**（`X-Trace-Id` 回传）；跨服务不传播；无 OpenTelemetry SDK
- **健康检查**：`health.controller.ts` 36 行；**无 Redis/OpenSearch/S3/Sentry 探针**
- **告警**：**零**
- **错误聚合**：**无 Sentry 接入**

**P0**：
1. OpenTelemetry SDK + trace context 跨服务传播（5 人天）
2. Prometheus `/metrics`：HTTP P50/P95/P99、错误率、登录成功/失败、队列长度（3 人天）
3. Sentry 接入（1 人天）

### 3.9 安全合规（OWASP Top 10 2021 覆盖）

| 项 | 覆盖 | 证据 |
|---|---|---|
| A01 访问控制 | 部分 | ACL 应用层；无 RLS；易 IDOR |
| A02 加密失败 | 部分 | TLS 1.2+ 假设（无证书固定）；静态无 |
| A03 注入 | 良好 | `pg` 全部参数化；无拼 SQL |
| A04 不安全设计 | 弱 | 状态机/幂等/审计缺 |
| A05 配置错误 | 部分 | `runtime-config.ts` 严格门禁；CORS 仍允许 `Idempotency-Key` |
| A06 易感组件 | 未知 | 无 `npm audit` 流程 |
| A07 身份认证失败 | 部分 | scrypt + TOTP；但 dev-login 旁路 |
| A08 数据完整性 | 部分 | `risk_level: "not_scored"` z.literal 防伪造 |
| A09 日志失败 | 部分 | 访问日志脱敏；无业务告警 |
| A10 SSRF | 良好 | AI 客户端 URL 来自环境变量 |

**综合覆盖率：约 30%**

**P0**：
1. DPIA 评估报告 + 法务审定隐私政策（5 人天）
2. 删除闭环（DB + S3 + 缓存 + 索引 + 备份标注，5 人天）
3. 6 项分项同意枚举强制（`purpose: z.enum([assessment, photo, audio, ai_context, boks_internal, model_training])`，1 人天）
4. 密钥管理 KMS + 轮换（5 人天）

### 3.10 测试

**现状**：
- `services/api/src/accounts.test.ts`（251 行）：8 unit test
- `services/api/src/production.test.ts`（471 行）：14 integration test
- `services/api/src/learning-loop.test.ts`（343 行）：5 + 5 unit test

**关键缺陷**：
- 单元测试覆盖率 < 30%（全部 controller 0 覆盖）
- 无 supertest E2E
- 无 Pact 契约测试
- 无 k6 压测
- 无 OWASP ZAP / snyk
- 无模型评估
- 无覆盖率门禁
- 无 Detox/Maestro E2E
- 无越权矩阵测试

**P0**：
1. 核心 controller 单元测试（家庭/体测/训练/体态/咨询，覆盖 T-001—T-014，10 人天）
2. supertest 集成测试（鉴权 + 写幂等，5 人天）
3. 覆盖率门禁（`vitest.config.ts` thresholds，1 人天）

### 3.11 工程实践

**关键缺陷**：
- 无 Dockerfile（`infra/docker-compose.yml` 有 PG/Redis，**但 API 无 Dockerfile**）
- 无 K8s manifests / Helm / Kustomize / ArgoCD
- 无 API Docker build job / 无生产 deploy job
- 无灰度 / 蓝绿 / 金丝雀
- 无配置中心（`runtime-config.ts` 纯环境变量，无 Apollo/Nacos/Consul）
- 无 Vault/KMS
- 无数据库迁移自动化（`storage.ts:80-327` 手写 `CREATE TABLE`）
- 无 graceful shutdown（`main.ts` 缺 `app.enableShutdownHooks()`）
- 无 body size limit
- 无 trust proxy（IP 限流拿不到真实 IP）
- `package.json` 缺依赖：throttler、swagger、pino、sentry、ioredis、bullmq、cache-manager、prisma/kysely、bcrypt/argon2、helmet、compression、nestjs-i18n、nestjs-terminus、pino-http、opentelemetry sdk

**P0**：
1. API Dockerfile + 多阶段 build + 镜像签名（2 人天）
2. 数据库迁移（Prisma Migrate / Kysely Migrate，5 人天）
3. graceful shutdown + trust proxy + body size limit（1 人天）

---

## 4. 安全/合规/法务审查

### 4.1 IDOR/BOLA 风险

- `family.controller.ts` `assertChildAccess` 依赖 `loadFamilyStore` 过滤 `family_id`；任何 controller 写到 `loadFamilyStore` 都正确，**但若新 controller 用 `loadSingleChild(id)` 跨家庭查询则泄漏**
- `posture.controller.ts:48-82` 上传授权检查 `child_id === session.guardian_id` 但**没校验 `family_id` 一致**
- `assessment.controller.ts:80-92` 提交体测 `assertChildAccess` 内部 OK；但**没有"儿童已删除则拒"**的检查（`profile_status === "deleted"`）

### 4.2 注入风险

- **SQL**：`pg` 全部使用参数化（`storage.ts` 全文 `query(` 中 `$$`），OK
- **命令**：`execa` 未使用；`spawn` 未使用
- **模板注入**：AI 提示词拼字符串（`services/ai/src/boks_ai/main.py`）未读，但**前端 `chat.controller.ts:60-80` 把用户输入直接拼到 `requestAiChat` 的 `messages` 数组，可能注入 system prompt**

### 4.3 脱敏

- `main.ts:43-51` 访问日志脱敏 Authorization；**未体系化扫描**（`document.querySelector('input').value`、手机号、姓名、child_id 都未脱敏）
- 错误响应包含 `details[].reason`，可能包含用户提交的 hint 文本

### 4.4 密钥管理

- `runtime-config.ts` 环境变量全部明文；**无 KMS / Vault 集成**
- 管理员 TOTP secret 写在 `BOKS_ADMIN_MFA_SECRET` 环境变量 — OK，但**没有轮换机制**

### 4.5 法务合规

- `docs/11` 列出 GDPR / 网络安全法 / 未成年人保护法 / PIPL，但**无 PIAA / DPIA 评估报告**
- `docs/11` 4.2 列 6 项分项同意，**代码接受任意 `purpose` 字符串**
- 数据导出：API 存在 (`family.controller.ts`)，但**仅 JSON 复制到剪贴板**——不符合 PIPL 第 44 条"提供数据副本"的要求
- 数据删除：物理删除 + SHA256 proof，**未锚定外部**（区块链、公证 URL）

### 4.6 未成年人保护

- `docs/11` 要求 `consent_type` 中"model_training"必须独立勾选，**代码未强制**
- "AI 诊断脊柱侧弯"等禁用词（`docs/11` 9 节）— `chat.controller.ts` 的 `safety_state` 兜底文案**未统一校验**
- `assessment.controller.ts` 接受 `birth_date` 不校验是否 ≤ 18 年前，且**未对未满 14 周岁强制额外同意**

### 4.7 安全合规整体 P0/P1/P2

| 优先级 | 任务 | 工期 |
|---|---|---|
| **P0** | DPIA 评估报告 + 法务审定隐私政策 | 5 人天 |
| **P0** | 删除闭环（DB + S3 + 缓存 + 索引 + 备份标注） | 5 人天 |
| **P0** | 6 项分项同意枚举强制 | 1 人天 |
| **P0** | 密钥管理 KMS + 90 天轮换 | 5 人天 |
| **P0** | 越权矩阵自动化测试（家庭 A 访问家庭 B） | 3 人天 |
| **P1** | WORM 审计（链式 hash + 不可篡改） | 3 人天 |
| **P1** | 禁用词统一校验（咨询/训练/报告/分享/后台展示） | 1 人天 |
| **P1** | 自动化 OWASP ZAP 跑批 | 2 人天 |
| **P2** | 事件响应 runbook + 季度演练 | 3 人天 |

---

## 5. 工程实践/可观测/CI/CD 审查

### 5.1 Docker / K8s

- `infra/docker-compose.yml` 有 PostgreSQL 17 + Redis 7，**但 API 服务无 `Dockerfile`**
- API 启动命令：`tsx watch --env-file-if-exists=../../.env src/main.ts`（`package.json:7`），开发模式
- `infra/` 目录**无 K8s manifests**
- 没有 Helm / Kustomize / ArgoCD

### 5.2 CI/CD

- `docs/12` 5 节描述 `.github/workflows/ci.yml`：TypeScript 契约/API 检查、小程序构建、Flutter Android 静态分析、Python AI 服务检查
- **没有 API Docker build job**
- **没有生产 deploy job**
- **没有 OpenAPI 兼容检查**
- **没有数据库迁移演练**

### 5.3 灰度 / 蓝绿 / 金丝雀

- 完全无
- `BOKS_AI_SERVICE_URL` 支持配置，但**没有 A/B 流量切分**

### 5.4 配置中心 / 密钥管理

- `runtime-config.ts` 纯环境变量；**无 Apollo / Nacos / Consul**
- 配置变更需重启
- `runtime-config.ts` 把所有密钥放环境变量；**无 Vault / KMS 集成**
- 密钥轮换机制：无

### 5.5 数据库迁移自动化

- `storage.ts:80-327` 手写 `CREATE TABLE IF NOT EXISTS` —— **无版本管理、无回滚、无 dry-run**
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS` —— 改字段极困难

### 5.6 应用启动

- `main.ts:1-115` 直接 `NestFactory.create(AppModule)` + `useLogger(...)` + 全局中间件 + `listen(env.PORT || 3000)`
- **无 graceful shutdown**（`app.enableShutdownHooks()` 缺失）
- **无 body size limit**（除 multer 默认，但控制器是 JSON 解析）
- **无 trust proxy**（`app.set('trust proxy', …)` 缺失，IP 限流拿不到真实 IP）

### 5.7 工程实践 P0/P1/P2

| 优先级 | 任务 | 工期 |
|---|---|---|
| **P0** | API Dockerfile + 多阶段 build + 镜像签名 | 2 人天 |
| **P0** | 数据库迁移（Prisma Migrate / Kysely Migrate）+ 回滚演练 | 5 人天 |
| **P0** | graceful shutdown + trust proxy + body size limit | 1 人天 |
| **P0** | pino + pino-http + trace 注入 | 1 人天 |
| **P0** | OpenTelemetry SDK + auto-instrumentation + `OTEL_EXPORTER_OTLP` | 5 人天 |
| **P0** | Prometheus `/metrics` + nestjs-prometheus + 业务 metrics | 3 人天 |
| **P1** | Sentry 接入 | 1 人天 |
| **P1** | Kubernetes Helm + Ingress + HPA + PDB + Network Policy | 5 人天 |
| **P1** | CI 增 OpenAPI 兼容 + 镜像扫描 + 迁移演练 | 5 人天 |
| **P1** | Alertmanager + Grafana dashboard + PagerDuty | 3 人天 |
| **P2** | 灰度 Argo Rollouts + Flagger | 5 人天 |
| **P2** | 配置中心 Apollo / Nacos 接入 | 5 人天 |

---

## 6. 综合 P0/P1/P2 缺陷矩阵

### 6.1 P0（上线阻塞，4-8 周内必须完成）

| # | 缺陷 | 模块 | 涉及文件 | 修复工作量 |
|---|---|---|---|---|
| 1 | `services/ai` 是 17KB 空壳，`/v1/chat` 直接退化固定模板 | AI | `services/ai/src/boks_ai/llm.py`、`main.py` | 2-3 周 |
| 2 | 体态分析空架子，`risk_level: z.literal("not_scored")` 锁死 | AI + 后端 | `packages/contracts/src/index.ts:547`、`posture.controller.ts:381` | 6-8 周 |
| 3 | RAG 是字符 bigram 检索，无 embedding/向量库 | AI | `services/ai/src/boks_ai/rag.py:12-16` | 2-3 周 |
| 4 | 安全是 6 个中文 regex，无 LLM 分类器、无红队 | AI | `services/ai/src/boks_ai/safety.py`、`chat-safety.ts` | 3-4 周 |
| 5 | demo-store JSON 双写，无 RLS/字段加密/迁移版本 | 后端 | `services/api/src/demo-store.ts`、`storage.ts` | 2-3 周 |
| 6 | 所有写接口零幂等（Idempotency-Key 全仓 0 命中） | 后端 | `main.ts`、`services/api/src/auth.ts` 等 | 3 人天 |
| 7 | 登录/验证码接口零限流（短信轰炸/暴力破解） | 后端 | `auth.controller.ts:97-113`、`auth.ts:811-822` | 2 人天 |
| 8 | 生产 baseURL 仍是 `api.example.invalid` | 工程 | `runtime-config.ts`、`config/` | 0.5 人天 |
| 9 | Flutter `screens.dart` 2825 行单文件 | UI | `apps/mobile/lib/screens.dart` | 1 周 |
| 10 | miniprogram 设计令牌硬编码 50+ rgba | UI | `apps/miniprogram/src/app.scss` | 1 周 |
| 11 | Flutter 假 Tab（Navigator.push）、Admin 无路由表 | UI | `apps/mobile/lib/screens.dart:1119`、`apps/admin/src/App.tsx` | 1-2 周 |
| 12 | 三态统一覆盖率 17%（仅 2 个页面有 Empty/Error） | UI | 12 个 pages | 1 周 |
| 13 | 全无 ErrorBoundary（miniprogram/Flutter/Admin） | UI | `apps/miniprogram/src/app.tsx`、`apps/mobile/lib/main.dart`、`apps/admin/src/App.tsx` | 0.5 周 |
| 14 | a11y aria-label 0 命中 | UI | 全代码 | 1 周 |
| 15 | dev-login 旁路在代码（生产仅靠启动门禁） | 后端 | `auth.controller.ts:97-113` | 1 人天 |
| 16 | 微信登录是占位（无 code2session） | 后端 | `services/api/src/auth.ts:668-728` | 5 人天 |
| 17 | refresh token 过长（7 天/30 天） | 后端 | `services/api/src/auth.ts:466-498` | 3 人天 |
| 18 | Redis 接入（`docker-compose.yml` 有但代码 0 用） | 后端 | `services/api/package.json`、`infra/` | 1-2 周 |
| 19 | 无 Dockerfile / 无 K8s manifest | 工程 | `services/api/`、`infra/` | 2-5 人天 |
| 20 | 无 graceful shutdown / trust proxy / body limit | 工程 | `services/api/src/main.ts` | 0.5 人天 |

**P0 总工作量预估**：约 18-25 周（按 1 人全职计算，需 4-6 人/团队 1.5 个月集中冲刺）

### 6.2 P1（达到"成熟医疗 AI"门槛，8-12 周）

| # | 缺陷 | 模块 | 修复工作量 |
|---|---|---|---|
| 1 | 工具调用（query_assessment / query_plan / generate_plan） | AI | 2 周 |
| 2 | Plan-Execute 编排 + 长期记忆 | AI | 3 周 |
| 3 | 评分引擎扩展（初中/高中/引体/立定跳远/1000m/800m） | 后端 | 1-2 周 |
| 4 | ASR（语音输入） + TTS（语音输出） | AI + UI | 3 周 |
| 5 | 5 级降级链 + APM + 监控 + 告警 | 工程 | 4 周 |
| 6 | 模型注册表（model_card） + 完整审计 OLAP | AI + 后端 | 2-3 周 |
| 7 | 多设备会话 + 踢出旧设备 + 会话指纹 | 后端 | 2 周 |
| 8 | RBAC 引擎（OPA/Casbin） + 风控层（IP/设备指纹） | 后端 | 5 周 |
| 9 | OIDC/SAML SSO（学校/机构客户） | 后端 | 10 周 |
| 10 | DPIA + KMS + WORM 审计 + 自动化 OWASP ZAP | 安全 | 10 周 |
| 11 | Flutter 引入 ThemeExtension + 自定义令牌 | UI | 1 周 |
| 12 | Admin 扩充 CSS 变量到 ≥ 30 个 | UI | 1 周 |
| 13 | 三端 dark mode | UI | 2 周 |
| 14 | miniprogram 引入 PullRefresh + InfiniteList + Form 系统 | UI | 2 周 |
| 15 | Flutter flutter_animate 全页面 enter/exit + 自定义动画 | UI | 2 周 |
| 16 | 多色品牌图标 ≥ 8 个 + Lottie 动画图标 | UI | 1 周 |
| 17 | Flutter MediaQuery textScaler + Semantics + Tooltip | UI | 1 周 |
| 18 | Sentry + Alertmanager + Grafana dashboard | 工程 | 4 周 |
| 19 | K8s Helm + Ingress + HPA + PDB + NetworkPolicy | 工程 | 5 周 |
| 20 | Pact 契约测试 + k6 压测 + 越权矩阵 | 测试 | 8 周 |

**P1 总工作量预估**：约 60-80 周（按 1 人全职计算，2-3 个月集中冲刺）

### 6.3 P2（达到"领先"水平，3-6 个月）

| # | 缺陷 | 模块 |
|---|---|---|
| 1 | 多 Agent 协同 | AI |
| 2 | A/B 灰度 | 工程 |
| 3 | 视频动作识别（跳绳/仰卧起坐自动计数） | AI |
| 4 | 训练效果预测 | AI |
| 5 | 跨境合规评估 | 法务 |
| 6 | 多模态 LLM（图像问答） | AI |
| 7 | 14 岁以下专项保护 | 后端 |
| 8 | 双亲/多监护人权限模型 | 后端 |
| 9 | Storybook 三端组件文档 | UI |
| 10 | 应急 Runbook + 季度演练 | 工程 |
| 11 | HEIC 转码 + 病毒扫描 + 水印 | 后端 |
| 12 | CDN + 边缘签名 | 后端 |

### 6.4 P3（长期，6-12 个月）

1. 实时视频流分析
2. 3D 体态重建
3. 联邦学习 / 隐私计算
4. 多模态 LLM 全场景应用
5. 跨境安全评估

---

## 7. 量化验收指标

| 维度 | 当前 | 目标 |
|---|---|---|
| **UX/UI** | | |
| 设计令牌字段一致率 | 0%（三端独立） | 100% |
| 硬编码 rgba/hex 数 | 50+ | 0 |
| 共享组件数 | 3（miniprogram） + 0（Flutter） + 0（Admin） | ≥ 12 + ≥ 15 + ≥ 8 |
| 三态覆盖率 | 17% | 95% |
| Skeleton 覆盖率 | 0% | 100% |
| ErrorBoundary 覆盖率 | 0% | 100% |
| aria-label 覆盖率 | 0% | 100% |
| 44×44 触控目标合规率 | 推测 50% | 100% |
| Dark mode 覆盖率 | 0% | 100% |
| Tab 切换状态保留率 | Flutter 0% | 100% |
| **AI** | | |
| LLM Provider 抽象 | 写死 2 个 | ≥ 4 个可热切换 |
| Prompt 模板版本管理 | 0 | ≥ 20 个 `prompt_id@version` |
| Token 计数 | 0 | 100% 携带 usage |
| RAG 检索算法 | 字符 bigram | BM25 + 向量 + rerank |
| 检索质量评估（recall@10） | N/A | ≥ 0.80 |
| 安全分类器 | 6 regex | LLM-based + 红队集 ≥ 500 条 |
| 流式首字延迟 | 同步等待 | < 800ms |
| 多轮对话上下文 | 0 | ≥ 10 turn |
| **后端** | | |
| 单元测试覆盖率 | < 30% | ≥ 80% |
| 集成测试覆盖核心接口 | 0 | 100% |
| 写接口幂等覆盖 | 0 | 100% |
| 登录/验证码限流 | 0 | 5/min/IP + 10/h/account |
| Token 短时化 | 7d/30d | 15min/30d + revoke |
| RLS 表启用 | 0 | 100% |
| 字段加密覆盖率 | 0 | 100%（姓名/手机号/出生日期） |
| 迁移版本管理 | 0 | 100% |
| 备份 RPO/RTO | N/A | RPO ≤ 5min, RTO ≤ 1h |
| **工程** | | |
| Dockerfile | 0 | 100% 服务 |
| K8s manifest | 0 | 100% 服务 |
| CI 门禁覆盖 | 基础 | 单元 + 集成 + 契约 + 压测 + 安全扫描 |
| Metrics P50/P95/P99 | 0 | 100% 关键接口 |
| Tracing 跨服务 | 0 | 100% |
| 告警规则数 | 0 | ≥ 10 |
| **安全合规** | | |
| OWASP Top 10 覆盖率 | 30% | 95%+ |
| IDOR 自动化测试 | 0 | 100% 核心接口 |
| 分项同意强制 | 0（任意字符串） | 6 enum |
| WORM 审计 | 0 | 100% |
| KMS + 密钥轮换 | 0 | 90 天 |

---

## 8. 与 docs/14 的差异与补充

| 章节 | docs/14 | docs/16（本报告） |
|---|---|---|
| 范围 | 全维度综述（含 UX/AI/后端/安全/工程） | **三大维度深度展开**（UX/AI/后端）+ 整合 |
| UX/UI | 仅 P2 提及 | **独立第 1 章，8 个子维度深度**（信息架构/令牌/组件/三态/动画/图标/A11Y/专业领域 UX） |
| AI | 简要 P0/P1/P2 | **独立第 2 章，8 个子维度深度**（LLM/RAG/安全/Agent/领域模型/语音/工程/数据隐私） |
| 后端 | 10 项 P0 清单 | **独立第 3 章，10 个子维度深度**（IAM/业务/数据库/API/对象存储/缓存/可观测/安全/测试/工程） |
| 安全合规 | 与后端合并 | **独立第 4 章**（IDOR/注入/脱敏/密钥/法务/未成年人） |
| 工程实践 | 与后端合并 | **独立第 5 章**（Docker/K8s/CI/CD/灰度/配置中心/迁移/启动） |
| 量化验收 | 无 | **新增第 7 章**（综合指标表 50+ 条） |
| P0/P1/P2 | 10 项 / 24 项 / 24 项 | **20 项 / 20 项 / 12 项 + 长期 5 项**（更细粒度） |

**结论**：`docs/14` 是首次基线；`docs/16`（本报告）是**最高标准强化版**——按市场成熟产品（Keep/华为/亲宝宝/平安 AskBob/医联 MedBrain/Anthropic Claude for Healthcare）的实际工程标准，给出**可量化的差距指标 + 落地 P0/P1/P2 矩阵**。

---

> **下一步**：本报告配套落地执行方案见 `docs/17-detailed-execution-roadmap-2026.md`（含 12 周分阶段计划、里程碑、责任人、验收指标、SLA）。