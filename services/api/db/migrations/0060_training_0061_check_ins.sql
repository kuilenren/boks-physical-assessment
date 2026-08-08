-- migrations/0060_training/0061_check_ins.sql
-- 依赖：0060_plans
-- 说明：训练打卡
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_training_check_ins (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  plan_id     TEXT NOT NULL REFERENCES boks.boks_training_plans(id) ON DELETE CASCADE,
  child_id    TEXT NOT NULL REFERENCES boks.boks_children(id) ON DELETE CASCADE,
  day         INTEGER NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('done','partial','skipped')),
  notes       TEXT,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, day)
);
CREATE INDEX IF NOT EXISTS boks_check_ins_child_day_idx
  ON boks.boks_training_check_ins (child_id, day DESC);

ALTER TABLE boks.boks_training_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_training_check_ins FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_check_ins_family ON boks.boks_training_check_ins;
CREATE POLICY boks_check_ins_family ON boks.boks_training_check_ins
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_check_ins_owner ON boks.boks_training_check_ins;
CREATE POLICY boks_check_ins_owner ON boks.boks_training_check_ins
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_training_check_ins TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_training_check_ins;