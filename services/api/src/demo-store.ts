import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
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
export const ALGORITHM_VERSION = "assessment-config-rule-1.0";

export type AssessmentRule = {
  indicator_code: string;
  score_type: "higher_is_better" | "lower_is_better";
  baseline: number;
  points_per_unit: number;
  weight: number;
};
export type StandardConfiguration = {
  id: string;
  name: string;
  status: "approved" | "demo_pending_review";
  mode: "scored" | "reference_only";
  indicators: AssessmentSchema["indicators"];
  rules: AssessmentRule[];
  source_references: Array<{ title: string; official_url: string }>;
};
export type StoreConfiguration = {
  active_standard_id: string;
  algorithm_version: string;
  knowledge_snapshot_id: string;
  standards: StandardConfiguration[];
  candidates: StandardConfiguration[];
  history: StandardConfiguration[];
};
export type GuardianSession = {
  token: string;
  guardian_id: string;
  family_id: string;
  created_at: string;
  expires_at: string;
};
export type Consent = {
  id: string;
  family_id: string;
  child_id: string;
  purpose: "privacy" | "assessment" | "photo" | "voice";
  version: string;
  granted: boolean;
  granted_at: string;
  withdrawn_at: string | null;
};
export type TrainingCheckIn = {
  id: string;
  plan_id: string;
  child_id: string;
  day: number;
  status: "completed" | "skipped";
  note: string | null;
  created_at: string;
};
export type PostureAsset = {
  id: string;
  session_id: string;
  view: PostureView;
  metadata: { mime_type: string; size_bytes: number; captured_at: string };
};
export type PostureReport = {
  id: string;
  report_type: "posture";
  child_id: string;
  session_id: string;
  risk_level: "A" | "B" | "C" | "D";
  observation_status: "insufficient_data" | "observed";
  confidence: "low" | "medium" | "high";
  observations: string[];
  recommendations: string[];
  limitations: string[];
  generated_at: string;
};
export type ChatCitation = {
  source_id: string;
  title: string;
  version: string;
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  created_at: string;
};
export type ChatConversation = {
  id: string;
  family_id: string;
  child_id: string | null;
  context_report_id: string | null;
  context_plan_id: string | null;
  messages: ChatMessage[];
  created_at: string;
};
export type KnowledgeVersion = {
  id: string;
  source_id: string;
  version: string;
  title: string;
  content: string;
  status: "candidate" | "published" | "withdrawn";
  reviewers: string[];
  published_at: string | null;
};
export type KnowledgeSource = {
  id: string;
  title: string;
  owner: string;
  created_at: string;
};
export type AuditEvent = {
  id: string;
  action: string;
  actor: string;
  created_at: string;
};
export type DeletionRequest = {
  id: string;
  family_id: string;
  child_id: string;
  status: "requested" | "completed";
  created_at: string;
};
export type AssessmentSession = {
  id: string;
  child_id: string;
  measurement_date: string;
  standard_version_id: string;
  status: AssessmentSessionStatus;
  test_status: "completed" | "makeup" | "exempt" | "deferred";
  values: AssessmentValue[];
  report_id: string | null;
};
export type BoksStore = {
  family_id: string;
  children: Child[];
  assessmentSessions: Record<string, AssessmentSession>;
  reports: Record<string, AssessmentReport>;
  trainingPlans: Record<string, TrainingPlan>;
  postureSessions: Record<string, PostureSession>;
  postureAssets: Record<string, PostureAsset>;
  postureReports: Record<string, PostureReport>;
  sessions: Record<string, GuardianSession>;
  consents: Record<string, Consent>;
  checkIns: Record<string, TrainingCheckIn>;
  conversations: Record<string, ChatConversation>;
  knowledgeSources: Record<string, KnowledgeSource>;
  knowledgeVersions: Record<string, KnowledgeVersion>;
  auditEvents: AuditEvent[];
  deletionRequests: DeletionRequest[];
  configuration: StoreConfiguration;
};

