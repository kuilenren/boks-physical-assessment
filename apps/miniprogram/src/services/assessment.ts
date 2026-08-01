import type {
  AssessmentReport as ContractAssessmentReport,
  AssessmentSchema as ContractAssessmentSchema,
  AssessmentValue,
} from "@boks/contracts";
import type {
  AssessmentReport,
  AssessmentSchema,
  AssessmentSession,
  ChildProfile,
  ReportListItem,
  TrainingPlan,
} from "../models";
import { request } from "./http";

export function getSchema(childId: string) {
  return request<ContractAssessmentSchema>(
    `/assessment/schemas?child_id=${encodeURIComponent(childId)}`,
  ).then(mapSchema);
}

export function createSession(schema: AssessmentSchema) {
  return request<AssessmentSession>("/assessment/sessions", {
    method: "POST",
    data: {
      child_id: schema.child_id,
      measurement_date: schema.measurement_date,
      standard_version_id: schema.standard_version_id,
    },
  }).then(mapSession);
}

export function saveSession(sessionId: string, values: AssessmentValue[]) {
  return request<AssessmentSession>(`/assessment/sessions/${sessionId}`, {
    method: "PATCH",
    data: { values, test_status: "completed" },
  }).then(mapSession);
}

export function submitSession(sessionId: string, values: AssessmentValue[]) {
  return request<ContractAssessmentReport>(
    `/assessment/sessions/${sessionId}/submit`,
    {
      method: "POST",
      data: { values, test_status: "completed" },
    },
  ).then((report) => mapReport(report));
}

export function listReports(childId: string, children: ChildProfile[] = []) {
  return request<ContractAssessmentReport[]>(
    `/reports?child_id=${encodeURIComponent(childId)}`,
  ).then((items) => items.map((item) => mapReport(item, children)));
}

export function getReport(reportId: string, child?: ChildProfile) {
  return request<ContractAssessmentReport>(`/reports/${reportId}`).then(
    (report) => mapReport(report, child ? [child] : []),
  );
}

function mapSchema(schema: ContractAssessmentSchema): AssessmentSchema {
  return {
    ...schema,
    indicators: schema.indicators.map((indicator) => ({
      ...indicator,
      display_name: indicator.label,
      description: indicator.help_text,
    })),
  };
}

function mapSession(session: {
  id: string;
  child_id: string;
  status: string;
  measurement_date: string;
  values: AssessmentValue[];
  report_id: string | null;
}): AssessmentSession {
  return session;
}

function mapReport(
  report: ContractAssessmentReport,
  children: ChildProfile[] = [],
): AssessmentReport {
  const child = children.find((item) => item.child_id === report.child_id);
  const levelLabels: Record<ContractAssessmentReport["level"], string> = {
    excellent: "优秀",
    good: "良好",
    pass: "及格",
    fail: "待提升",
    reference_only: "参考进步模式",
  };
  return {
    report_id: report.id,
    report_type: report.mode,
    child_id: report.child_id,
    child_name: child?.display_name ?? report.child_id,
    assessment_date: report.measurement_date,
    overall_score: report.total_score,
    grade_label: levelLabels[report.level],
    results: report.results.map((result) => ({
      indicator_code: result.indicator_code,
      display_name: result.label,
      raw_value: result.raw_value,
      unit: result.unit,
      score: result.score,
      status_label:
        result.status === "scored"
          ? "已评分"
          : result.status === "reference_only"
            ? "参考记录"
            : result.status === "needs_review"
              ? "需要复核"
              : "缺测",
      interpretation: result.interpretation,
    })),
    training_summary: report.priority_actions,
    standard_version: report.standard_version_id,
    standard_name: report.standard_name,
    standard_status: report.standard_status,
    algorithm_version: report.algorithm_version,
    knowledge_snapshot_id: report.knowledge_snapshot_id,
    limitation_text: report.limitations.join(" "),
    created_at: report.generated_at,
  };
}
