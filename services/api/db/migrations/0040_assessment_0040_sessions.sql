-- migrations/0040_assessment/0040_sessions.sql
-- 依赖：0030_children
-- 说明：体测会话
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_assessment_sessions (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  child_id            TEXT NOT NULL REFERENCES boks.boks_children(id) ON DELETE CASCADE,
  measurement_date    DATE NOT NULL,
  standard_version_id TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('capturing','completed','expired')),
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_assessment_sessions_child_date_idx
  ON boks.boks_assessment_sessions (child_id, measurement_date DESC);

ALTER TABLE boks.boks_assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_assessment_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_assessment_sessions_family ON boks.boks_assessment_sessions;
CREATE POLICY boks_assessment_sessions_family ON boks.boks_assessment_sessions
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_assessment_sessions_owner ON boks.boks_assessment_sessions;
CREATE POLICY boks_assessment_sessions_owner ON boks.boks_assessment_sessions
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_assessment_sessions TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_assessment_sessions;