const filePath =
  process.env.BOKS_DATA_FILE ?? join(process.cwd(), "data", "boks-store.json");
let writeQueue: Promise<void> = Promise.resolve();
const iso = () => new Date().toISOString();
const today = new Date().toISOString().slice(0, 10);
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

const indicators = [
  {
    indicator_code: "height",
    label: "身高",
    unit: "厘米",
    input_type: "decimal" as const,
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
    input_type: "decimal" as const,
    min_value: 10,
    max_value: 160,
    step: 0.1,
    required: true,
    help_text: "穿轻薄衣物测量。",
  },
  {
    indicator_code: "run_50m",
    label: "50 米跑",
    unit: "秒",
    input_type: "decimal" as const,
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
    input_type: "decimal" as const,
    min_value: -30,
    max_value: 60,
    step: 0.1,
    required: true,
    help_text: "双腿伸直，缓慢前伸。",
  },
  {
    indicator_code: "rope_1min",
    label: "一分钟跳绳",
    unit: "次",
    input_type: "integer" as const,
    min_value: 0,
    max_value: 300,
    step: 1,
    required: true,
    help_text: "连续一分钟内有效次数。",
  },
];
const preschoolIndicators = [
  {
    indicator_code: "balance_single_leg",
    label: "单脚站立",
    unit: "秒",
    input_type: "decimal" as const,
    min_value: 0,
    max_value: 120,
    step: 0.1,
    required: true,
    help_text: "记录最长稳定时间。",
  },
  {
    indicator_code: "jump_forward",
    label: "立定跳远",
    unit: "厘米",
    input_type: "decimal" as const,
    min_value: 0,
    max_value: 300,
    step: 0.1,
    required: true,
    help_text: "记录脚后跟最近落点。",
  },
];
const standard = (
  id: string,
  name: string,
  mode: "scored" | "reference_only",
  list: typeof indicators,
): StandardConfiguration => ({
  id,
  name,
  status: "demo_pending_review",
  mode,
  indicators: list,
  rules: [
    {
      indicator_code: "run_50m",
      score_type: "lower_is_better" as const,
      baseline: 12.5,
      points_per_unit: 13.3333,
      weight: 0.35,
    },
    {
      indicator_code: "sit_reach",
      score_type: "higher_is_better" as const,
      baseline: 5,
      points_per_unit: 2.6667,
      weight: 0.25,
    },
    {
      indicator_code: "rope_1min",
      score_type: "higher_is_better" as const,
      baseline: 50,
      points_per_unit: 0.8,
      weight: 0.4,
    },
  ].filter((rule) =>
    list.some((item) => item.indicator_code === rule.indicator_code),
  ),
  source_references: [
    {
      title: "开发夹具来源（待审核）",
      official_url:
        "https://www.gov.cn/gongbao/content/2014/content_2781929.htm",
    },
  ],
});
const defaultConfiguration: StoreConfiguration = {
  active_standard_id: DEMO_STANDARD_VERSION,
  algorithm_version: ALGORITHM_VERSION,
  knowledge_snapshot_id: DEMO_KNOWLEDGE_SNAPSHOT,
  standards: [
    standard(DEMO_STANDARD_VERSION, DEMO_STANDARD_NAME, "scored", indicators),
    standard(
      "ref-demo-preschool-development-v0",
      "幼儿体能发展目标参考·开发夹具",
      "reference_only",
      preschoolIndicators,
    ),
  ],
  candidates: [],
  history: [],
};
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
function emptyStore(): BoksStore {
  return {
    family_id: "family-demo-001",
    children: [demoChild],
    assessmentSessions: {},
    reports: {},
    trainingPlans: {},
    postureSessions: {},
    postureAssets: {},
    postureReports: {},
    sessions: {},
    consents: {},
    checkIns: {},
    conversations: {},
    knowledgeSources: {},
    knowledgeVersions: {},
    auditEvents: [],
    deletionRequests: [],
    configuration: structuredClone(defaultConfiguration),
  };
}
function loadStore(): BoksStore {
  try {
    if (existsSync(filePath)) {
      const loaded = JSON.parse(
        readFileSync(filePath, "utf8"),
      ) as Partial<BoksStore>;
      return {
        ...emptyStore(),
        ...loaded,
        configuration: {
          ...defaultConfiguration,
          ...(loaded.configuration ?? {}),
        },
      };
    }
  } catch {
    // A corrupt local demo file is replaced with a safe seed.
  }
  const seeded = emptyStore();
  persistStore(seeded);
  return seeded;
}
export let store: BoksStore = loadStore();
export const children = store.children;
export const postureReports = store.postureReports;
export const assessmentSessions = new Map<string, AssessmentSession>();
export const reports = new Map<string, AssessmentReport>();
export const trainingPlans = new Map<string, TrainingPlan>();
export const postureSessions = new Map<string, PostureSession>();
export const postureAssets = new Map<string, string>();
for (const [id, value] of Object.entries(store.assessmentSessions))
  assessmentSessions.set(id, value);
