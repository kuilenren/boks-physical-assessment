import { randomUUID } from "node:crypto";
import type {
  AssessmentReport,
  AssessmentSchema,
  AssessmentSessionStatus,
  AssessmentValue,
  Child,
  PostureSession,
  PostureView,
  ScoreResult,
  TrainingPlan,
} from "@boks/contracts";

export const DEMO_STANDARD_VERSION = "std-demo-primary-2014-v0";
export const DEMO_STANDARD_NAME = "国家学生体质健康标准（2014年修订）·开发夹具";
export const DEMO_KNOWLEDGE_SNAPSHOT = "knowledge-demo-pending-review-v0";

const nowDate = new Date();
const today = nowDate.toISOString().slice(0, 10);

function ageInMonths(birthDate: string, measurementDate = today): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const measurement = new Date(`${measurementDate}T00:00:00Z`);
  let months =
    (measurement.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    measurement.getUTCMonth() -
    birth.getUTCMonth();
  if (measurement.getUTCDate() < birth.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function buildChild(
  input: Omit<Child, "id" | "age_in_months" | "profile_status">,
): Child {
  return {
    ...input,
    id: randomUUID(),
    age_in_months: ageInMonths(input.birth_date),
    profile_status: "active",
  };
}

const demoChild: Child = {
  id: "child-demo-001",
  display_name: "小朋友",
  birth_date: "2018-04-12",
  age_in_months: ageInMonths("2018-04-12"),
  sex_code: "female",
  school_stage: "primary",
  grade_code: "grade_2",
  profile_status: "active",
};

export const children: Child[] = [demoChild];
export const assessmentSessions = new Map<
  string,
  {
    id: string;
    child_id: string;
    measurement_date: string;
    standard_version_id: string;
    status: AssessmentSessionStatus;
    test_status: "completed" | "makeup" | "exempt" | "deferred";
    values: AssessmentValue[];
    report_id: string | null;
  }
>();
export const reports = new Map<string, AssessmentReport>();
export const trainingPlans = new Map<string, TrainingPlan>();
export const postureSessions = new Map<string, PostureSession>();
export const postureAssets = new Map<string, string>();

export function getChild(childId: string): Child | undefined {
  return children.find(
    (child) => child.id === childId && child.profile_status === "active",
  );
}

export function getAssessmentSchema(
  child: Child,
  measurementDate: string,
): AssessmentSchema {
  const isPreschool = child.school_stage === "preschool";
  return {
    standard_version_id: isPreschool
      ? "ref-demo-preschool-development-v0"
      : DEMO_STANDARD_VERSION,
    standard_name: isPreschool
      ? "幼儿体能发展目标参考·开发夹具"
      : DEMO_STANDARD_NAME,
    standard_status: "demo_pending_review",
    measurement_date: measurementDate,
    child_id: child.id,
    mode: isPreschool ? "reference_only" : "scored",
    indicators: isPreschool
      ? [
          {
            indicator_code: "balance_single_leg",
            label: "单脚站立",
            unit: "秒",
            input_type: "decimal",
            min_value: 0,
            max_value: 120,
            step: 0.1,
            required: true,
            help_text: "保持自然站立，记录最长稳定时间。",
          },
          {
            indicator_code: "jump_forward",
            label: "立定跳远",
            unit: "厘米",
            input_type: "decimal",
            min_value: 0,
            max_value: 300,
            step: 0.1,
            required: true,
            help_text: "双脚起跳，记录脚后跟最近落点。",
          },
        ]
      : [
          {
            indicator_code: "height",
            label: "身高",
            unit: "厘米",
            input_type: "decimal",
            min_value: 80,
            max_value: 220,
            step: 0.1,
            required: true,
            help_text: "脱鞋、站直，视线平行。",
          },
          {
            indicator_code: "weight",
            label: "体重",
            unit: "千克",
            input_type: "decimal",
            min_value: 10,
            max_value: 160,
            step: 0.1,
            required: true,
            help_text: "穿轻薄衣物测量，记录到 0.1 千克。",
          },
          {
            indicator_code: "run_50m",
            label: "50 米跑",
            unit: "秒",
            input_type: "decimal",
            min_value: 5,
            max_value: 30,
            step: 0.1,
            required: true,
            help_text: "记录最好一次成绩，数值越小越好。",
          },
          {
            indicator_code: "sit_reach",
            label: "坐位体前屈",
            unit: "厘米",
            input_type: "decimal",
            min_value: -30,
            max_value: 60,
            step: 0.1,
            required: true,
            help_text: "双腿伸直，缓慢前伸，不要弹动。",
          },
          {
            indicator_code: "rope_1min",
            label: "一分钟跳绳",
            unit: "次",
            input_type: "integer",
            min_value: 0,
            max_value: 300,
            step: 1,
            required: true,
            help_text: "连续一分钟内完成的有效次数。",
          },
        ],
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreIndicator(code: string, value: number): number | null {
  switch (code) {
    case "run_50m":
      return clamp(60 + (12.5 - value) * 13.3333, 0, 100);
    case "sit_reach":
      return clamp(60 + (value - 5) * 2.6667, 0, 100);
    case "rope_1min":
      return clamp(60 + (value - 50) * 0.8, 0, 100);
    default:
      return null;
  }
}

export function calculateResults(
  schema: AssessmentSchema,
  values: AssessmentValue[],
  testStatus: "completed" | "makeup" | "exempt" | "deferred",
): {
  results: ScoreResult[];
  totalScore: number | null;
  level: AssessmentReport["level"];
  completeness: number;
  priorityActions: string[];
} {
  const valueByCode = new Map(
    values.map((value) => [value.indicator_code, value]),
  );
  const scoredCodes = new Set(["run_50m", "sit_reach", "rope_1min"]);
  const weights: Record<string, number> = {
    run_50m: 0.35,
    sit_reach: 0.25,
    rope_1min: 0.4,
  };
  const results = schema.indicators.map((indicator) => {
    const submitted = valueByCode.get(indicator.indicator_code);
    const numericValue = submitted ? Number(submitted.raw_value) : NaN;
    const valid =
      submitted !== undefined &&
      Number.isFinite(numericValue) &&
      numericValue >= indicator.min_value &&
      numericValue <= indicator.max_value;
    const canScore =
      schema.mode === "scored" &&
      scoredCodes.has(indicator.indicator_code) &&
      valid &&
      testStatus !== "exempt";
    const score = canScore
      ? scoreIndicator(indicator.indicator_code, numericValue)
      : null;
    const weight = weights[indicator.indicator_code] ?? 0;
    const contribution = score === null ? 0 : score * weight;
    return {
      indicator_code: indicator.indicator_code,
      label: indicator.label,
      raw_value: submitted?.raw_value ?? "",
      unit: indicator.unit,
      score,
      weight,
      contribution: Number(contribution.toFixed(2)),
      interpretation:
        score === null
          ? schema.mode === "reference_only"
            ? "记录用于成长观察，不进入国家总评。"
            : "该项目尚未形成可评分结果，请补充合法数据。"
          : score >= 80
            ? "当前表现可继续保持。"
            : "可作为下一阶段的优先练习方向。",
      status:
        !valid && submitted !== undefined
          ? "needs_review"
          : score === null
            ? schema.mode === "reference_only"
              ? "reference_only"
              : "missing"
            : "scored",
    } satisfies ScoreResult;
  });
  const requiredCount = schema.indicators.filter(
    (indicator) => indicator.required,
  ).length;
  const completeCount = results.filter(
    (result) => result.raw_value.length > 0 && result.status !== "needs_review",
  ).length;
  const completeness = requiredCount === 0 ? 1 : completeCount / requiredCount;
  const scored = results.filter((result) => result.score !== null);
  const totalScore =
    schema.mode === "scored" && scored.length > 0
      ? Number(
          scored
            .reduce((sum, result) => sum + result.contribution, 0)
            .toFixed(1),
        )
      : null;
  const level =
    schema.mode === "reference_only" || totalScore === null
      ? "reference_only"
      : totalScore >= 90
        ? "excellent"
        : totalScore >= 80
          ? "good"
          : totalScore >= 60
            ? "pass"
            : "fail";
  const priorityActions = results
    .filter((result) => result.score !== null && result.score < 80)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 3)
    .map((result) => `优先练习：${result.label}`);
  return { results, totalScore, level, completeness, priorityActions };
}

export function createAssessmentReport(
  sessionId: string,
  child: Child,
  schema: AssessmentSchema,
  values: AssessmentValue[],
  testStatus: "completed" | "makeup" | "exempt" | "deferred",
): AssessmentReport {
  const calculated = calculateResults(schema, values, testStatus);
  const report: AssessmentReport = {
    id: randomUUID(),
    report_type: "assessment",
    child_id: child.id,
    status: "ready",
    measurement_date: schema.measurement_date,
    standard_version_id: schema.standard_version_id,
    standard_name: schema.standard_name,
    standard_status: schema.standard_status,
    algorithm_version: "assessment-demo-rule-0.1",
    knowledge_snapshot_id: DEMO_KNOWLEDGE_SNAPSHOT,
    mode: schema.mode,
    total_score: calculated.totalScore,
    level: calculated.level,
    completeness: calculated.completeness,
    priority_actions: calculated.priorityActions,
    results: calculated.results,
    limitations: [
      "当前 API 使用开发夹具，标准原文和评分表完成审核后才能进入生产。",
      "本报告用于产品联调，不构成医疗建议或诊断。",
    ],
    source_references: [
      {
        title: "国家学生体质健康标准（2014年修订）·待审核开发夹具",
        official_url:
          "https://www.gov.cn/gongbao/content/2014/content_2781929.htm",
      },
    ],
    generated_at: new Date().toISOString(),
  };
  reports.set(report.id, report);
  const session = assessmentSessions.get(sessionId);
  if (session) {
    session.status = "reported";
    session.report_id = report.id;
  }
  return report;
}

export function createTrainingPlan(
  childId: string,
  sourceReportId: string | null,
  goal: string,
  durationWeeks: number,
  daysPerWeek: number,
  minutesPerSession: number,
): TrainingPlan {
  const items: TrainingPlan["items"] = [];
  const exerciseSets = [
    {
      phase: "warmup" as const,
      exercise_name: "趣味热身走",
      duration_minutes: 4,
      sets: 1,
      repetitions: null,
      safety_note: "保持可以正常说话的强度。",
      stop_condition: "出现疼痛、头晕或呼吸不适立即停止。",
    },
    {
      phase: "main" as const,
      exercise_name: goal.includes("耐力") ? "节奏跑走交替" : "基础协调跳",
      duration_minutes: Math.max(5, minutesPerSession - 10),
      sets: 2,
      repetitions: 10,
      safety_note: "动作稳定优先，不追求速度和数量。",
      stop_condition: "出现疼痛、麻木、无力或明显不适立即停止。",
    },
    {
      phase: "cooldown" as const,
      exercise_name: "呼吸放松与轻柔拉伸",
      duration_minutes: 4,
      sets: 1,
      repetitions: null,
      safety_note: "只做到舒适牵拉，不弹动、不强压。",
      stop_condition: "任何不适都应停止并告诉监护人。",
    },
  ];
  for (let week = 1; week <= durationWeeks; week += 1) {
    for (let day = 1; day <= daysPerWeek; day += 1) {
      for (const exercise of exerciseSets) {
        items.push({
          id: randomUUID(),
          week,
          day,
          ...exercise,
        });
      }
    }
  }
  const plan: TrainingPlan = {
    id: randomUUID(),
    child_id: childId,
    source_report_id: sourceReportId,
    goal,
    duration_weeks: durationWeeks,
    days_per_week: daysPerWeek,
    minutes_per_session: minutesPerSession,
    status: "active",
    safety_confirmed: true,
    items,
    content_version: "training-demo-content-0.1",
  };
  trainingPlans.set(plan.id, plan);
  return plan;
}

export function createPostureSession(
  childId: string,
  consentRecordId: string,
  captureProtocolVersion: string,
  requiredViews: PostureView[],
): PostureSession {
  const views = Object.fromEntries(
    requiredViews.map((view) => [
      view,
      { status: "pending" as const, score: null, reasons: [] },
    ]),
  ) as PostureSession["quality"]["views"];
  const session: PostureSession = {
    id: randomUUID(),
    child_id: childId,
    status: "draft",
    required_views: requiredViews,
    attached_views: [],
    quality: {
      overall: "pending",
      views,
    },
    analysis: null,
    limitations: [
      "普通照片不能诊断疾病，也不能替代影像检查或专业评估。",
      "当前版本只验证四视角任务完整性，未接入生产姿态模型。",
    ],
    consent_record_id: consentRecordId,
    capture_protocol_version: captureProtocolVersion,
  };
  postureSessions.set(session.id, session);
  return session;
}
