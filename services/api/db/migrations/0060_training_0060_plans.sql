-- migrations/0060_training/0060_plans.sql
-- 依赖：0030_children
-- 说明：训练计划
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_training_plans (
  id            TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  child_id      TEXT NOT NULL REFERENCES boks.boks_children(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('draft','active','paused','completed','abandoned')),
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_training_plans_child_status_idx
  ON boks.boks_training_plans (child_id, status, created_at DESC);

ALTER TABLE boks.boks_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_training_plans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_training_plans_family ON boks.boks_training_plans;
CREATE POLICY boks_training_plans_family ON boks.boks_training_plans
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_training_plans_owner ON boks.boks_training_plans;
CREATE POLICY boks_training_plans_owner ON boks.boks_training_plans
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_training_plans TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_training_plans;