/**
 * 多家庭 / 多学段 / 多场景 Seed 数据（写入 demo JSON store）
 * 覆盖：小学 1-6、初中 7-9、高中 10-12、幼儿 3-6 各 ≥ 1 个家庭；
 * 每个家庭 ≥ 1 个儿童，体测 / 训练 / 体态 / 对话多场景；
 * ID 稳定，便于回归测试断言。
 */
import { randomUUID } from "node:crypto";
import { loadFamilyStore, updateFamilyStore } from "./demo-store.js";

// seed 数据用 any 类型注入（contracts 类型约束严格，seed 仅关心持久化）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const NOW = new Date().toISOString();

type SeedChild = {
  id: string;
  display_name: string;
  birth_date: string;
  sex_code: "male" | "female";
  school_stage: "preschool" | "primary" | "junior_high" | "senior_high";
  grade_code: string;
};

const FAMILY_DEFS: Array<{
  id: string;
  display_name: string;
  children: SeedChild[];
}> = [
  {
    id: "family-primary-low-001",
    display_name: "张家（小学低段）",
    children: [
      {
        id: "child-001",
        display_name: "张一",
        birth_date: "2019-09-01",
        sex_code: "male",
        school_stage: "primary",
        grade_code: "2",
      },
    ],
  },
  {
    id: "family-primary-high-002",
    display_name: "李家（小学高段）",
    children: [
      {
        id: "child-002",
        display_name: "李二",
        birth_date: "2014-03-12",
        sex_code: "female",
        school_stage: "primary",
        grade_code: "5",
      },
    ],
  },
  {
    id: "family-junior-003",
    display_name: "王家（初中）",
    children: [
      {
        id: "child-003",
        display_name: "王三",
        birth_date: "2010-07-22",
        sex_code: "male",
        school_stage: "junior_high",
        grade_code: "8",
      },
    ],
  },
  {
    id: "family-senior-004",
    display_name: "赵家（高中）",
    children: [
      {
        id: "child-004",
        display_name: "赵四",
        birth_date: "2007-11-05",
        sex_code: "female",
        school_stage: "senior_high",
        grade_code: "11",
      },
    ],
  },
  {
    id: "family-preschool-005",
    display_name: "钱家（幼儿）",
    children: [
      {
        id: "child-005",
        display_name: "钱五",
        birth_date: "2021-04-18",
        sex_code: "female",
        school_stage: "preschool",
        grade_code: "kindergarten-2",
      },
    ],
  },
  {
    id: "family-multi-006",
    display_name: "孙家（多子女）",
    children: [
      {
        id: "child-006",
        display_name: "孙六",
        birth_date: "2013-08-30",
        sex_code: "male",
        school_stage: "primary",
        grade_code: "4",
      },
      {
        id: "child-007",
        display_name: "孙七",
        birth_date: "2011-02-14",
        sex_code: "female",
        school_stage: "junior_high",
        grade_code: "7",
      },
    ],
  },
];

function runForStage(
  grade: string,
  sex: "male" | "female",
  stage: SeedChild["school_stage"],
): Array<{ indicator_code: string; raw_value: string }> {
  if (stage === "preschool") return [];
  if (stage === "primary") {
    const g = parseInt(grade);
    const age = 6 + g;
    return [
      {
        indicator_code: "height",
        raw_value: String(110 + age * 5 + (sex === "male" ? 2 : 0)),
      },
      {
        indicator_code: "weight",
        raw_value: String(19 + age * 2.2 + (sex === "male" ? 0.8 : 0)),
      },
      {
        indicator_code: "run_50m",
        raw_value: String((sex === "male" ? 10.0 : 10.6) + g * 0.3),
      },
      {
        indicator_code: "sit_reach",
        raw_value: String((sex === "male" ? 8 : 12) + g),
      },
      {
        indicator_code: "rope_1min",
        raw_value: String((sex === "male" ? 80 : 75) + g * 5),
      },
      { indicator_code: "lung_capacity", raw_value: String(800 + g * 100) },
    ];
  }
  if (stage === "junior_high") {
    return [
      {
        indicator_code: "height",
        raw_value: String(sex === "male" ? 160 : 158),
      },
      { indicator_code: "weight", raw_value: String(sex === "male" ? 50 : 47) },
      {
        indicator_code: "run_50m",
        raw_value: String(sex === "male" ? 8.0 : 8.6),
      },
      {
        indicator_code: "sit_reach",
        raw_value: String(sex === "male" ? 8 : 11),
      },
      {
        indicator_code: "rope_1min",
        raw_value: String(sex === "male" ? 160 : 155),
      },
      { indicator_code: "lung_capacity", raw_value: "3000" },
      {
        indicator_code: "standing_jump",
        raw_value: String(sex === "male" ? 200 : 175),
      },
      ...(sex === "male"
        ? [{ indicator_code: "pull_up", raw_value: "3" }]
        : [{ indicator_code: "sit_up", raw_value: "30" }]),
      {
        indicator_code: "endurance_run",
        raw_value: String(sex === "male" ? 270 : 250),
      },
    ];
  }
  return [
    { indicator_code: "height", raw_value: String(sex === "male" ? 173 : 162) },
    { indicator_code: "weight", raw_value: String(sex === "male" ? 62 : 53) },
    {
      indicator_code: "run_50m",
      raw_value: String(sex === "male" ? 7.3 : 8.0),
    },
    {
      indicator_code: "sit_reach",
      raw_value: String(sex === "male" ? 10 : 13),
    },
    {
      indicator_code: "rope_1min",
      raw_value: String(sex === "male" ? 180 : 170),
    },
    { indicator_code: "lung_capacity", raw_value: "4000" },
    {
      indicator_code: "standing_jump",
      raw_value: String(sex === "male" ? 235 : 190),
    },
    ...(sex === "male"
      ? [{ indicator_code: "pull_up", raw_value: "6" }]
      : [{ indicator_code: "sit_up", raw_value: "38" }]),
    {
      indicator_code: "endurance_run",
      raw_value: String(sex === "male" ? 240 : 230),
    },
  ];
}

