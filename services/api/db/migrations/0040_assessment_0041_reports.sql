-- migrations/0040_assessment/0041_reports.sql
-- 依赖：0040_sessions
-- 说明：体测报告
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_assessment_reports (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  child_id            TEXT NOT NULL REFERENCES boks.boks_children(id) ON DELETE CASCADE,
  measurement_date    DATE NOT NULL,
  standard_version_id TEXT NOT NULL,
  total_score         NUMERIC(5,2),
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_assessment_reports_child_date_idx
  ON boks.boks_assessment_reports (child_id, measurement_date DESC);

ALTER TABLE boks.boks_assessment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_assessment_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_assessment_reports_family ON boks.boks_assessment_reports;
CREATE POLICY boks_assessment_reports_family ON boks.boks_assessment_reports
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_assessment_reports_owner ON boks.boks_assessment_reports;
CREATE POLICY boks_assessment_reports_owner ON boks.boks_assessment_reports
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_assessment_reports TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_assessment_reports;