for (const [id, value] of Object.entries(store.reports)) reports.set(id, value);
for (const [id, value] of Object.entries(store.trainingPlans))
  trainingPlans.set(id, value);
for (const [id, value] of Object.entries(store.postureSessions))
  postureSessions.set(id, value);
for (const [id, value] of Object.entries(store.postureAssets))
  postureAssets.set(id, value.view);
function snapshot(): BoksStore {
  store.children = children;
  store.assessmentSessions = Object.fromEntries(assessmentSessions);
  store.reports = Object.fromEntries(reports);
  store.trainingPlans = Object.fromEntries(trainingPlans);
  store.postureSessions = Object.fromEntries(postureSessions);
  store.postureAssets = Object.fromEntries([
    ...(store.postureAssets ? Object.entries(store.postureAssets) : []),
    ...[...postureAssets]
      .filter(([id]) => !store.postureAssets[id])
      .map(([id, view]) => [
        id,
        {
          id,
          session_id: "",
          view: view as PostureView,
          metadata: { mime_type: "image/*", size_bytes: 0, captured_at: iso() },
        } as PostureAsset,
      ]),
  ]);
  return store;
}
export function persistStore(next = snapshot()): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const directory = dirname(filePath);
    mkdirSync(directory, { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(next, null, 2), "utf8");
    renameSync(temp, filePath);
  });
  return writeQueue;
}
export function resetDemoStore(): void {
  const fresh = emptyStore();
  Object.assign(store, fresh);
  for (const key of Object.keys(postureReports)) delete postureReports[key];
  store.postureReports = postureReports;
  children.splice(0, children.length, ...fresh.children);
  assessmentSessions.clear();
  reports.clear();
  trainingPlans.clear();
  postureSessions.clear();
  postureAssets.clear();
  void persistStore();
}
export function seedDemoStore(): BoksStore {
  resetDemoStore();
  return store;
}
export function getChild(childId: string): Child | undefined {
  return children.find(
    (child) => child.id === childId && child.profile_status === "active",
  );
}
export function getConfiguration(): StoreConfiguration {
  return store.configuration;
}
export function findStandard(id: string): StandardConfiguration | undefined {
  return store.configuration.standards.find((item) => item.id === id);
}
export function getAssessmentSchema(
  child: Child,
  measurementDate: string,
): AssessmentSchema {
  const selected =
    findStandard(
      child.school_stage === "preschool"
        ? "ref-demo-preschool-development-v0"
        : store.configuration.active_standard_id,
    ) ?? defaultConfiguration.standards[0];
  return {
    standard_version_id: selected.id,
    standard_name: selected.name,
    standard_status: selected.status,
    measurement_date: measurementDate,
    child_id: child.id,
    mode: selected.mode,
    indicators: selected.indicators,
  };
}
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
export function calculateResults(
  schema: AssessmentSchema,
  values: AssessmentValue[],
  testStatus: "completed" | "makeup" | "exempt" | "deferred",
) {
  const selected =
    findStandard(schema.standard_version_id) ??
    defaultConfiguration.standards[0];
  const valueByCode = new Map(
    values.map((value) => [value.indicator_code, value]),
  );
  const results = schema.indicators.map((indicator) => {
    const submitted = valueByCode.get(indicator.indicator_code);
    const numeric = submitted ? Number(submitted.raw_value) : NaN;
    const valid =
      submitted !== undefined &&
      Number.isFinite(numeric) &&
      numeric >= indicator.min_value &&
      numeric <= indicator.max_value;
    const rule = selected.rules.find(
      (item) => item.indicator_code === indicator.indicator_code,
    );
    const canScore =
      schema.mode === "scored" &&
      valid &&
      rule !== undefined &&
      testStatus !== "exempt";
    const score =
      canScore && rule
        ? clamp(
            60 +
              (rule.score_type === "lower_is_better"
                ? rule.baseline - numeric
                : numeric - rule.baseline) *
                rule.points_per_unit,
            0,
            100,
          )
        : null;
    return {
      indicator_code: indicator.indicator_code,
      label: indicator.label,
      raw_value: submitted?.raw_value ?? "",
      unit: indicator.unit,
      score,
      weight: rule?.weight ?? 0,
      contribution: Number(((score ?? 0) * (rule?.weight ?? 0)).toFixed(2)),
      interpretation:
        score === null
          ? schema.mode === "reference_only"
            ? "记录用于成长观察，不进入总评。"
            : "请补充合法数据。"
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
    (item) => item.required,
  ).length;
  const completeness =
    requiredCount === 0
      ? 1
      : results.filter(
          (item) => item.raw_value.length > 0 && item.status !== "needs_review",
        ).length / requiredCount;
  const scored = results.filter((item) => item.score !== null);
  const totalScore =
    schema.mode === "scored" && scored.length > 0
      ? Number(
          scored.reduce((sum, item) => sum + item.contribution, 0).toFixed(1),
        )
      : null;
  const level: AssessmentReport["level"] =
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
    .filter((item) => item.score !== null && item.score < 80)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 3)
    .map((item) => `优先练习：${item.label}`);
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
    algorithm_version: store.configuration.algorithm_version,
    knowledge_snapshot_id: store.configuration.knowledge_snapshot_id,
    configuration_snapshot: structuredClone(store.configuration),
    mode: schema.mode,
    total_score: calculated.totalScore,
    level: calculated.level,
    completeness: calculated.completeness,
    priority_actions: calculated.priorityActions,
    results: calculated.results,
    limitations: [
      "当前评分配置是开发夹具，状态为 demo_pending_review，不能替代已审核标准。",
      "本报告不构成医疗建议或诊断。",
    ],
    source_references: (
      findStandard(schema.standard_version_id) ??
      defaultConfiguration.standards[0]
    ).source_references,
    generated_at: iso(),
  };
  reports.set(report.id, report);
  const session = assessmentSessions.get(sessionId);
  if (session) {
    session.status = "reported";
    session.report_id = report.id;
  }
  void persistStore();
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
  for (let week = 1; week <= durationWeeks; week += 1)
    for (let day = 1; day <= daysPerWeek; day += 1)
      for (const exercise of exerciseSets)
        items.push({ id: randomUUID(), week, day, ...exercise });
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
    content_version: "training-safe-content-1.0",
  };
  trainingPlans.set(plan.id, plan);
  void persistStore();
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
    quality: { overall: "pending", views },
    analysis: null,
    limitations: [
      "普通照片不能诊断疾病，也不能替代专业评估。",
      "当前版本只验证四视角完整性，未接入生产姿态模型。",
    ],
    consent_record_id: consentRecordId,
    capture_protocol_version: captureProtocolVersion,
  };
  postureSessions.set(session.id, session);
  void persistStore();
  return session;
}
