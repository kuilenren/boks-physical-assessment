import type { TrainingPlan as ContractTrainingPlan } from "@boks/contracts";
import type { TrainingPlan } from "../models";
import { request } from "./http";

export function createTrainingPlan(childId: string, sourceReportId?: string) {
  return request<ContractTrainingPlan>("/training/plans", {
    method: "POST",
    data: {
      child_id: childId,
      source_report_id: sourceReportId ?? null,
      goal: "提升综合体能与动作协调",
      duration_weeks: 4,
      days_per_week: 3,
      minutes_per_session: 20,
      safety_confirmed: true,
    },
  }).then(mapPlan);
}

export function listTrainingPlans(childId?: string) {
  const query = childId ? `?child_id=${encodeURIComponent(childId)}` : "";
  return request<ContractTrainingPlan[]>(`/training/plans${query}`).then(
    (items) => items.map(mapPlan),
  );
}

function mapPlan(plan: ContractTrainingPlan): TrainingPlan {
  const dayGroups = new Map<number, typeof plan.items>();
  for (const item of plan.items.filter((item) => item.week === 1)) {
    const items = dayGroups.get(item.day) ?? [];
    items.push(item);
    dayGroups.set(item.day, items);
  }
  return {
    plan_id: plan.id,
    child_id: plan.child_id,
    source_report_id: plan.source_report_id,
    title: plan.goal,
    duration_weeks: plan.duration_weeks,
    sessions_per_week: plan.days_per_week,
    session_minutes: plan.minutes_per_session,
    weekly_schedule: [...dayGroups.entries()].map(([day, items]) => ({
      day_label: `第 ${day} 天`,
      focus:
        items.find((item) => item.phase === "main")?.exercise_name ??
        "综合训练",
      exercises: items.map((item) => item.exercise_name),
      minutes: items.reduce((total, item) => total + item.duration_minutes, 0),
    })),
    safety_notes: [
      ...new Set(
        plan.items.map((item) => `${item.safety_note} ${item.stop_condition}`),
      ),
    ],
  };
}
