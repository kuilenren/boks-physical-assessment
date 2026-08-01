export interface ChildProfile {
  child_id: string;
  display_name: string;
  birth_date: string;
  sex: "male" | "female" | "unknown";
  grade_stage: string;
  status: "active" | "archived" | "deleted";
}

export interface FamilySummary {
  family_id: string;
  display_name: string;
  children: ChildProfile[];
  pending_actions: number;
}

export interface AssessmentIndicator {
  indicator_code: string;
  display_name: string;
  unit: string;
  input_type: "decimal" | "integer";
  min_value: number;
  max_value: number;
  step: number;
  required: boolean;
  description: string;
}

export interface AssessmentSchema {
  standard_version_id: string;
  standard_name: string;
  standard_status: "approved" | "demo_pending_review";
  measurement_date: string;
  child_id: string;
  mode: "scored" | "reference_only";
  indicators: AssessmentIndicator[];
}

export interface AssessmentMetricInput {
  indicator_code: string;
  raw_value: string;
  unit: string;
}

export interface AssessmentSession {
  id: string;
  child_id: string;
  status: string;
  measurement_date: string;
  values: AssessmentMetricInput[];
  report_id: string | null;
}

export interface ScoreResultView {
  indicator_code: string;
  display_name: string;
  raw_value: string;
  unit: string;
  score: number | null;
  status_label: string;
  interpretation: string;
}

export interface AssessmentReport {
  report_id: string;
  report_type: "scored" | "reference_only";
  child_id: string;
  child_name: string;
  assessment_date: string;
  overall_score: number | null;
  grade_label: string;
  results: ScoreResultView[];
  training_summary: string[];
  standard_version: string;
  standard_name: string;
  standard_status: "approved" | "demo_pending_review";
  algorithm_version: string;
  knowledge_snapshot_id: string;
  limitation_text: string;
  created_at: string;
}

export type ReportListItem = Pick<
  AssessmentReport,
  | "report_id"
  | "child_id"
  | "child_name"
  | "report_type"
  | "assessment_date"
  | "created_at"
>;

export interface TrainingSession {
  day_label: string;
  focus: string;
  exercises: string[];
  minutes: number;
}

export interface TrainingPlan {
  plan_id: string;
  child_id: string;
  source_report_id: string | null;
  title: string;
  duration_weeks: number;
  sessions_per_week: number;
  session_minutes: number;
  weekly_schedule: TrainingSession[];
  safety_notes: string[];
}

export type PostureViewCode = "front" | "back" | "left" | "right";

export interface PostureView {
  view: PostureViewCode;
  asset_id?: string;
}

export interface PostureSession {
  session_id: string;
  child_id: string;
  status: string;
  required_views: PostureViewCode[];
  views: PostureView[];
  quality_status: "pending" | "ready_for_review" | "needs_retake";
  analysis: null;
  limitations: string[];
}
