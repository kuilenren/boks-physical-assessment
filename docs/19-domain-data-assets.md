# BOKS 专业领域数据资产深化设计（增量深化 #2）

> **配套文档**：`docs/16` §3、`docs/17` §阶段 11、`docs/02-feature-specification.md`、`docs/03-authoritative-research.md`
> **审查基线**：2026-08-02（Asia/Shanghai）
> **范围**：体测评分表、体态观察类别库、训练动作库、知识库元数据、权威来源清单
> **目标**：把"开发评分表 + demo 知识库"升级为"可被生产 AI 检索与决策的权威事实库"

---

## 目录

- [0. 当前现状与差距](#0-当前现状与差距)
- [1. 顶层数据资产清单](#1-顶层数据资产清单)
- [2. 国家学生体质健康标准（小学/初中/高中）](#2-国家学生体质健康标准小学初中高中)
- [3. 幼儿体质参考（3-6 岁）](#3-幼儿体质参考3-6-岁)
- [4. 体态观察类别库](#4-体态观察类别库)
- [5. 训练动作库](#5-训练动作库)
- [6. 知识库元数据 schema](#6-知识库元数据-schema)
- [7. 权威来源清单与获取路径](#7-权威来源清单与获取路径)
- [8. 数据资产导入与双审](#8-数据资产导入与双审)
- [9. 与 AI 检索 / Agent 的集成](#9-与-ai-检索--agent-的集成)
- [10. 落地执行（接续 17 阶段 11）](#10-落地执行接续-17-阶段-11)

---

## 0. 当前现状与差距

### 0.1 体测评分表

**现状证据**：
- `services/api/src/scoring-engine.ts:3` 写死 `NATIONAL_2014_STANDARD_ID = "std-national-primary-2014-v1"`
- `:60-110` 含小学 `run50mTables`、`sitReachTables`、`rope1minTables`、`lungCapacityTables`、`sitUpTables`、`shuttle50x8Tables`、`bmiBands`
- 但**仅覆盖小学 1-6 年级**，**未覆盖初中 7-9 / 高中 10-12**（教育部标准对学段差异巨大）
- `services/api/migrations/001_boks_store_documents.sql:227-274` 有 `boks_standard_versions / indicators / score_bands / rules`，但**未填充实际评分表**
- `:230` `status IN ('approved', 'demo_pending_review')` — 当前 `demo_pending_review`，**禁止宣称国家核验**

### 0.2 体态观察类别

**现状证据**：
- `packages/contracts/src/index.ts:547` 用 `z.literal("not_scored")` 锁死风险等级
- `services/api/src/posture.controller.ts:381` 硬编码 `"四视角任务质量通过，但当前没有真实姿态模型"`
- **完全没有**体态观察分类（圆肩/驼背/骨盆前倾/脊柱侧弯/扁平足/膝超伸/X/O 型腿 等）的标准化定义

### 0.3 训练动作库

**现状证据**：
- `docs/02-feature-specification.md` 提到"年龄分层的低风险训练计划"
- 但**没有结构化动作库**（动作名/目标肌群/MET/卡路里/禁忌/替代动作/视频示范）
- AI 咨询时无法检索"针对 9 岁男孩 50 米跑提升的具体动作"

### 0.4 知识库元数据

**现状证据**：
- `services/api/migrations/001_boks_store_documents.sql:159-176` 有 `boks_knowledge_sources` / `boks_knowledge_versions`
- 字段过少（缺 audience、category、content_hash、source_url、effective_from、effective_to、language、citation_count）
- **缺分类法**（政策/标准/指南/动作库/案例）

### 0.5 权威来源

**现状证据**：
- `scoring-engine.ts:8` 写 `https://www.gov.cn/gongbao/content/2014/content_2781929.htm` — 但仅作为常量，未做版本化校验
- `docs/03-authoritative-research.md` 列了清单，但**未与代码库建立引用追溯**

---

## 1. 顶层数据资产清单

```
data/
├── standards/                          # 评分标准
│   ├── national_2014_primary.json      # 小学 1-6
│   ├── national_2014_junior.json       # 初中 7-9
│   ├── national_2014_senior.json       # 高中 10-12
│   ├── national_2014_bmi_bands.json    # BMI 分级（小学/初中/高中分开）
│   ├── preschool_reference_3_6.json    # 幼儿参考（不进总分）
│   └── version_registry.json           # 版本号 + 原文 PDF 哈希
├── posture/
│   ├── observation_taxonomy.json       # 9 大类 30 子类
│   ├── red_flags.json                  # 立即转人工的红旗
│   ├── view_protocols.json             # 4 视角拍摄规范
│   └── limitations_glossary.json       # 标准免责声明
├── training/
│   ├── actions.json                    # 120 个动作库
│   ├── contraindications.json          # 禁忌矩阵
│   ├── weekly_templates.json           # 12 周阶段模板
│   └── progression_rules.json          # 进阶规则
├── knowledge/
│   ├── taxonomy.json                   # 政策/标准/指南/动作/案例
│   ├── source_registry.json            # 来源注册表（来源 ID → URL/版本/哈希）
│   └── golden_corpus_v1.jsonl          # 已发布的知识文档（≥ 200）
└── eval/
    ├── rag/golden_set_v1.jsonl
    ├── chat/golden_v1.jsonl
    └── safety/red_team_v1.jsonl
```

---

## 2. 国家学生体质健康标准（小学/初中/高中）

### 2.1 指标全集（按学段）

| 指标 | 代码 | 小学 1-2 | 小学 3-4 | 小学 5-6 | 初中 | 高中 | 单位 | 类型 |
|---|---|---|---|---|---|---|---|---|
| 身高 | `height` | ✓ | ✓ | ✓ | ✓ | ✓ | cm | decimal |
| 体重 | `weight` | ✓ | ✓ | ✓ | ✓ | ✓ | kg | decimal |
| BMI | `bmi` | ✓（自动派生） | ✓ | ✓ | ✓ | ✓ | — | derived |
| 肺活量 | `lung_capacity` | ✓ | ✓ | ✓ | ✓ | ✓ | ml | integer |
| 50 米跑 | `run_50m` | ✓ | ✓ | ✓ | ✓ | ✓ | s | decimal |
| 坐位体前屈 | `sit_reach` | ✓ | ✓ | ✓ | ✓ | ✓ | cm | decimal |
| 1 分钟跳绳 | `rope_1min` | ✓ | ✓ | ✓ | ✓ | ✓ | count | integer |
| 1 分钟仰卧起坐 | `sit_up` | — | ✓（女） | ✓（女） | ✓（女） | ✓（女） | count | integer |
| 50 米 × 8 往返跑 | `shuttle_50x8` | — | ✓ | ✓ | — | — | s | decimal |
| 25 米 × 2 往返跑 | `shuttle_25x2` | ✓ | — | — | — | — | s | decimal |
| 投掷沙包 | `sandbag_throw` | ✓ | — | — | — | — | m | decimal |
| 1000 米跑（男）/ 800 米跑（女） | `endurance_run` | — | — | — | ✓ | — | s | decimal |
| 800 米跑（男）/ 1000 米跑（女） | `endurance_run` | — | — | — | — | ✓ | s | decimal |
| 引体向上（男）/ 仰卧起坐（女） | `pull_up` / `sit_up` | — | ✓（男） | ✓（男） | ✓（男） | ✓（男） | count | integer |
| 立定跳远 | `standing_jump` | — | — | — | ✓ | ✓ | cm | integer |

**权重（标准规定）**：见 `docs/03-authoritative-research.md`；按年级/性别在 `weightsFor()` 中实现。

### 2.2 JSON Schema（替换 TS 字面量）

```json
// data/standards/national_2014_primary.json（结构示意）
{
  "standard_id": "std-national-primary-2014-v1",
  "name": "国家学生体质健康标准（2014年修订）— 小学部分",
  "version": "1.0.0",
  "effective_from": "2014-07-01",
  "source_url": "https://www.gov.cn/gongbao/content/2014/content_2781929.htm",
  "source_pdf_sha256": "<购买/官方下载 PDF 的哈希>",
  "approved_at": "<双人审核时间>",
  "approved_by": ["<审核员 A>", "<审核员 B>"],
  "indicators": [
    {
      "code": "run_50m",
      "label": "50 米跑",
      "unit": "s",
      "input_type": "decimal",
      "min_value": 5.0, "max_value": 30.0, "step": 0.1,
      "applicable_grades": ["1","2","3","4","5","6"],
      "applicable_sex": ["male", "female"],
      "weight_by_grade": {
        "1": {"male": 0.10, "female": 0.10},
        "2": {"male": 0.10, "female": 0.10},
        "3": {"male": 0.10, "female": 0.10},
        "4": {"male": 0.10, "female": 0.10},
        "5": {"male": 0.10, "female": 0.10},
        "6": {"male": 0.10, "female": 0.10}
      },
      "bands_by_grade_sex": {
        "1|male":   { "direction": "lower_is_better", "points": [/*20 个档：score:threshold*/] },
        "1|female": { "direction": "lower_is_better", "points": [...] }
      }
    }
    // ...
  ]
}
```

**档位（points）20 个固定档**（与 `scoring-engine.ts:21` 一致）：
`[100, 95, 90, 85, 80, 78, 76, 74, 72, 70, 68, 66, 64, 62, 60, 50, 40, 30, 20, 10]`

**加分明细**：跳绳等指标有 `bonus.baseScore / step / maxBonus`（见 `scoring-engine.ts:78`）。

### 2.3 必填完整度（升级标准库）

| 学段 | 必填指标 | 校验 |
|---|---|---|
| 小学 1-2 | height, weight, lung_capacity, run_50m, sit_reach, rope_1min + (1 年级 shuttle_25x2 / 2 年级沙包任选) | 缺项提示"可暂存，可后续补录" |
| 小学 3-4 | height, weight, lung_capacity, run_50m, sit_reach, rope_1min, sit_up(女)/pull_up(男) | 缺项必须补录或勾选"已校测未达标" |
| 小学 5-6 | + shuttle_50x8 | 同上 |
| 初中 7-9 | height, weight, lung_capacity, run_50m, sit_reach, rope_1min, sit_up(女)/pull_up(男), standing_jump, endurance_run | 全部必填 |
| 高中 10-12 | 同初中 + 800/1000 米 | 全部必填 |

### 2.4 双人审核 Gate

```python
# scripts/standards/import.py
def import_standard(json_path: Path, *, reviewers: list[str], approver: str) -> None:
    payload = load_json(json_path)
    # 1. PDF 哈希校验
    pdf = download(payload["source_url"], cache=True)
    assert sha256(pdf) == payload["source_pdf_sha256"], "PDF 哈希不匹配，禁止导入"
    # 2. 评分表覆盖率
    for indicator in payload["indicators"]:
        for grade in indicator["applicable_grades"]:
            for sex in indicator["applicable_sex"]:
                key = f"{grade}|{sex}"
                assert key in indicator["bands_by_grade_sex"], f"缺档位 {key}"
    # 3. 双人审核记录
    payload["approved_by"] = reviewers
    payload["approver"] = approver
    payload["approved_at"] = now()
    # 4. 写入 boks_standard_versions + indicators + score_bands
    upsert_standard(payload)
```

### 2.5 必须替换的现有代码

| 文件 | 旧实现 | 新实现 |
|---|---|---|
| `services/api/src/scoring-engine.ts:60-110` | TS 字面量表 | `loadStandard(standard_id)` 从 JSON 读，缓存 |
| `services/api/src/scoring-engine.ts:208-225` | weightsFor 内置 | 从标准 JSON 读 weights_by_grade |
| `services/api/src/scoring-engine.ts:111-200` | bmiBands 内置 | 同上 |
| `services/api/migrations/001_boks_store_documents.sql:227-274` | 空表 | 真正写入数据（迁移后由脚本导入） |

---

## 3. 幼儿体质参考（3-6 岁）

### 3.1 与 P0 边界一致

按 `README.md:80` 与 `docs/02`：**幼儿园不显示国家总评**，使用幼儿专项体能参考 + 进步记录。

### 3.2 指标集（不进入总分，仅作参考）

```
age_months（3-72 月，按月龄分桶）
reference_indicators:
  - height_for_age               # WHO/九市标准
  - weight_for_age
  - bmi_for_age
  - 10m_sprint                   # 10 米冲刺
  - 立定跳远
  - 投掷沙包
  - 平衡木
  - 双脚连续跳
  - 坐位体前屈
  - 走跑交替
reference_percentiles: [p3, p10, p25, p50, p75, p90, p97]
reference_source:
  - 九市标准（2005）
  - WHO Child Growth Standards
  - 国民体质测定标准手册（幼儿部分）— 需正式取得
```

### 3.3 数据形态

```json
{
  "id": "preschool-reference-v1",
  "age_range_months": [36, 72],
  "sex": "male",
  "indicator": "10m_sprint",
  "unit": "s",
  "direction": "lower_is_better",
  "percentiles": [
    {"p": 3,  "value": 12.5}, {"p": 10, "value": 11.2}, {"p": 25, "value": 10.0},
    {"p": 50, "value": 9.0},  {"p": 75, "value": 8.4},  {"p": 90, "value": 7.8},
    {"p": 97, "value": 7.2}
  ],
  "source": {"id": "gmps-preschool-3-6-2018", "version": "2018", "url": "..."}
}
```

### 3.4 UI 行为

- 仅展示**百分位**和**进步曲线**（与自身基线对比），**禁止**显示"分数"或"评级"。
- 标注"参考量表，非国家评分"。

---

## 4. 体态观察类别库

### 4.1 当前缺口

`packages/contracts/src/index.ts:547` `z.literal("not_scored")` + `posture.controller.ts:381` 明示"无真实姿态模型"。**任何对家长的体态反馈都必须基于可被审核的标准化类别**。

### 4.2 体态观察分类法（9 大类）

```
posture.taxonomy
├── 1. 头部 (head)
│     ├── 1.1 头前倾 (forward_head_posture)
│     ├── 1.2 头部侧倾 (head_lateral_tilt)
│     └── 1.3 头部旋转 (head_rotation)
├── 2. 肩颈 (shoulder_neck)
│     ├── 2.1 圆肩 (rounded_shoulders)
│     ├── 2.2 耸肩 (elevated_shoulders)
│     ├── 2.3 翼状肩 (winged_scapula)
│     └── 2.4 高低肩 (uneven_shoulders)
├── 3. 胸椎 (thoracic)
│     ├── 3.1 驼背/胸椎后凸增加 (thoracic_hyperkyphosis)
│     └── 3.2 胸椎平背 (thoracic_flat_back)
├── 4. 腰椎 (lumbar)
│     ├── 4.1 腰椎前凸增加 (lumbar_hyperlordosis)
│     ├── 4.2 腰椎后凸/平背 (lumbar_flat_back)
│     └── 4.3 腰椎侧弯 (lumbar_lateral_curve)
├── 5. 骨盆 (pelvis)
│     ├── 5.1 骨盆前倾 (anterior_pelvic_tilt)
│     ├── 5.2 骨盆后倾 (posterior_pelvic_tilt)
│     └── 5.3 骨盆侧倾 (lateral_pelvic_tilt)
├── 6. 脊柱整体 (spine_整体)
│     ├── 6.1 脊柱侧弯观察 (scoliosis_observation) — 严禁输出 Cobb
│     └── 6.2 矢状面失衡 (sagittal_imbalance)
├── 7. 膝关节 (knee)
│     ├── 7.1 膝超伸 (knee_hyperextension)
│     ├── 7.2 膝屈曲 (knee_flexion_posture)
│     ├── 7.3 X 型腿 (genu_valgum)
│     └── 7.4 O 型腿 (genu_varum)
├── 8. 足踝 (foot_ankle)
│     ├── 8.1 扁平足观察 (pes_planus_observation)
│     ├── 8.2 高弓足观察 (pes_cavus_observation)
│     └── 8.3 内/外八 (in/out_toeing)
└── 9. 动作质量 (movement_quality)
      ├── 9.1 单腿平衡时长
      ├── 9.2 深蹲模式
      ├── 9.3 过头深蹲 (overhead_squat)
      └── 9.4 步态对称性
```

### 4.3 JSON Schema

```json
{
  "id": "posture.observation.v1",
  "category": "shoulder_neck",
  "label_zh": "圆肩",
  "label_en": "Rounded Shoulders",
  "alias_zh": ["含胸", "肩前扣"],
  "view_required": ["lateral"],
  "severity_levels": ["none", "mild", "moderate", "severe"],
  "red_flag": false,
  "advice_text_template": "建议加强胸椎伸展与菱形肌训练，例如 {{exercises}}。每周 {{freq}}，持续 {{weeks}} 周后复评。",
  "related_indicators": ["shoulder_mobility", "thoracic_extension"],
  "source_refs": ["posture.observation.guideline.v1#shoulder_neck.2.1"]
}
```

### 4.4 红旗（必须立即转人工）

```json
[
  {"id": "red_flag.spine.rapid_progression",
   "zh": "脊柱侧弯观察短期内明显加重",
   "action": "建议在 2 周内由专业人员人工评估。",
   "severity": "high"},
  {"id": "red_flag.pain.any",
   "zh": "任何部位伴随疼痛",
   "action": "停止相关训练并就医。",
   "severity": "high"},
  {"id": "red_flag.posture.combined_severe",
   "zh": "多部位同时中重度异常",
   "action": "建议由专业人员面诊评估。",
   "severity": "medium"}
]
```

### 4.5 与 AI Agent 集成

- AI 工具 `posture_query` 返回结构化 `{observations: [{category, severity, advice_template_id, view_quality_score}]}`。
- AI 在 `synth` 阶段引用 `advice_text_template` + 训练动作库（见 §5），渲染家长可读句子。
- 严禁 AI 自由发挥："看起来像脊柱侧弯" / "角度约 X 度" / "建议手术" → 必须以知识库模板为准。

---

## 5. 训练动作库

### 5.1 动作 JSON 结构（120 个动作目标）

```json
{
  "id": "ex.single_leg_balance",
  "name_zh": "单腿平衡",
  "name_en": "Single-Leg Balance",
  "category": "balance",
  "target_muscles": ["tibialis_anterior", "peroneus", "gluteus_medius"],
  "joints": ["ankle", "knee", "hip"],
  "met_value": 2.5,
  "calories_per_minute_kg": 0.04,
  "equipment": ["none"],
  "space_m2": 1.0,
  "difficulty": "beginner",
  "applicable_age_months": [60, 216],     /* 5-18 岁 */
  "applicable_school_stages": ["primary", "junior_high", "senior_high"],
  "default_prescription": {
    "sets": 3, "reps": "20-30s/侧", "rest_s": 30, "freq_per_week": 3
  },
  "contraindications": ["red_flag.recent_injury.lower_limb"],
  "alternatives": ["ex.tandem_stance"],
  "progression_to": ["ex.single_leg_balance_eyes_closed"],
  "video_url": "https://kb.boks.local/ex/single_leg_balance/v1.mp4",
  "thumbnail_url": "https://kb.boks.local/ex/single_leg_balance/v1.jpg",
  "duration_s": 12,
  "source_refs": ["training.guideline.v1#balance.single_leg"]
}
```

### 5.2 类别覆盖（必须 12 类 ≥ 120 个）

```
1. balance              平衡（10）
2. jump                  跳跃（12）
3. core                  核心（15）
4. hip_mobility          髋关节灵活性（10）
5. shoulder_mobility     肩关节灵活性（8）
6. thoracic_extension    胸椎伸展（8）
7. posterior_chain       后链（10）
8. endurance_aerobic     有氧耐力（10）
9. coordination          协调（8）
10. breathing            呼吸（6）
11. mobility_lower       下肢灵活性（12）
12. posture_correction   体态矫正（15）
```

### 5.3 禁忌矩阵

```json
{
  "id": "contra.rapid_growth_phase",
  "zh": "青春期快速增长期（女 10-12 / 男 12-14 岁）",
  "avoid_loads": ["max_load", "olympic_lift", "long_distance_endurance > 5km"],
  "reason": "骨骺未闭合，高负荷增加损伤风险。"
},
{
  "id": "contra.osgood_schlatter",
  "zh": "胫骨结节骨骺炎（Osgood-Schlatter）",
  "avoid": ["ex.box_jump", "ex.deep_squat", "ex.running_3km"],
  "reason": "跳跃与深蹲会加重髌腱附着点应力。"
}
```

### 5.4 12 周阶段模板

```
week 1-2   入门（基础动作 + 习惯建立）
week 3-4   巩固（强度 ↑ 10%，组合动作）
week 5-6   进阶 1（专项动作：跳绳/跑步/体态矫正）
week 7-8   进阶 2（强度 ↑ 20%，加变式）
week 9-10  强化（测前微周期）
week 11    减量（恢复）
week 12    测前评估 + 报告
```

### 5.5 必须新增

| 文件 | 作用 |
|---|---|
| `data/training/actions.json` | 动作库 |
| `data/training/contraindications.json` | 禁忌 |
| `data/training/weekly_templates.json` | 模板 |
| `services/api/src/training-library.controller.ts` | 训练库 CRUD |
| `services/api/migrations/022_training_library.sql` | 表结构 |

---

## 6. 知识库元数据 schema

### 6.1 现状缺口（`migrations/001:159-176`）

```sql
CREATE TABLE boks_knowledge_sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE boks_knowledge_versions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES boks_knowledge_sources(id),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);
```

**缺**：
- `category`（政策/标准/指南/动作/案例）
- `audience`（preschool/primary/junior_high/senior_high/parent/teacher/coach）
- `language`
- `source_url`（原始来源）
- `effective_from` / `effective_to`（生效期）
- `citation_count`（被 AI 引用次数，影响优先展示）
- `embedding`（pgvector 向量，768/1024 维）
- `chunks`（切片索引）
- `reviewers` / `approvers`（与 `boks_standard_versions` 对齐）
- `sensitivity`（public / internal / restricted）

### 6.2 升级 schema

```sql
-- migrations/023_knowledge_meta.sql
ALTER TABLE boks_knowledge_versions
  ADD COLUMN category        TEXT NOT NULL DEFAULT 'guide'
    CHECK (category IN ('policy','standard','guide','action','case','faq')),
  ADD COLUMN audience        TEXT[] NOT NULL DEFAULT ARRAY['parent']::TEXT[],
  ADD COLUMN language        TEXT NOT NULL DEFAULT 'zh-CN',
  ADD COLUMN source_url      TEXT,
  ADD COLUMN effective_from  DATE,
  ADD COLUMN effective_to    DATE,
  ADD COLUMN sensitivity     TEXT NOT NULL DEFAULT 'public'
    CHECK (sensitivity IN ('public','internal','restricted')),
  ADD COLUMN reviewers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN approvers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN citation_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_review_at  TIMESTAMPTZ;

-- 向量与切片
CREATE TABLE boks_knowledge_chunks (
  id           TEXT PRIMARY KEY,
  version_id   TEXT NOT NULL REFERENCES boks_knowledge_versions(id) ON DELETE CASCADE,
  ordinal      INTEGER NOT NULL,
  section      TEXT,                   -- "评分表", "适用对象"
  content      TEXT NOT NULL,
  token_count  INTEGER NOT NULL,
  embedding    vector(1024),           -- BGE-M3
  bm25_terms   JSONB NOT NULL,         -- 分词 + 词频
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (version_id, ordinal)
);
CREATE INDEX boks_chunks_embedding_idx ON boks_knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX boks_chunks_bm25_idx ON boks_knowledge_chunks USING GIN (bm25_terms);
```

### 6.3 来源注册表（独立）

```sql
CREATE TABLE boks_source_registry (
  id              TEXT PRIMARY KEY,        -- "moe-2014-physical"
  title           TEXT NOT NULL,
  publisher       TEXT NOT NULL,           -- 教育部 / 国家体育总局 / 国家卫健委
  url             TEXT NOT NULL,
  pdf_sha256      TEXT,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('law','standard','guide','research','expert_consensus')),
  language        TEXT NOT NULL DEFAULT 'zh-CN',
  retrieved_at    TIMESTAMPTZ NOT NULL,
  effective_from  DATE,
  effective_to    DATE,
  notes           TEXT
);
```

### 6.4 必须替换

| 文件 | 旧实现 | 新实现 |
|---|---|---|
| `migrations/001_boks_store_documents.sql:159-176` | 简化表 | §6.2 完整字段 |
| `services/api/src/knowledge.controller.ts` | CRUD 简化 | 增加 chunking + embedding 入库 |
| `services/api/src/seed-knowledge.ts` | 内置 JSON seed | 从 `data/knowledge/golden_corpus_v1.jsonl` 导入 |

---

## 7. 权威来源清单与获取路径

### 7.1 必须取得并留痕（最低门槛）

| 来源 | 用途 | 取得方式 | 责任人 | 截止 |
|---|---|---|---|---|
| 教育部《国家学生体质健康标准（2014 修订）》 | 小学/初中/高中评分 | 教育部官网 + 国务院公报 | 法务+产品 | P0 上线前 |
| 教育部《标准》解读文件 | 评分细则释义 | 教育部体卫艺司 | 产品 | P0 |
| 教育部体卫艺司年度评分说明（如有更新） | 应对年份差异 | 教育部官网 | 产品 | 上线后持续 |
| WS/T 423—2022《7 岁以下儿童生长发育评价标准》 | 幼儿身高/体重 | 国家卫健委发布 | 法务 | P1 |
| GB/T 16133—2014《儿童青少年生长发育标准的修订与检验》 | 体重指数 | 国家市监总局 | 法务 | P1 |
| 国家体育总局《国民体质测定标准手册（幼儿部分）》 | 幼儿体能参考 | 国家体育总局 | 产品+法务 | P0（仅参考，不进总分） |
| WHO Child Growth Standards（2006） | 幼儿生长曲线 | WHO 官网 | 产品 | P0 |
| 中国学生发展核心素养 | 体卫融合大概念 | 教育部 | 产品 | P1 |
| WS/T 586—2018《学龄儿童青少年超重与肥胖筛查》 | BMI 切点 | 国家卫健委 | 法务 | P1 |
| 《中国儿童青少年身体活动指南》 | 训练强度建议 | 国家体育总局 | 产品 | P0 |
| WS 580—2017《0-6 岁儿童健康管理规范》 | 体检记录 | 国家卫健委 | 法务 | P1 |
| 儿童青少年脊柱弯曲异常的筛查（GB/T 等） | 体态观察参考 | 国家市监/卫健委 | 法务+AI | P1 |

### 7.2 取得流程

```
1. 法务询证：是否需要付费 / 是否需要授权 / 是否在版权保护期内
2. 取得正式 PDF（实体或官方下载）
3. sha256 校验
4. 登记到 boks_source_registry
5. 双人审核 + 法务签字
6. 进入知识库候选（status = 'draft'）
7. 24h 后进入审核（status = 'in_review'）
8. 双审核员人工确认（status = 'published'）
9. 监控 published_at + effective_to 过期
```

### 7.3 AI 引用规则

- AI 输出任何"标准号 / 文件号 / 数字阈值"必须来自 `boks_source_registry`。
- 每条引用的 `source_id + version` 必须存在于知识库 → 由输出校验（见 `docs/18` §7.4）强制。

---

## 8. 数据资产导入与双审

### 8.1 导入管线

```python
# scripts/data/import_standard.py
# scripts/data/import_actions.py
# scripts/data/import_knowledge.py
# scripts/data/import_posture_taxonomy.py
```

### 8.2 双审流程

```
stage 1: 数据工程师录入 → draft
stage 2: 数据审核员 A 校验 → in_review
stage 3: 数据审核员 B 复核 → approved（仅当 A、B 都通过）
stage 4: 自动生成 source_registry 关联 → published
stage 5: 触发 embedding + chunking 异步任务
```

### 8.3 验证关卡

- PDF 哈希 = 官方源
- 评分表 100% 档位覆盖
- 每个动作有禁忌矩阵 + 替代动作
- 每个知识文档有 ≥ 1 个 source_ref
- 每个 source_ref 在 source_registry 中存在

### 8.4 必须新增

| 文件 | 作用 |
|---|---|
| `scripts/data/import_standard.py` | 标准导入 |
| `scripts/data/import_actions.py` | 动作导入 |
| `scripts/data/import_knowledge.py` | 知识导入 |
| `scripts/data/import_posture_taxonomy.py` | 体态分类导入 |
| `scripts/data/verify_sources.py` | 来源校验 |

---

## 9. 与 AI 检索 / Agent 的集成

### 9.1 Hybrid Retriever 数据源

`docs/18` §4 的 HybridRetriever 数据源 = `boks_knowledge_chunks` 表。

**过滤条件**：
```sql
WHERE kv.status = 'published'
  AND kv.effective_from <= CURRENT_DATE
  AND (kv.effective_to IS NULL OR kv.effective_to > CURRENT_DATE)
  AND kv.sensitivity IN ('public', 'internal')
  AND audience && $audience  -- ANY match
  AND language = 'zh-CN'
```

### 9.2 Agent Tool 数据源

| Tool | 数据源 |
|---|---|
| `kb_search` | `boks_knowledge_chunks` |
| `standard_calc` | `boks_standard_versions + indicators + score_bands` |
| `standard_lookup` | 同上 |
| `posture_query` | `boks_posture_sessions + posture_assets + postureReports` + 模板库 |
| `training_query` | `boks_training_plans + check_ins + actions.json` |
| `calendar_query` | `boks_training_check_ins` |

### 9.3 体态报告生成（接 posture.controller.ts）

```
旧逻辑（posture.controller.ts:371-399）：硬编码 not_scored / insufficient_data
新逻辑：
1. 4 视角质量全部 passed → 调 AI 工具 posture_analyzer
2. AI 工具返回结构化 observations
3. 报告按模板渲染：
   - 体态观察（按 posture.observation.v1）
   - 训练建议（按 actions.json）
   - 红旗（按 red_flags.json）
   - 局限（按 limitations_glossary.json）
4. 严禁生成 Cobb 角或任何角度数值
5. 报告生成过程全量落 audit
```

### 9.4 必须新增

| 文件 | 作用 |
|---|---|
| `services/ai/src/boks_ai/tools/handlers/standard_calc.py` | 调用评分服务 |
| `services/ai/src/boks_ai/tools/handlers/posture_query.py` | 体态查询 |
| `services/ai/src/boks_ai/tools/handlers/training_query.py` | 训练查询 |
| `services/api/src/posture-template-renderer.ts` | 体态报告模板渲染 |
| `services/api/migrations/024_posture_report_template.sql` | 模板表 |

---

## 10. 落地执行（接续 17 阶段 11）

> 与 `docs/17` §阶段 11 并行扩展；**新增**任务用 `[NEW]` 标注。

| 周次 | 任务 | 交付物 | 验收 |
|---|---|---|---|
| W1 D1-3 | 取得教育部 PDF + 哈希登记 | `boks_source_registry` 首批 6 条 | 法务签字 ≥ 6 条 |
| W1 D4-5 | 小学评分表 JSON 化（迁移 1-6 年级） | `national_2014_primary.json` | 20 档 × 6 指标 × 6 年级 × 2 性别全覆盖 |
| W2 D1-2 | 初中评分表 | `national_2014_junior.json` | 同上 |
| W2 D3-4 | 高中评分表 | `national_2014_senior.json` | 同上 |
| W2 D5 | **[NEW]** BMI 分级表（小学/初中/高中分别） | 3 个 JSON | 切点与官方一致 |
| W3 D1-2 | 导入到 PG（执行 import_standard） | `boks_standard_versions` 4 条 + `score_bands` 全量 | 覆盖审核通过 |
| W3 D3 | 双人审核关卡脚本 | `scripts/data/import_standard.py` + 审核 UI | 双签记录 100% |
| W3 D4-5 | 幼儿参考库（不进总分） | `preschool_reference_3_6.json` | 仅参考提示文案就位 |
| W4 D1-3 | 体态观察分类法（9 大类 30 子类） | `posture/observation_taxonomy.json` | 子类 ≥ 30 |
| W4 D4 | 体态红旗库 | `posture/red_flags.json` | 红旗 ≥ 5 |
| W4 D5 | 体态视角拍摄规范 | `posture/view_protocols.json` | 4 视角全定义 |
| W5 D1-3 | 训练动作库 120 个 | `training/actions.json` | 12 类 × ≥ 10 个 |
| W5 D4 | 禁忌矩阵 | `training/contraindications.json` | 禁忌 ≥ 20 |
| W5 D5 | 12 周阶段模板 | `training/weekly_templates.json` | 学段 × 3 套 |
| W6 D1-3 | 知识库元数据升级 + 切片 + embedding | migration + 异步任务 | embedding 覆盖率 100% |
| W6 D4 | 来源注册表 + 双审流程 | `boks_source_registry` + 审核 UI | 来源 ≥ 12 |
| W6 D5 | **[NEW]** 知识库种子（金标语料 v1） | `golden_corpus_v1.jsonl` | ≥ 200 文档 |
| W7 D1-2 | 评估集（golden + 红队） | `data/eval/*` | ≥ 600 用例 |
| W7 D3 | 与 AI Retriever 集成 | HybridRetriever 接入 PG | Recall@6 ≥ 0.85 |
| W7 D4 | 与 Agent Tool 集成 | 5 个 Tool 上线 | Tool 成功率 ≥ 95% |
| W7 D5 | **[NEW]** 体态报告模板渲染 | `posture-template-renderer.ts` | 报告可生成 + 审计可追溯 |

**人力**：
- 1 名数据工程师 × 7 周（导入与维护）
- 1 名产品/教研 × 4 周（评分表与体态分类整理）
- 2 名审核员 × 全程（双审 Gate）
- 1 名法务 × 2 周（来源授权）
- AI 工程师（与阶段 4 复用，3 周集成）

---

## 附录 A：关键 schema 变更清单（migration 序列）

| ID | 名称 | 内容 |
|---|---|---|
| `002_seed_standards.sql` | 标准库初始化 | 写入小学/初中/高中 + BMI |
| `003_seed_posture_taxonomy.sql` | 体态分类 | 写入观察分类 + 红旗 |
| `004_seed_training_actions.sql` | 训练动作 | 写入 120 动作 + 禁忌 + 模板 |
| `005_knowledge_meta_v2.sql` | 知识库元数据 | §6.2 字段 |
| `006_knowledge_chunks.sql` | 切片 + 向量 | §6.2 |
| `007_source_registry.sql` | 来源注册表 | §6.3 |
| `008_posture_report_template.sql` | 体态报告模板 | §9.4 |
| `009_prompt_registry.sql` | Prompt 版本表 | `docs/18` §3.3 |
| `010_llm_usage.sql` | LLM 用量与成本 | `docs/18` §9.3 |
| `011_audit_trail_v2.sql` | 审计扩展 | 体态/训练/对话 trace |

---

> **下一步**：本方案审批后，启动阶段 11 第一周（取得 PDF）；4 周后完成小学/初中/高中评分表上线；8 周后 AI Agent 与新数据资产联调上线。