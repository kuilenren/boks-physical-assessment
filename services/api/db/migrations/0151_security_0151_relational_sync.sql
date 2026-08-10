-- migrations/0151_security/0151_relational_sync.sql
-- 说明：放宽关系投影表 CHECK 约束，匹配 app 真实状态机
-- （storage.ts syncRelationalTables 写入的值，业务层 JSON 文档为唯一事实源）
-- 依赖：0150_kms_keys
-- UP
ALTER TABLE boks.boks_assessment_sessions DROP CONSTRAINT boks_assessment_sessions_status_check;
ALTER TABLE boks.boks_assessment_sessions ADD CONSTRAINT boks_assessment_sessions_status_check
  CHECK (status IN ('capturing','completed','expired','draft','submitted','validating','scored','reported','rejected','needs_review'));

ALTER TABLE boks.boks_posture_sessions DROP CONSTRAINT boks_posture_sessions_status_check;
ALTER TABLE boks.boks_posture_sessions ADD CONSTRAINT boks_posture_sessions_status_check
  CHECK (status IN ('capturing','completed','expired','abandoned','draft','quality_check','cancelled'));

ALTER TABLE boks.boks_training_plans DROP CONSTRAINT boks_training_plans_status_check;
ALTER TABLE boks.boks_training_plans ADD CONSTRAINT boks_training_plans_status_check
  CHECK (status IN ('draft','active','paused','completed','abandoned','paused_safety_review'));

ALTER TABLE boks.boks_training_check_ins DROP CONSTRAINT boks_training_check_ins_status_check;
ALTER TABLE boks.boks_training_check_ins ADD CONSTRAINT boks_training_check_ins_status_check
  CHECK (status IN ('done','partial','skipped','completed'));

ALTER TABLE boks.boks_knowledge_versions DROP CONSTRAINT boks_knowledge_versions_status_check;
ALTER TABLE boks.boks_knowledge_versions ADD CONSTRAINT boks_knowledge_versions_status_check
  CHECK (status IN ('draft','in_review','published','retired','candidate','withdrawn'));

ALTER TABLE boks.boks_deletion_requests DROP CONSTRAINT boks_deletion_requests_status_check;
ALTER TABLE boks.boks_deletion_requests ADD CONSTRAINT boks_deletion_requests_status_check
  CHECK (status IN ('pending','in_progress','completed','failed','requested'));

-- score_bands：放宽 sex_code（storage.ts 以 unspecified/all 聚合值写入）
ALTER TABLE boks.boks_standard_score_bands DROP CONSTRAINT boks_standard_score_bands_sex_code_check;
ALTER TABLE boks.boks_standard_score_bands ADD CONSTRAINT boks_standard_score_bands_sex_code_check
  CHECK (sex_code IN ('female','male','unspecified','all'));

-- DOWN
ALTER TABLE boks.boks_assessment_sessions DROP CONSTRAINT boks_assessment_sessions_status_check;
ALTER TABLE boks.boks_assessment_sessions ADD CONSTRAINT boks_assessment_sessions_status_check
  CHECK (status IN ('capturing','completed','expired'));

ALTER TABLE boks.boks_posture_sessions DROP CONSTRAINT boks_posture_sessions_status_check;
ALTER TABLE boks.boks_posture_sessions ADD CONSTRAINT boks_posture_sessions_status_check
  CHECK (status IN ('capturing','completed','expired','abandoned'));

ALTER TABLE boks.boks_training_plans DROP CONSTRAINT boks_training_plans_status_check;
ALTER TABLE boks.boks_training_plans ADD CONSTRAINT boks_training_plans_status_check
  CHECK (status IN ('draft','active','paused','completed','abandoned'));

ALTER TABLE boks.boks_training_check_ins DROP CONSTRAINT boks_training_check_ins_status_check;
ALTER TABLE boks.boks_training_check_ins ADD CONSTRAINT boks_training_check_ins_status_check
  CHECK (status IN ('done','partial','skipped'));

ALTER TABLE boks.boks_knowledge_versions DROP CONSTRAINT boks_knowledge_versions_status_check;
ALTER TABLE boks.boks_knowledge_versions ADD CONSTRAINT boks_knowledge_versions_status_check
  CHECK (status IN ('draft','in_review','published','retired'));

ALTER TABLE boks.boks_deletion_requests DROP CONSTRAINT boks_deletion_requests_status_check;
ALTER TABLE boks.boks_deletion_requests ADD CONSTRAINT boks_deletion_requests_status_check
  CHECK (status IN ('pending','in_progress','completed','failed'));

ALTER TABLE boks.boks_standard_score_bands DROP CONSTRAINT boks_standard_score_bands_sex_code_check;
ALTER TABLE boks.boks_standard_score_bands ADD CONSTRAINT boks_standard_score_bands_sex_code_check
  CHECK (sex_code IN ('female','male'));
