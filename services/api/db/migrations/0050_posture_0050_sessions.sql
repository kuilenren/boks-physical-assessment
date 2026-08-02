-- migrations/0050_posture/0050_sessions.sql
-- 依赖：0030_children
-- 说明：体态会话
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_posture_sessions (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  child_id            TEXT NOT NULL REFERENCES boks.boks_children(id) ON DELETE CASCADE,
  status              TEXT NOT NULL CHECK (status IN ('capturing','completed','expired','abandoned')),
  required_views      TEXT[] NOT NULL DEFAULT ARRAY['front','back','left','right']::TEXT[],
  quality_overall     TEXT NOT NULL DEFAULT 'pending'
                      CHECK (quality_overall IN ('pending','passed','needs_retake')),
  analysis            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_posture_sessions_child_status_idx
  ON boks.boks_posture_sessions (child_id, status, created_at DESC);

ALTER TABLE boks.boks_posture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_posture_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_posture_sessions_family ON boks.boks_posture_sessions;
CREATE POLICY boks_posture_sessions_family ON boks.boks_posture_sessions
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_posture_sessions_owner ON boks.boks_posture_sessions;
CREATE POLICY boks_posture_sessions_owner ON boks.boks_posture_sessions
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_posture_sessions TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_posture_sessions;