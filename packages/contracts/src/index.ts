import { z } from "zod";

export const healthResponseSchema = z.object({
  service: z.string(),
  status: z.literal("ok"),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const platformSchema = z.enum([
  "wechat-mini-program",
  "android",
  "ios",
  "admin-web",
]);

export type Platform = z.infer<typeof platformSchema>;

export const schoolStageSchema = z.enum([
  "preschool",
  "primary",
  "junior_high",
  "senior_high",
]);

export type SchoolStage = z.infer<typeof schoolStageSchema>;

export const sexCodeSchema = z.enum(["female", "male", "unspecified"]);

export type SexCode = z.infer<typeof sexCodeSchema>;

export const childSchema = z.object({
  id: z.string(),
  display_name: z.string().min(1),
  birth_date: z.string().date(),
  age_in_months: z.number().int().nonnegative(),
  sex_code: sexCodeSchema,
  school_stage: schoolStageSchema,
  grade_code: z.string().min(1),
  profile_status: z.enum(["active", "archived", "deleted"]),
});

export type Child = z.infer<typeof childSchema>;

export const createChildRequestSchema = z.object({
  display_name: z.string().trim().min(1).max(40),
  birth_date: z.string().date(),
  sex_code: sexCodeSchema,
  school_stage: schoolStageSchema,
  grade_code: z.string().trim().min(1).max(32),
});

export type CreateChildRequest = z.infer<typeof createChildRequestSchema>;

export const assessmentIndicatorSchema = z.object({
  indicator_code: z.string().min(1),
  label: z.string().min(1),
  unit: z.string().min(1),
  input_type: z.enum(["decimal", "integer"]),
  min_value: z.number(),
  max_value: z.number().positive(),
  step: z.number().positive(),
  required: z.boolean(),
  help_text: z.string().min(1),
});

export type AssessmentIndicator = z.infer<typeof assessmentIndicatorSchema>;

export const assessmentSchemaSchema = z.object({
  standard_version_id: z.string().min(1),
  standard_name: z.string().min(1),
  standard_status: z.enum(["approved", "demo_pending_review"]),
  measurement_date: z.string().date(),
  child_id: z.string().min(1),
  mode: z.enum(["scored", "reference_only"]),
  indicators: z.array(assessmentIndicatorSchema),
});

export type AssessmentSchema = z.infer<typeof assessmentSchemaSchema>;

export const assessmentValueSchema = z.object({
  indicator_code: z.string().min(1),
  raw_value: z.string().min(1),
  unit: z.string().min(1),
});

export type AssessmentValue = z.infer<typeof assessmentValueSchema>;

export const assessmentSessionStatusSchema = z.enum([
  "draft",
  "submitted",
  "validating",
  "scored",
  "reported",
  "rejected",
  "needs_review",
]);

export type AssessmentSessionStatus = z.infer<
  typeof assessmentSessionStatusSchema
>;

export const createAssessmentSessionRequestSchema = z.object({
  child_id: z.string().min(1),
  measurement_date: z.string().date(),
  standard_version_id: z.string().min(1),
});

export type CreateAssessmentSessionRequest = z.infer<
  typeof createAssessmentSessionRequestSchema
>;

export const saveAssessmentSessionRequestSchema = z.object({
  values: z.array(assessmentValueSchema),
  test_status: z
    .enum(["completed", "makeup", "exempt", "deferred"])
    .default("completed"),
});

export type SaveAssessmentSessionRequest = z.infer<
  typeof saveAssessmentSessionRequestSchema
>;

export const submitAssessmentRequestSchema = z.object({
  values: z.array(assessmentValueSchema),
  test_status: z
    .enum(["completed", "makeup", "exempt", "deferred"])
    .default("completed"),
});

export type SubmitAssessmentRequest = z.infer<
  typeof submitAssessmentRequestSchema
>;

export const scoreResultSchema = z.object({
  indicator_code: z.string(),
  label: z.string(),
  raw_value: z.string(),
  unit: z.string(),
  score: z.number().min(0).max(100).nullable(),
  weight: z.number().min(0).max(1),
  contribution: z.number().min(0),
  interpretation: z.string(),
  status: z.enum(["scored", "missing", "reference_only", "needs_review"]),
});

export type ScoreResult = z.infer<typeof scoreResultSchema>;

export const assessmentReportSchema = z.object({
  id: z.string(),
  report_type: z.literal("assessment"),
  child_id: z.string(),
  status: z.literal("ready"),
  measurement_date: z.string().date(),
  standard_version_id: z.string(),
  standard_name: z.string(),
  standard_status: z.enum(["approved", "demo_pending_review"]),
  algorithm_version: z.string(),
  knowledge_snapshot_id: z.string(),
  configuration_snapshot: z.record(z.unknown()).optional(),
  mode: z.enum(["scored", "reference_only"]),
  total_score: z.number().min(0).max(120).nullable(),
  level: z.enum(["excellent", "good", "pass", "fail", "reference_only"]),
  completeness: z.number().min(0).max(1),
  priority_actions: z.array(z.string()).max(3),
  results: z.array(scoreResultSchema),
  limitations: z.array(z.string()),
  source_references: z.array(
    z.object({
      title: z.string(),
      official_url: z.string().url(),
    }),
  ),
  generated_at: z.string().datetime(),
});

export type AssessmentReport = z.infer<typeof assessmentReportSchema>;

export const trainingPlanItemSchema = z.object({
  id: z.string(),
  week: z.number().int().positive(),
  day: z.number().int().positive(),
  phase: z.enum(["warmup", "main", "cooldown"]),
  exercise_name: z.string(),
  duration_minutes: z.number().positive(),
  sets: z.number().int().positive(),
  repetitions: z.number().int().positive().nullable(),
  safety_note: z.string(),
  stop_condition: z.string(),
});

export type TrainingPlanItem = z.infer<typeof trainingPlanItemSchema>;

export const trainingPlanSchema = z.object({
  id: z.string(),
  child_id: z.string(),
  source_report_id: z.string().nullable(),
  goal: z.string(),
  duration_weeks: z.number().int().min(4).max(8),
  days_per_week: z.number().int().min(1).max(7),
  minutes_per_session: z.number().int().min(5).max(120),
  status: z.enum(["active", "paused_safety_review", "completed"]),
  safety_confirmed: z.boolean(),
  items: z.array(trainingPlanItemSchema),
  content_version: z.string(),
});

export type TrainingPlan = z.infer<typeof trainingPlanSchema>;

export const createTrainingPlanRequestSchema = z.object({
  child_id: z.string().min(1),
  source_report_id: z.string().min(1).nullable().default(null),
  goal: z.string().trim().min(1).max(80),
  duration_weeks: z.number().int().min(4).max(8).default(4),
  days_per_week: z.number().int().min(1).max(7).default(3),
  minutes_per_session: z.number().int().min(5).max(120).default(20),
  safety_confirmed: z.literal(true),
  health_safety_status: z
    .enum(["clear", "paused_safety_review"])
    .default("clear"),
  red_flags: z.array(z.string()).default([]),
});

export type CreateTrainingPlanRequest = z.infer<
  typeof createTrainingPlanRequestSchema
>;

export const postureViewSchema = z.enum(["front", "back", "left", "right"]);

export type PostureView = z.infer<typeof postureViewSchema>;

export const postureQualitySchema = z.object({
  overall: z.enum(["pending", "passed", "needs_retake"]),
  views: z.record(
    postureViewSchema,
    z.object({
      status: z.enum(["pending", "passed", "needs_retake"]),
      score: z.number().min(0).max(1).nullable(),
      reasons: z.array(z.string()),
    }),
  ),
});

export type PostureQuality = z.infer<typeof postureQualitySchema>;

export const postureSessionSchema = z.object({
  id: z.string(),
  child_id: z.string(),
  status: z.enum([
    "draft",
    "capturing",
    "quality_check",
    "completed",
    "cancelled",
  ]),
  required_views: z.array(postureViewSchema),
  attached_views: z.array(postureViewSchema),
  quality: postureQualitySchema,
  analysis: z
    .object({
      report_id: z.string(),
      risk_level: z.enum(["A", "B", "C", "D"]),
      observation_status: z.enum(["insufficient_data", "observed"]),
      confidence: z.enum(["low", "medium", "high"]),
    })
    .nullable(),
  limitations: z.array(z.string()),
  consent_record_id: z.string(),
  capture_protocol_version: z.string(),
});

export type PostureSession = z.infer<typeof postureSessionSchema>;

export const createPostureSessionRequestSchema = z.object({
  child_id: z.string().min(1),
  consent_record_id: z.string().min(1),
  capture_protocol_version: z.string().min(1),
  required_views: z
    .array(postureViewSchema)
    .length(4)
    .default(["front", "back", "left", "right"]),
});

export type CreatePostureSessionRequest = z.infer<
  typeof createPostureSessionRequestSchema
>;

export const attachPostureViewRequestSchema = z.object({
  asset_id: z.string().min(1),
});

export type AttachPostureViewRequest = z.infer<
  typeof attachPostureViewRequestSchema
>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.record(z.string())).default([]),
    retryable: z.boolean(),
  }),
  meta: z.object({
    trace_id: z.string(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const authSessionSchema = z.object({
  token: z.string().min(1),
  guardian_id: z.string().min(1),
  family_id: z.string().min(1),
  expires_at: z.string().datetime(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;
export const devLoginRequestSchema = z.object({
  guardian_id: z.string().min(1).default("guardian-demo-001"),
});
export type DevLoginRequest = z.infer<typeof devLoginRequestSchema>;
export const consentPurposeSchema = z.enum([
  "privacy",
  "assessment",
  "photo",
  "voice",
]);
export const consentSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  child_id: z.string(),
  purpose: consentPurposeSchema,
  version: z.string(),
  granted: z.boolean(),
  granted_at: z.string().datetime(),
  withdrawn_at: z.string().datetime().nullable(),
});
export type Consent = z.infer<typeof consentSchema>;
export const consentRequestSchema = z.object({
  child_id: z.string().min(1),
  purpose: consentPurposeSchema,
  version: z.string().min(1),
  granted: z.boolean().default(true),
});
export type ConsentRequest = z.infer<typeof consentRequestSchema>;
export const assessmentHistorySchema = z.object({
  child_id: z.string(),
  reports: z.array(assessmentReportSchema),
});
export const assessmentTrendSchema = z.object({
  child_id: z.string(),
  points: z.array(
    z.object({
      report_id: z.string(),
      measurement_date: z.string().date(),
      total_score: z.number().nullable(),
    }),
  ),
});
export type AssessmentHistory = z.infer<typeof assessmentHistorySchema>;
export type AssessmentTrend = z.infer<typeof assessmentTrendSchema>;
export const assessmentRuleSchema = z.object({
  indicator_code: z.string(),
  score_type: z.enum(["higher_is_better", "lower_is_better"]),
  baseline: z.number(),
  points_per_unit: z.number(),
  weight: z.number().min(0).max(1),
});
export const assessmentConfigurationSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["approved", "demo_pending_review"]),
  mode: z.enum(["scored", "reference_only"]),
  indicators: z.array(assessmentIndicatorSchema),
  rules: z.array(assessmentRuleSchema),
  source_references: z.array(
    z.object({ title: z.string(), official_url: z.string().url() }),
  ),
});
export type AssessmentConfiguration = z.infer<
  typeof assessmentConfigurationSchema
>;
export const postureReportSchema = z.object({
  id: z.string(),
  report_type: z.literal("posture"),
  child_id: z.string(),
  session_id: z.string(),
  risk_level: z.enum(["A", "B", "C", "D"]),
  observation_status: z.enum(["insufficient_data", "observed"]),
  confidence: z.enum(["low", "medium", "high"]),
  observations: z.array(z.string()),
  recommendations: z.array(z.string()),
  limitations: z.array(z.string()),
  generated_at: z.string().datetime(),
});
export type PostureReport = z.infer<typeof postureReportSchema>;
export const trainingCheckInRequestSchema = z.object({
  day: z.number().int().positive(),
  status: z.enum(["completed", "skipped"]),
  note: z.string().max(300).nullable().default(null),
});
export type TrainingCheckInRequest = z.infer<
  typeof trainingCheckInRequestSchema
>;
export const trainingPauseRequestSchema = z.object({
  reason: z.string().trim().min(1).max(300),
});
export type TrainingPauseRequest = z.infer<typeof trainingPauseRequestSchema>;
export const trainingResumeRequestSchema = z.object({
  guardian_confirmed: z.literal(true),
});
export type TrainingResumeRequest = z.infer<typeof trainingResumeRequestSchema>;
export const chatRequestSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  child_id: z.string().nullable().default(null),
  context_report_id: z.string().nullable().default(null),
  context_plan_id: z.string().nullable().default(null),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export const chatCitationSchema = z.object({
  source_id: z.string(),
  title: z.string(),
  version: z.string(),
});
export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  citations: z.array(chatCitationSchema),
  created_at: z.string().datetime(),
});
export const chatConversationSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  child_id: z.string().nullable(),
  context_report_id: z.string().nullable(),
  context_plan_id: z.string().nullable(),
  messages: z.array(chatMessageSchema),
  created_at: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatConversation = z.infer<typeof chatConversationSchema>;
export const knowledgeSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  owner: z.string(),
  created_at: z.string().datetime(),
});
export const knowledgeVersionSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  version: z.string(),
  title: z.string(),
  content: z.string(),
  status: z.enum(["candidate", "published", "withdrawn"]),
  reviewers: z.array(z.string()),
  published_at: z.string().datetime().nullable(),
});
export const knowledgeSourceRequestSchema = z.object({
  title: z.string().min(1),
  owner: z.string().min(1),
});
export const knowledgeVersionRequestSchema = z.object({
  source_id: z.string(),
  version: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});
export const dataExportSchema = z.object({
  family_id: z.string(),
  exported_at: z.string().datetime(),
  data: z.record(z.unknown()),
});
export const deletionRequestSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  child_id: z.string(),
  status: z.enum(["requested", "completed"]),
  created_at: z.string().datetime(),
});
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
export type KnowledgeVersion = z.infer<typeof knowledgeVersionSchema>;
export type DataExport = z.infer<typeof dataExportSchema>;
export type DeletionRequest = z.infer<typeof deletionRequestSchema>;
