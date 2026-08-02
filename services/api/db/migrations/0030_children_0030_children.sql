-- migrations/0030_children/0030_children.sql
-- 依赖：0010_families
-- 说明：儿童档案，display_name 与 birth_date 走 envelope 加密
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_children (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL REFERENCES boks.boks_families(id) ON DELETE CASCADE,
  display_name_enc    BYTEA NOT NULL,
  birth_date_enc      BYTEA NOT NULL,
  sex_code            TEXT NOT NULL CHECK (sex_code IN ('female','male','unspecified')),
  school_stage        TEXT NOT NULL CHECK (school_stage IN ('preschool','primary','junior_high','senior_high')),
  grade_code          TEXT NOT NULL,
  profile_status      TEXT NOT NULL DEFAULT 'active'
                      CHECK (profile_status IN ('active','archived','deleted')),
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引：family 内按状态；不索引加密字段
CREATE INDEX IF NOT EXISTS boks_children_family_idx
  ON boks.boks_children (family_id, profile_status);
CREATE INDEX IF NOT EXISTS boks_children_stage_idx
  ON boks.boks_children (school_stage);

ALTER TABLE boks.boks_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_children FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_children_family ON boks.boks_children;
CREATE POLICY boks_children_family ON boks.boks_children
  USING (family_id = current_setting('app.family_id', true))
  WITH CHECK (family_id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_children_owner ON boks.boks_children;
CREATE POLICY boks_children_owner ON boks.boks_children
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_children TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_children;