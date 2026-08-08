import type {
  TrainingPlan as ContractTrainingPlan,
  TrainingCheckInRequest,
} from "@boks/contracts";
import type { TrainingPlan, TrainingProgress } from "../models";
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
    (items) => (items || []).map(mapPlan),
  );
}

function mapPlan(plan: ContractTrainingPlan): TrainingPlan {
  const items = plan.items ?? [];
  const dayGroups = new Map<number, typeof items>();
  for (const item of items.filter((item) => item.week === 1)) {
    const group = dayGroups.get(item.day) ?? [];
    group.push(item);
    dayGroups.set(item.day, group);
  }
  return {
    plan_id: plan.id,
    child_id: plan.child_id,
    source_report_id: plan.source_report_id,
    title: plan.goal,
    duration_weeks: plan.duration_weeks,
    sessions_per_week: plan.days_per_week,
    session_minutes: plan.minutes_per_session,
    weekly_schedule: [...dayGroups.entries()].map(([day, group]) => ({
      day_label: `第 ${day} 天`,
      focus:
        group.find((item) => item.phase === "main")?.exercise_name ??
        "综合训练",
      exercises: group.map((item) => item.exercise_name),
      minutes: group.reduce((total, item) => total + item.duration_minutes, 0),
    })),
    safety_notes: [
      ...new Set(
        items.map((item) => `${item.safety_note} ${item.stop_condition}`),
      ),
    ],
    status: plan.status,
  };
}

export function getTrainingProgress(planId: string) {
  return request<TrainingProgress>(
    `/training/plans/${encodeURIComponent(planId)}/progress`,
  );
}

export function checkInTraining(planId: string, input: TrainingCheckInRequest) {
  return request<{
    id: string;
    plan_id: string;
    child_id: string;
    day: number;
    status: "completed" | "skipped";
    note: string | null;
    created_at: string;
  }>(`/training/plans/${encodeURIComponent(planId)}/check-ins`, {
    method: "POST",
    data: input,
  });
}

export function pauseTraining(planId: string, reason: string) {
  return request<{ plan: ContractTrainingPlan; reason: string }>(
    `/training/plans/${encodeURIComponent(planId)}/pause`,
    { method: "POST", data: { reason } },
  );
}

export function resumeTraining(planId: string) {
  return request<ContractTrainingPlan>(
    `/training/plans/${encodeURIComponent(planId)}/resume`,
    { method: "POST", data: { guardian_confirmed: true } },
  ).then(mapPlan);
}
