import { randomUUID } from "node:crypto";
import type {
  AssessmentReport,
  Child,
  NextAction,
  TrainingPlan,
} from "@boks/contracts";
import type { TrainingCheckIn, Consent } from "./demo-store.js";

export type NextActionInput = {
  child: Child;
  reports: AssessmentReport[];
  plans: TrainingPlan[];
  checkIns: TrainingCheckIn[];
  consents: Consent[];
  hasPostureReport: boolean;
};

const DAYS_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / DAYS_MS),
  );
}

function latestOf(items: AssessmentReport[]): AssessmentReport | null {
  return items.length > 0
    ? [...items].sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0]
    : null;
}

function latestPlanOf(items: TrainingPlan[]): TrainingPlan | null {
  return items.length > 0 ? items[items.length - 1] : null;
}

function planCompletion(
  plan: TrainingPlan,
  checkIns: TrainingCheckIn[],
): number {
  const total = plan.duration_weeks * plan.days_per_week;
  const completed = checkIns.filter(
    (item) => item.plan_id === plan.id && item.status === "completed",
  ).length;
  return total > 0 ? completed / total : 0;
}

function consentGranted(
  consents: Consent[],
  childId: string,
  purpose: Consent["purpose"],
): boolean {
  return consents.some(
    (item) =>
      item.child_id === childId &&
      item.purpose === purpose &&
      item.granted &&
      !item.withdrawn_at,
  );
}

function push(
  actions: NextAction[],
  child: Child,
  priority: number,
  category: NextAction["category"],
  title: string,
  description: string,
  reason: string,
): void {
  actions.push({
    id: randomUUID(),
    child_id: child.id,
    priority,
    category,
    title,
    description,
    reason,
  });
}

export function buildNextActions(input: NextActionInput): NextAction[] {
  const actions: NextAction[] = [];
  const { child, reports, plans, checkIns, consents } = input;
  const latestReport = latestOf(reports);
  const hasPrivacy = consentGranted(consents, child.id, "privacy");
  const hasAssessmentConsent = consentGranted(consents, child.id, "assessment");

  if (!hasPrivacy || !hasAssessmentConsent)
    push(
      actions,
      child,
      10,
      "consent",
      "完成数据授权",
      "确认隐私与体测数据处理规则，才能开始记录。",
      "缺少隐私或体测授权同意记录。",
    );

  if (!latestReport)
    push(
      actions,
      child,
      20,
      "assessment",
      "完成第一次体测",
      "按现场数据逐项录入，生成可追溯的正式报告。",
      "还没有已生成的体测报告。",
    );
  else {
    if (daysSince(latestReport.generated_at) > 180)
      push(
        actions,
        child,
        30,
        "assessment",
        "安排复测",
        "距离上次体测超过半年，建议按标准重新测量。",
        "最近一次体测已超过 180 天。",
      );
    const latestPlan = latestPlanOf(plans);
    if (!latestPlan)
      push(
        actions,
        child,
        40,
        "training",
        "生成训练计划",
        "基于最近体测的弱项，生成可执行的家庭训练计划。",
        "还没有训练计划。",
      );
    else if (latestPlan.status === "paused_safety_review")
      push(
        actions,
        child,
        30,
        "training",
        "完成安全复核",
        "训练因安全红旗暂停，需要复核后恢复。",
        "训练计划处于安全暂停状态。",
      );
    else {
      const completion = planCompletion(latestPlan, checkIns);
      if (completion < 0.5)
        push(
          actions,
          child,
          50,
          "training",
          "继续训练打卡",
          `当前训练计划已完成 ${Math.round(completion * 100)}%，建议按周推进。`,
          `训练完成率 ${Math.round(completion * 100)}% 低于 50%。`,
        );
    }
  }

  if (!input.hasPostureReport)
    push(
      actions,
      child,
      60,
      "posture",
      "完成四视角体态观察",
      "正、背、左、右视角拍摄，生成拍摄合格档案。",
      "还没有通过质量门禁的体态观察档案。",
    );

  return actions.sort((a, b) => a.priority - b.priority);
}

export function buildFamilyNextActions(input: NextActionInput[]): NextAction[] {
  return input.flatMap((item) => buildNextActions(item));
}
