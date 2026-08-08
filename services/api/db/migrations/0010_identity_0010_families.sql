-- migrations/0010_identity/0010_families.sql
-- 依赖：0001_extensions
-- 说明：家庭表 + RLS
-- UP
CREATE TABLE IF NOT EXISTS boks.boks_families (
  id              TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','archived','deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boks_families_status_idx ON boks.boks_families (status);

ALTER TABLE boks.boks_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE boks.boks_families FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boks_families_self ON boks.boks_families;
CREATE POLICY boks_families_self ON boks.boks_families
  USING (id = current_setting('app.family_id', true))
  WITH CHECK (id = current_setting('app.family_id', true));

DROP POLICY IF EXISTS boks_families_owner ON boks.boks_families;
CREATE POLICY boks_families_owner ON boks.boks_families
  TO boks_owner USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON boks.boks_families TO boks_app;

-- DOWN
DROP TABLE IF EXISTS boks.boks_families;