export function seedExtendedFamilies(): {
  families: number;
  children: number;
  assessments: number;
  trainings: number;
  postures: number;
  conversations: number;
} {
  const counts = {
    families: 0,
    children: 0,
    assessments: 0,
    trainings: 0,
    postures: 0,
    conversations: 0,
  };

  for (const f of FAMILY_DEFS) {
    const existing = loadFamilyStore(f.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exChildren = (existing as any).children ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exSessions = (existing as any).assessmentSessions ?? {};
    if (
      exChildren.filter((c: { family_id: string }) => c.family_id === f.id)
        .length > 0 &&
      Object.keys(exSessions).length > 0
    ) {
      continue;
    }

    updateFamilyStore(f.id, (family) => {
      // 注册家庭 record（dev-login 与 familyExists 检查依赖）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(family as any).families) (family as any).families = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(family as any).families[f.id]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (family as any).families[f.id] = {
          id: f.id,
          display_name: f.display_name,
          status: "active",
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (family as any).metadata = {
        ...((family as any).metadata ?? {}),
        seeded: true,
        seeded_at: NOW,
      };

      // 确保 children 数组存在
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(family as any).children) (family as any).children = [];

      for (const sc of f.children) {
        const child = {
          id: sc.id,
          family_id: f.id,
          display_name: sc.display_name,
          birth_date: sc.birth_date,
          sex_code: sc.sex_code,
          school_stage: sc.school_stage,
          grade_code: sc.grade_code,
          profile_status: "active" as const,
          payload: {},
          created_at: NOW,
          updated_at: NOW,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exists = (family as any).children.find(
          (c: { id: string }) => c.id === sc.id,
        );
        if (!exists) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (family as any).children.push(child);
          counts.children++;
        }

        // 体测
        const values = runForStage(sc.grade_code, sc.sex_code, sc.school_stage);
        if (values.length > 0) {
          const sessionId = `as-${sc.id}-seed`;
          if (!(family as any).assessmentSessions)
            (family as any).assessmentSessions = {};
          if (!(family as any).assessmentSessions[sessionId]) {
            (family as any).assessmentSessions[sessionId] = {
              id: sessionId,
              family_id: f.id,
              child_id: sc.id,
              standard_version_id: "std-national-primary-2014-v1",
              measurement_date: NOW.slice(0, 10),
              status: "completed",
              values,
              created_at: NOW,
              updated_at: NOW,
            };
            counts.assessments++;
          }
          const reportId = `ar-${sc.id}-seed`;
          if (!(family as any).reports) (family as any).reports = {};
          if (!(family as any).reports[reportId]) {
            (family as any).reports[reportId] = {
              id: reportId,
              family_id: f.id,
              child_id: sc.id,
              measurement_date: NOW.slice(0, 10),
              standard_version_id: "std-national-primary-2014-v1",
              total_score: 78.5,
              created_at: NOW,
            };
          }
        }

        // 训练计划 + 14 天打卡
        const planId = `tp-${sc.id}-seed`;
        if (!(family as any).trainingPlans) (family as any).trainingPlans = {};
        if (
          !(family as any).trainingPlans[planId] &&
          sc.school_stage !== "preschool"
        ) {
          (family as any).trainingPlans[planId] = {
            id: planId,
            family_id: f.id,
            child_id: sc.id,
            status: "active",
            duration_days: 84,
            weekly_template: [
              "balance",
              "core",
              "jump",
              "endurance",
              "stretch",
              "rest",
              "rest",
            ],
            created_at: NOW,
            updated_at: NOW,
          };
          counts.trainings++;
          if (!(family as any).checkIns) (family as any).checkIns = {};
          for (let day = 1; day <= 14; day++) {
            const ciId = `ci-${planId}-${day}`;
            (family as any).checkIns[ciId] = {
              id: ciId,
              family_id: f.id,
              plan_id: planId,
              child_id: sc.id,
              day,
              status:
                day % 7 === 0 ? "skipped" : day % 3 === 0 ? "partial" : "done",
              created_at: NOW,
            };
          }
        }

        // 体态（部分家庭）
        if (
          [
            "family-primary-low-001",
            "family-junior-003",
            "family-multi-006",
          ].includes(f.id)
        ) {
          const psId = `ps-${sc.id}-seed`;
          if (!(family as any).postureSessions)
            (family as any).postureSessions = {};
          if (!(family as any).postureSessions[psId]) {
            (family as any).postureSessions[psId] = {
              id: psId,
              family_id: f.id,
              child_id: sc.id,
              status: "completed",
              required_views: ["front", "back", "left", "right"],
              quality: {
                overall: "passed",
                views: {
                  front: { status: "passed", score: 0.88, reasons: [] },
                  back: { status: "passed", score: 0.91, reasons: [] },
                  left: { status: "passed", score: 0.85, reasons: [] },
                  right: { status: "passed", score: 0.87, reasons: [] },
                },
              },
              created_at: NOW,
              updated_at: NOW,
            };
            if (!(family as any).postureAssets)
              (family as any).postureAssets = {};
            for (const v of ["front", "back", "left", "right"] as const) {
              (family as any).postureAssets[`pa-${psId}-${v}`] = {
                id: `pa-${psId}-${v}`,
                family_id: f.id,
                session_id: psId,
                view_code: v,
                storage_key: `runtime/posture-assets/${psId}-${v}.jpg`,
                checksum_sha256: randomUUID().replace(/-/g, ""),
                size_bytes: 524288,
                mime_type: "image/jpeg",
                captured_at: NOW,
                quality_status: "passed",
                quality_score: 0.88,
              };
            }
            if (!(family as any).postureReports)
              (family as any).postureReports = {};
            const prId = `pr-${psId}`;
            (family as any).postureReports[prId] = {
              id: prId,
              family_id: f.id,
              session_id: psId,
              child_id: sc.id,
              risk_level: "not_scored",
              observation_status: "insufficient_data",
              confidence: "low",
              observations: [
                "四视角任务质量通过，但当前没有真实姿态模型，无法测量或确认风险。",
              ],
              recommendations: [
                "建议在自然光下按同一拍摄协议复拍；如有持续不适，请由专业人员人工复核。",
              ],
              limitations: [
                "非诊断性观察，不输出角度、骨骼测量或疾病结论。",
                "照片不会写入日志。",
              ],
              generated_at: NOW,
            };
            counts.postures++;
          }
        }

        // 对话
        if (!(family as any).conversations) (family as any).conversations = {};
        const cvId = `cv-${sc.id}-seed`;
        if (
          !(family as any).conversations[cvId] &&
          sc.school_stage !== "preschool"
        ) {
          (family as any).conversations[cvId] = {
            id: cvId,
            family_id: f.id,
            child_id: sc.id,
            context_report_id: `ar-${sc.id}-seed`,
            context_plan_id: `tp-${sc.id}-seed`,
            title: "如何提升跳绳成绩？",
            created_at: NOW,
            updated_at: NOW,
            messages: [
              {
                id: randomUUID(),
                role: "user",
                content: "我家孩子 1 分钟跳绳只能跳 80 个，怎么训练？",
                citations: [],
                created_at: NOW,
              },
              {
                id: randomUUID(),
                role: "assistant",
                content:
                  "1 分钟跳绳 80 个属于中等水平，建议先以 5 天为一周期训练协调性和耐力：BOKS 平台已根据该年龄评分表给出参考。训练动作包含双脚交替跳、开合跳、节奏控制练习。如出现膝关节或脚踝不适请暂停训练并咨询专业人员。",
                citations: [
                  {
                    source_id: "src-national-2014-standard",
                    title: "国家学生体质健康标准（2014）",
                    version: "2014修订",
                  },
                  {
                    source_id: "src-training-safety",
                    title: "儿童体测训练安全",
                    version: "1.0",
                  },
                ],
                created_at: NOW,
              },
            ],
          };
          counts.conversations++;
        }
      }
      counts.families++;
    });
  }
  return counts;
}
